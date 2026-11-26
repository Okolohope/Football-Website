package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type server struct {
	db       *pgxpool.Pool
	jwks     *keyfunc.JWKS
	frontend string
	storage  *objectStorage
}

type playerProfile struct {
	FullName        string   `json:"fullName"`
	Nickname        string   `json:"nickname"`
	DateOfBirth     string   `json:"dateOfBirth"`
	PhoneNumber     string   `json:"phoneNumber"`
	GuardianName    string   `json:"guardianName"`
	GuardianPhone   string   `json:"guardianPhone"`
	GuardianConsent bool     `json:"guardianConsent"`
	AgeGroup        string   `json:"ageGroup"`
	Country         string   `json:"country"`
	City            string   `json:"city"`
	Gender          string   `json:"gender"`
	PrimaryPosition string   `json:"primaryPosition"`
	PreferredFoot   string   `json:"preferredFoot"`
	PlayingLevel    string   `json:"playingLevel"`
	YearsPlaying    string   `json:"yearsPlaying"`
	Bio             string   `json:"bio"`
	PlayingStyle    []string `json:"playingStyle"`
	Strengths       []string `json:"strengths"`
	Ambitions       string   `json:"ambitions"`
	Languages       []string `json:"languages"`
	AvatarKey       string   `json:"avatarKey"`
}

var allowedValues = map[string]map[string]bool{
	"ageGroup":        {"Under 15": true, "15-17": true, "18-21": true, "22+": true},
	"gender":          {"Male": true, "Female": true, "Prefer not to say": true},
	"primaryPosition": {"Forward": true, "Midfielder": true, "Defender": true, "Goalkeeper": true},
	"preferredFoot":   {"Left": true, "Right": true, "Both": true},
	"playingLevel":    {"Academy": true, "Amateur": true, "Semi-professional": true, "Professional": true},
	"yearsPlaying":    {"1": true, "2": true, "3": true, "4+": true},
}

func main() {
	if err := godotenv.Load(".env"); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Fatalf("load .env: %v", err)
	}
	databaseURL := os.Getenv("DATABASE_URL")
	issuer := strings.TrimRight(os.Getenv("CLERK_ISSUER_URL"), "/")
	frontend := os.Getenv("FRONTEND_ORIGIN")
	if databaseURL == "" || issuer == "" || frontend == "" {
		log.Fatal("DATABASE_URL, CLERK_ISSUER_URL, and FRONTEND_ORIGIN are required")
	}
	if _, err := url.ParseRequestURI(frontend); err != nil {
		log.Fatalf("invalid FRONTEND_ORIGIN: %v", err)
	}

	ctx := context.Background()
	dbConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Fatalf("parse database configuration: %v", err)
	}
	dbConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	db, err := pgxpool.NewWithConfig(ctx, dbConfig)
	if err != nil {
		log.Fatalf("create database pool: %v", err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		log.Fatalf("connect to Neon: %v", err)
	}
	jwks, err := keyfunc.Get(issuer+"/.well-known/jwks.json", keyfunc.Options{})
	if err != nil {
		log.Fatalf("load Clerk JWKS: %v", err)
	}

	storage, err := newObjectStorage(ctx)
	if err != nil {
		log.Fatal(err)
	}
	s := &server{db: db, jwks: jwks, frontend: frontend, storage: storage}
	mux := http.NewServeMux()
	mux.Handle("/api/player/profile", s.withSecurity(s.requireAuth(http.HandlerFunc(s.profile))))
	mux.Handle("/api/player/avatar", s.withSecurity(s.requireAuth(http.HandlerFunc(s.uploadAvatar))))
	mux.Handle("/api/posts/media", s.withSecurity(s.requireAuth(http.HandlerFunc(s.uploadPostMedia))))
	mux.Handle("/api/posts/feed", s.withSecurity(s.requireAuth(http.HandlerFunc(s.postFeed))))
	mux.Handle("/api/posts/like/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.toggleLike))))
	mux.Handle("/api/posts/comment/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.comments))))
	mux.Handle("/api/posts", s.withSecurity(s.requireAuth(http.HandlerFunc(s.posts))))
	mux.Handle("/api/follows/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.follow))))
	mux.Handle("/api/search", s.withSecurity(s.requireAuth(http.HandlerFunc(s.search))))
	mux.Handle("/api/teams", s.withSecurity(s.requireAuth(http.HandlerFunc(s.teams))))
	mux.Handle("/api/users/me", s.withSecurity(s.requireAuth(http.HandlerFunc(s.ensureElevenUser))))
	mux.Handle("/api/users/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.userFollow))))
	mux.Handle("/api/player/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.publicPlayer))))
	mux.Handle("/api/profile-views", s.withSecurity(s.requireAuth(http.HandlerFunc(s.profileViews))))
	mux.Handle("/api/profile-views/me", s.withSecurity(s.requireAuth(http.HandlerFunc(s.profileViewsMe))))
	mux.Handle("/api/stats/me", s.withSecurity(s.requireAuth(http.HandlerFunc(s.statsMe))))
	mux.Handle("/api/squads/search", s.withSecurity(s.requireAuth(http.HandlerFunc(s.squadSearch))))
	mux.Handle("/api/training", s.withSecurity(s.requireAuth(http.HandlerFunc(s.training))))
	mux.Handle("/api/training/rsvp/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.trainingRSVP))))
	mux.Handle("/api/coach/trainings", s.withSecurity(s.requireAuth(http.HandlerFunc(s.coachTrainings))))
	mux.Handle("/api/coach/trainings/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.coachTrainingDetail))))
	mux.Handle("/api/coach/squads/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.coachSquadActions))))
	mux.Handle("/api/coach/offers", s.withSecurity(s.requireAuth(http.HandlerFunc(s.coachOffers))))
	mux.Handle("/api/coach/offers/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.coachOfferDetail))))
	mux.Handle("/api/messages", s.withSecurity(s.requireAuth(http.HandlerFunc(s.messages))))
	mux.Handle("/api/messages/", s.withSecurity(s.requireAuth(http.HandlerFunc(s.messagesThread))))
	mux.HandleFunc("/api/webhooks/clerk", s.clerkWebhook)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	addr := os.Getenv("PORT")
	if addr == "" {
		addr = "8080"
	}
	log.Printf("player API listening on :%s", addr)
	log.Fatal(http.ListenAndServe(":"+addr, mux))
}

func (s *server) withSecurity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != "" && r.Header.Get("Origin") != s.frontend {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", s.frontend)
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		const prefix = "Bearer "
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, prefix) {
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}
		token, err := jwt.Parse(strings.TrimPrefix(header, prefix), s.jwks.Keyfunc,
			jwt.WithValidMethods([]string{"RS256"}),
			jwt.WithIssuer(strings.TrimRight(os.Getenv("CLERK_ISSUER_URL"), "/")),
			jwt.WithExpirationRequired(),
		)
		if err != nil || !token.Valid {
			http.Error(w, "invalid authentication token", http.StatusUnauthorized)
			return
		}
		subject, err := token.Claims.GetSubject()
		if err != nil || subject == "" || len(subject) > 128 {
			http.Error(w, "invalid token subject", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey{}, subject)))
	})
}

type userIDKey struct{}

func (s *server) profile(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getProfile(w, r)
	case http.MethodPut:
		s.upsertProfile(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) getProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(userIDKey{}).(string)
	if !ok {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}

	var profile playerProfile
	err := s.db.QueryRow(r.Context(), `
		SELECT full_name, COALESCE(nickname, ''), COALESCE(date_of_birth::TEXT, ''),
			COALESCE(phone_number, ''), COALESCE(guardian_name, ''), COALESCE(guardian_phone, ''),
			guardian_consent, age_group, country, city, gender,
			primary_position, preferred_foot, playing_level, years_playing,
			COALESCE(bio, ''), playing_style, strengths, COALESCE(ambitions, ''),
			languages, COALESCE(avatar_key, '')
		FROM player_profiles
		WHERE user_id = $1
	`, userID).Scan(
		&profile.FullName, &profile.Nickname, &profile.DateOfBirth, &profile.PhoneNumber,
		&profile.GuardianName, &profile.GuardianPhone, &profile.GuardianConsent,
		&profile.AgeGroup, &profile.Country,
		&profile.City, &profile.Gender, &profile.PrimaryPosition, &profile.PreferredFoot,
		&profile.PlayingLevel, &profile.YearsPlaying, &profile.Bio, &profile.PlayingStyle,
		&profile.Strengths, &profile.Ambitions, &profile.Languages, &profile.AvatarKey,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "profile not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("load player profile: %v", err)
		http.Error(w, "profile could not be loaded", http.StatusInternalServerError)
		return
	}

	response := profileResponse{playerProfile: profile}
	if profile.AvatarKey != "" && s.storage != nil {
		response.AvatarURL, err = s.storage.avatarURL(r.Context(), profile.AvatarKey)
		if err != nil {
			log.Printf("create player avatar URL: %v", err)
			http.Error(w, "profile avatar could not be loaded", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, http.StatusOK, response)
}

type profileResponse struct {
	playerProfile
	AvatarURL string `json:"avatarUrl"`
}

func (s *server) upsertProfile(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	var profile playerProfile
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&profile); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		http.Error(w, "request body must contain one JSON object", http.StatusBadRequest)
		return
	}
	if err := validateProfile(profile); err != nil {
		http.Error(w, err.Error(), http.StatusUnprocessableEntity)
		return
	}

	userID, ok := r.Context().Value(userIDKey{}).(string)
	if !ok {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	_, err := s.db.Exec(r.Context(), `
		INSERT INTO player_profiles
			(user_id, full_name, nickname, age_group, country, city, gender, primary_position,
			 preferred_foot, playing_level, years_playing, bio, playing_style, strengths, ambitions, languages, avatar_key,
			 date_of_birth, phone_number, guardian_name, guardian_phone, guardian_consent)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, ''), $13, $14, NULLIF($15, ''), $16, NULLIF($17, ''),
			NULLIF($18, '')::DATE, NULLIF($19, ''), NULLIF($20, ''), NULLIF($21, ''), $22)
		ON CONFLICT (user_id) DO UPDATE SET
			full_name = EXCLUDED.full_name, nickname = EXCLUDED.nickname, age_group = EXCLUDED.age_group,
			country = EXCLUDED.country, city = EXCLUDED.city, gender = EXCLUDED.gender,
			primary_position = EXCLUDED.primary_position, preferred_foot = EXCLUDED.preferred_foot,
			playing_level = EXCLUDED.playing_level, years_playing = EXCLUDED.years_playing,
			bio = EXCLUDED.bio, playing_style = EXCLUDED.playing_style, strengths = EXCLUDED.strengths,
			ambitions = EXCLUDED.ambitions, languages = EXCLUDED.languages, avatar_key = EXCLUDED.avatar_key,
			date_of_birth = EXCLUDED.date_of_birth, phone_number = EXCLUDED.phone_number,
			guardian_name = EXCLUDED.guardian_name, guardian_phone = EXCLUDED.guardian_phone,
			guardian_consent = EXCLUDED.guardian_consent, updated_at = NOW()
	`, userID, profile.FullName, profile.Nickname, profile.AgeGroup, profile.Country, profile.City,
		profile.Gender, profile.PrimaryPosition, profile.PreferredFoot, profile.PlayingLevel,
		profile.YearsPlaying, profile.Bio, profile.PlayingStyle, profile.Strengths, profile.Ambitions,
		profile.Languages, profile.AvatarKey, profile.DateOfBirth, profile.PhoneNumber,
		profile.GuardianName, profile.GuardianPhone, profile.GuardianConsent)
	if err != nil {
		log.Printf("save player profile: %v", err)
		http.Error(w, "profile could not be saved", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "profile saved"})
}

func (s *server) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.storage == nil {
		http.Error(w, "object storage is not configured", http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, "image must be 5 MB or smaller", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "avatar image is required", http.StatusBadRequest)
		return
	}
	defer file.Close()
	if header.Size > 5<<20 {
		http.Error(w, "image must be 5 MB or smaller", http.StatusRequestEntityTooLarge)
		return
	}
	body, contentType, err := imageContentType(file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	userID, ok := r.Context().Value(userIDKey{}).(string)
	if !ok {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	key, err := s.storage.uploadAvatar(r.Context(), userID, body, contentType)
	if err != nil {
		log.Printf("upload player avatar: %v", err)
		http.Error(w, "avatar could not be uploaded", http.StatusInternalServerError)
		return
	}
	url, err := s.storage.avatarURL(r.Context(), key)
	if err != nil {
		log.Printf("create player avatar URL: %v", err)
		http.Error(w, "avatar URL could not be created", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"key": key, "url": url})
}

func validateProfile(p playerProfile) error {
	if len(p.FullName) < 2 || len(p.FullName) > 80 || !utf8.ValidString(p.FullName) {
		return fmt.Errorf("fullName must be between 2 and 80 characters")
	}
	if len(p.PhoneNumber) > 30 {
		return fmt.Errorf("phoneNumber is too long")
	}
	if p.DateOfBirth != "" {
		dob, err := time.Parse("2006-01-02", p.DateOfBirth)
		if err != nil {
			return fmt.Errorf("dateOfBirth must use YYYY-MM-DD")
		}
		if dob.After(time.Now()) {
			return fmt.Errorf("dateOfBirth cannot be in the future")
		}
		adultAt := time.Date(dob.Year()+18, dob.Month(), dob.Day(), 0, 0, 0, 0, time.UTC)
		if time.Now().Before(adultAt) && (!p.GuardianConsent || len(p.GuardianName) < 2 || len(p.GuardianPhone) < 7) {
			return fmt.Errorf("guardian consent and guardian details are required for users under 18")
		}
	}
	if len(p.City) < 1 || len(p.City) > 80 || !utf8.ValidString(p.City) {
		return fmt.Errorf("city must be between 1 and 80 characters")
	}
	for field, value := range map[string]string{"ageGroup": p.AgeGroup, "gender": p.Gender, "primaryPosition": p.PrimaryPosition, "preferredFoot": p.PreferredFoot, "playingLevel": p.PlayingLevel, "yearsPlaying": p.YearsPlaying} {
		if !allowedValues[field][value] {
			return fmt.Errorf("invalid %s", field)
		}
	}
	if len(p.Nickname) > 40 || len(p.Country) > 60 || len(p.Bio) > 200 || len(p.Ambitions) > 320 {
		return fmt.Errorf("one or more profile fields are too long")
	}
	if len(p.PlayingStyle) > 6 || len(p.Strengths) > 6 || len(p.Languages) > 10 {
		return fmt.Errorf("too many profile options")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func init() {
	// Keep the default HTTP server from accepting slow, unbounded connections.
	http.DefaultClient.Timeout = 10 * time.Second
}

type postMediaInput struct {
	Key             string `json:"key"`
	MediaType       string `json:"mediaType"`
	DurationSeconds int    `json:"durationSeconds"`
}

type createPostInput struct {
	Caption    string           `json:"caption"`
	Visibility string           `json:"visibility"`
	PostType   string           `json:"postType"`
	Media      []postMediaInput `json:"media"`
}

func (s *server) posts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	var input createPostInput
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		http.Error(w, "invalid post", http.StatusBadRequest)
		return
	}
	if len(input.Caption) > 1000 || len(input.Media) > 10 {
		http.Error(w, "caption or media limit exceeded", http.StatusUnprocessableEntity)
		return
	}
	if input.Visibility != "public" && input.Visibility != "followers" {
		input.Visibility = "public"
	}
	if input.PostType != "CLIP" {
		input.PostType = "STANDARD"
	}
	userID := r.Context().Value(userIDKey{}).(string)
	var count int
	if err := s.db.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM posts
		WHERE author_id = $1 AND created_at >= date_trunc('day', NOW())
	`, userID).Scan(&count); err != nil {
		http.Error(w, "could not check daily post limit", http.StatusInternalServerError)
		return
	}
	if count >= 3 {
		http.Error(w, "daily post limit reached", http.StatusTooManyRequests)
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		http.Error(w, "could not create post", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())
	var postID string
	if err := tx.QueryRow(r.Context(), `
		INSERT INTO posts(author_id, caption, visibility, post_type) VALUES($1, NULLIF($2, ''), $3, $4)
		RETURNING id::TEXT
	`, userID, input.Caption, input.Visibility, input.PostType).Scan(&postID); err != nil {
		http.Error(w, "could not create post", http.StatusInternalServerError)
		return
	}
	for index, media := range input.Media {
		if media.MediaType != "image" && media.MediaType != "video" {
			http.Error(w, "invalid media type", http.StatusBadRequest)
			return
		}
		if media.MediaType == "video" && (media.DurationSeconds < 0 || media.DurationSeconds > 300) {
			http.Error(w, "videos must be five minutes or shorter", http.StatusBadRequest)
			return
		}
		if len(media.Key) == 0 || len(media.Key) > 500 {
			http.Error(w, "invalid media key", http.StatusBadRequest)
			return
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO post_media(post_id, media_type, object_key, duration_seconds, sort_order)
			VALUES($1::UUID, $2, $3, NULLIF($4, 0), $5)
		`, postID, media.MediaType, media.Key, media.DurationSeconds, index); err != nil {
			http.Error(w, "could not save post media", http.StatusInternalServerError)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "could not publish post", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": postID})
}

func (s *server) uploadPostMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || s.storage == nil {
		http.Error(w, "post media upload unavailable", http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, "media must be 100 MB or smaller", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("media")
	if err != nil {
		http.Error(w, "media file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()
	if header.Size > 100<<20 {
		http.Error(w, "media must be 100 MB or smaller", http.StatusRequestEntityTooLarge)
		return
	}
	durationSeconds := 0
	fmt.Sscanf(r.FormValue("durationSeconds"), "%d", &durationSeconds)
	mediaType := r.FormValue("mediaType")
	if mediaType == "video" && durationSeconds > 300 {
		http.Error(w, "videos must be five minutes or shorter", http.StatusBadRequest)
		return
	}
	headerBytes := make([]byte, 512)
	count, readErr := file.Read(headerBytes)
	if readErr != nil && readErr != io.EOF {
		http.Error(w, "could not read media", http.StatusBadRequest)
		return
	}
	contentType := http.DetectContentType(headerBytes[:count])
	body := io.MultiReader(bytes.NewReader(headerBytes[:count]), file)
	if mediaType == "image" && !strings.HasPrefix(contentType, "image/") {
		http.Error(w, "invalid image", http.StatusBadRequest)
		return
	}
	if mediaType == "video" && contentType != "video/mp4" && contentType != "video/webm" {
		http.Error(w, "videos must be MP4 or WebM", http.StatusBadRequest)
		return
	}
	userID := r.Context().Value(userIDKey{}).(string)
	key, err := s.storage.uploadPostMedia(r.Context(), userID, body, contentType, mediaType)
	if err != nil {
		http.Error(w, "media could not be uploaded", http.StatusInternalServerError)
		return
	}
	url, err := s.storage.mediaURL(r.Context(), key)
	if err != nil {
		http.Error(w, "media URL could not be created", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"key": key, "url": url, "mediaType": mediaType, "durationSeconds": durationSeconds})
}

func (s *server) postFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := r.Context().Value(userIDKey{}).(string)
	cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
	var cursorTime time.Time
	var cursorID string
	hasCursor := false
	if cursor != "" {
		parts := strings.SplitN(cursor, "|", 2)
		if len(parts) == 2 {
			if parsed, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil && len(parts[1]) > 0 {
				cursorTime, cursorID, hasCursor = parsed, parts[1], true
			}
		}
	}
	query := `
		SELECT p.id::TEXT, p.author_id, pp.full_name, COALESCE(pp.nickname, ''),
			p.caption, p.visibility, p.created_at, p.post_type,
			COALESCE(u.player_uuid, p.author_id),
			(SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id),
			EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = $1),
			(SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id)
		FROM posts p
		JOIN player_profiles pp ON pp.user_id = p.author_id
		LEFT JOIN users u ON u.clerk_id = p.author_id
		WHERE p.visibility = 'public'
		   OR p.author_id = $1
		   OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = p.author_id)
	`
	args := []any{userID}
	if hasCursor {
		query += ` AND (p.created_at, p.id) < ($2::TIMESTAMPTZ, $3::UUID)`
		args = append(args, cursorTime, cursorID)
	}
	query += ` ORDER BY p.created_at DESC, p.id DESC LIMIT 20`
	rows, err := s.db.Query(r.Context(), query, args...)
	if err != nil {
		http.Error(w, "could not load feed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	feed := []map[string]any{}
	var nextCursor string
	for rows.Next() {
		var id, authorID, authorName, nickname, caption, visibility, postType, authorUuid string
		var created time.Time
		var likeCount, commentCount int
		var liked bool
		if err := rows.Scan(&id, &authorID, &authorName, &nickname, &caption, &visibility, &created, &postType, &authorUuid, &likeCount, &liked, &commentCount); err != nil {
			http.Error(w, "could not load feed", http.StatusInternalServerError)
			return
		}
		mediaRows, err := s.db.Query(r.Context(), `
			SELECT media_type, object_key, COALESCE(duration_seconds, 0), sort_order
			FROM post_media WHERE post_id = $1::UUID ORDER BY sort_order
		`, id)
		if err != nil {
			http.Error(w, "could not load post media", http.StatusInternalServerError)
			return
		}
		media := []map[string]any{}
		for mediaRows.Next() {
			var mediaType, key string
			var duration, sortOrder int
			if err := mediaRows.Scan(&mediaType, &key, &duration, &sortOrder); err != nil {
				mediaRows.Close()
				http.Error(w, "could not load post media", http.StatusInternalServerError)
				return
			}
			url := ""
			if s.storage != nil {
				url, _ = s.storage.mediaURL(r.Context(), key)
			}
			media = append(media, map[string]any{"type": mediaType, "url": url, "durationSeconds": duration, "sortOrder": sortOrder})
		}
		mediaRows.Close()
		feed = append(feed, map[string]any{
			"id": id, "authorId": authorID, "authorName": authorName, "nickname": nickname,
			"caption": caption, "visibility": visibility, "createdAt": created,
			"postType": postType, "likeCount": likeCount, "liked": liked, "commentCount": commentCount, "media": media,
			"authorUuid": authorUuid,
		})
		nextCursor = created.Format(time.RFC3339Nano) + "|" + id
	}
	if len(feed) == 20 {
		w.Header().Set("X-Next-Cursor", nextCursor)
	}
	writeJSON(w, http.StatusOK, feed)
}

func (s *server) toggleLike(w http.ResponseWriter, r *http.Request) {
	postID := strings.TrimPrefix(r.URL.Path, "/api/posts/like/")
	postID = strings.Trim(postID, "/")
	userID := r.Context().Value(userIDKey{}).(string)
	if r.Method == http.MethodPost {
		_, err := s.db.Exec(r.Context(), `INSERT INTO post_likes(post_id, user_id) VALUES($1::UUID, $2) ON CONFLICT DO NOTHING`, postID, userID)
		if err != nil {
			http.Error(w, "could not like post", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"liked": true})
		return
	}
	if r.Method == http.MethodDelete {
		_, err := s.db.Exec(r.Context(), `DELETE FROM post_likes WHERE post_id=$1::UUID AND user_id=$2`, postID, userID)
		if err != nil {
			http.Error(w, "could not unlike post", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"liked": false})
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *server) comments(w http.ResponseWriter, r *http.Request) {
	postID := strings.TrimPrefix(r.URL.Path, "/api/posts/comment/")
	postID = strings.Trim(postID, "/")
	userID := r.Context().Value(userIDKey{}).(string)
	if r.Method == http.MethodPost {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var input struct {
			Body string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || len(input.Body) < 1 || len(input.Body) > 500 {
			http.Error(w, "comment must be between 1 and 500 characters", http.StatusBadRequest)
			return
		}
		var id string
		err := s.db.QueryRow(r.Context(), `
			INSERT INTO post_comments(post_id, user_id, body) VALUES($1::UUID, $2, $3) RETURNING id::TEXT
		`, postID, userID, input.Body).Scan(&id)
		if err != nil {
			http.Error(w, "could not add comment", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
		return
	}
	if r.Method == http.MethodGet {
		rows, err := s.db.Query(r.Context(), `
			SELECT c.id::TEXT, c.user_id, pp.full_name, c.body, c.created_at
			FROM post_comments c JOIN player_profiles pp ON pp.user_id=c.user_id
			WHERE c.post_id=$1::UUID ORDER BY c.created_at ASC
		`, postID)
		if err != nil {
			http.Error(w, "could not load comments", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		result := []map[string]any{}
		for rows.Next() {
			var id, authorID, authorName, body string
			var created time.Time
			if err := rows.Scan(&id, &authorID, &authorName, &body, &created); err != nil {
				http.Error(w, "could not load comments", http.StatusInternalServerError)
				return
			}
			result = append(result, map[string]any{"id": id, "authorId": authorID, "authorName": authorName, "body": body, "createdAt": created})
		}
		writeJSON(w, http.StatusOK, result)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *server) follow(w http.ResponseWriter, r *http.Request) {
	followingID := strings.TrimPrefix(r.URL.Path, "/api/follows/")
	followingID = strings.Trim(followingID, "/")
	followerID := r.Context().Value(userIDKey{}).(string)
	if r.Method == http.MethodPost {
		_, err := s.db.Exec(r.Context(), `INSERT INTO follows(follower_id, following_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, followerID, followingID)
		if err != nil {
			http.Error(w, "could not follow user", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"following": true})
		return
	}
	if r.Method == http.MethodDelete {
		_, err := s.db.Exec(r.Context(), `DELETE FROM follows WHERE follower_id=$1 AND following_id=$2`, followerID, followingID)
		if err != nil {
			http.Error(w, "could not unfollow user", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"following": false})
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *server) publicPlayer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	playerUUID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/player/"), "/")
	var userID, displayName, username, position, avatarURL, statsPrivacy string
	var followersCount, followingCount int64
	err := s.db.QueryRow(r.Context(), `
		SELECT id::TEXT, display_name, username, COALESCE(position,''),
			COALESCE(avatar_url,''), stats_privacy, followers_count, following_count
		FROM users WHERE player_uuid=$1
	`, playerUUID).Scan(&userID, &displayName, &username, &position, &avatarURL, &statsPrivacy, &followersCount, &followingCount)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "player could not be loaded", http.StatusInternalServerError)
		return
	}
	if statsPrivacy != "EVERYONE" {
		writeJSON(w, http.StatusOK, map[string]any{
			"playerUuid": playerUUID, "displayName": displayName, "username": username,
			"position": position, "avatarUrl": avatarURL, "followersCount": followersCount,
			"followingCount": followingCount, "statsPrivacy": statsPrivacy, "statsVisible": false,
		})
		return
	}
	var matches, goals, assists int
	var rating *float64
	_ = s.db.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(matches_played),0), COALESCE(SUM(goals),0),
			COALESCE(SUM(assists),0), AVG(rating)
		FROM player_match_ratings WHERE player_id=$1::UUID
	`, userID).Scan(&matches, &goals, &assists, &rating)
	writeJSON(w, http.StatusOK, map[string]any{
		"playerUuid": playerUUID, "displayName": displayName, "username": username,
		"position": position, "avatarUrl": avatarURL, "followersCount": followersCount,
		"followingCount": followingCount, "statsPrivacy": statsPrivacy, "statsVisible": true,
		"metrics": map[string]any{"matches": matches, "goals": goals, "assists": assists, "rating": rating},
	})
}

func (s *server) statsMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	clerkID := r.Context().Value(userIDKey{}).(string)
	var userID, playerUUID, username, displayName, position, avatarURL, statsPrivacy string
	var followersCount, followingCount int64
	var userRoleRow = s.db.QueryRow(r.Context(), `
		SELECT id::TEXT, player_uuid, username, display_name,
			COALESCE(position,''), COALESCE(avatar_url,''), stats_privacy,
			followers_count, following_count
		FROM users WHERE clerk_id=$1
	`, clerkID)
	if err := userRoleRow.Scan(&userID, &playerUUID, &username, &displayName, &position, &avatarURL, &statsPrivacy, &followersCount, &followingCount); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT sm.membership_type, s.squad_code, s.name, s.squad_category,
			sm.role, sm.is_top_eleven, sm.loan_end_date
		FROM squad_memberships sm
		JOIN squads s ON s.id=sm.squad_id
		WHERE sm.user_id=$1::UUID AND sm.status='ACTIVE'
		ORDER BY CASE sm.membership_type WHEN 'PRIMARY' THEN 1 WHEN 'LOAN' THEN 2 ELSE 3 END
	`, userID)
	if err != nil {
		http.Error(w, "could not load squads", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	slots := map[string]any{}
	for rows.Next() {
		var membershipType, squadCode, squadName, category, role string
		var topEleven bool
		var loanEnd *time.Time
		if err := rows.Scan(&membershipType, &squadCode, &squadName, &category, &role, &topEleven, &loanEnd); err != nil {
			http.Error(w, "could not load squads", http.StatusInternalServerError)
			return
		}
		slots[membershipType] = map[string]any{
			"code": squadCode, "name": squadName, "category": category,
			"role": role, "topEleven": topEleven, "loanEndDate": loanEnd,
		}
	}
	metrics := map[string]any{"matches": 0, "goals": 0, "assists": 0, "rating": nil}
	var matches, goals, assists int
	var rating *float64
	_ = s.db.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(matches_played),0), COALESCE(SUM(goals),0), COALESCE(SUM(assists),0),
			AVG(rating)
		FROM player_match_ratings WHERE player_id=$1::UUID
	`, userID).Scan(&matches, &goals, &assists, &rating)
	metrics = map[string]any{"matches": matches, "goals": goals, "assists": assists, "rating": rating}
	careerRows, err := s.db.Query(r.Context(), `
		SELECT ch.membership_type, COALESCE(s.name,''), COALESCE(ch.matches,0),
			COALESCE(ch.goals,0), COALESCE(ch.assists,0), ch.average_rating,
			ch.joined_at, ch.ended_at
		FROM career_history ch LEFT JOIN squads s ON s.id=ch.squad_id
		WHERE ch.player_id=$1::UUID ORDER BY ch.joined_at DESC
	`, userID)
	career := []map[string]any{}
	if err == nil {
		defer careerRows.Close()
		for careerRows.Next() {
			var membershipType, squadName string
			var matches, goals, assists int
			var averageRating *float64
			var joined time.Time
			var ended *time.Time
			if careerRows.Scan(&membershipType, &squadName, &matches, &goals, &assists, &averageRating, &joined, &ended) == nil {
				career = append(career, map[string]any{
					"membershipType": membershipType, "squadName": squadName,
					"matches": matches, "goals": goals, "assists": assists,
					"averageRating": averageRating, "joinedAt": joined, "endedAt": ended,
				})
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"playerUuid": playerUUID, "username": username, "displayName": displayName,
		"position": position, "avatarUrl": avatarURL, "statsPrivacy": statsPrivacy,
		"followersCount": followersCount, "followingCount": followingCount,
		"slots": slots, "metrics": metrics, "careerHistory": career,
	})
}

func (s *server) squadSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(query) < 2 || len(query) > 80 {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	pattern := "%" + strings.ToLower(query) + "%"
	rows, err := s.db.Query(r.Context(), `
		SELECT squad_code, name, squad_category, COALESCE(region_state,'')
		FROM squads
		WHERE LOWER(name) LIKE $1 OR LOWER(squad_code) LIKE $1
		ORDER BY name LIMIT 30
	`, pattern)
	if err != nil {
		http.Error(w, "squad search failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	result := []map[string]string{}
	for rows.Next() {
		var code, name, category, region string
		if err := rows.Scan(&code, &name, &category, &region); err != nil {
			http.Error(w, "squad search failed", http.StatusInternalServerError)
			return
		}
		result = append(result, map[string]string{"code": code, "name": name, "category": category, "region": region})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *server) training(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	clerkID := r.Context().Value(userIDKey{}).(string)
	var userID string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&userID); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT ts.id::TEXT, ts.title, COALESCE(ts.location,''), ts.starts_at,
			COALESCE(ta.player_rsvp,'NOT_RESPONDED'), COALESCE(ta.player_reason,''),
			COALESCE(ta.coach_status,'UNVERIFIED'), COALESCE(s.name,'')
		FROM training_sessions ts
		JOIN squad_memberships sm ON sm.squad_id=ts.squad_id
			AND sm.user_id=$1::UUID AND sm.status='ACTIVE'
		JOIN squads s ON s.id=ts.squad_id
		LEFT JOIN training_attendance ta ON ta.session_id=ts.id AND ta.user_id=$1::UUID
		WHERE ts.starts_at >= NOW()-INTERVAL '30 days'
		ORDER BY ts.starts_at ASC LIMIT 50
	`, userID)
	if err != nil {
		http.Error(w, "could not load training", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, title, location, playerRSVP, reason, coachStatus, squadName string
		var starts time.Time
		if err := rows.Scan(&id, &title, &location, &starts, &playerRSVP, &reason, &coachStatus, &squadName); err != nil {
			http.Error(w, "could not load training", http.StatusInternalServerError)
			return
		}
		result = append(result, map[string]any{
			"id": id, "title": title, "location": location, "startsAt": starts,
			"playerRsvp": playerRSVP, "playerReason": reason,
			"coachStatus": coachStatus, "squadName": squadName,
		})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *server) trainingRSVP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	sessionID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/training/rsvp/"), "/")
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var input struct {
		RSVP   string `json:"rsvp"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid RSVP", http.StatusBadRequest)
		return
	}
	if input.RSVP != "ATTENDING" && input.RSVP != "RUNNING_LATE" && input.RSVP != "NOT_ATTENDING" {
		http.Error(w, "invalid RSVP", http.StatusBadRequest)
		return
	}
	if (input.RSVP == "RUNNING_LATE" || input.RSVP == "NOT_ATTENDING") && strings.TrimSpace(input.Reason) == "" {
		http.Error(w, "a reason is required", http.StatusBadRequest)
		return
	}
	clerkID := r.Context().Value(userIDKey{}).(string)
	var userID string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&userID); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	_, err := s.db.Exec(r.Context(), `
		INSERT INTO training_attendance(session_id, user_id, player_rsvp, player_reason, rsvp_updated_at)
		VALUES($1::UUID,$2::UUID,$3,NULLIF($4,''),NOW())
		ON CONFLICT(session_id,user_id) DO UPDATE SET
			player_rsvp=EXCLUDED.player_rsvp,
			player_reason=EXCLUDED.player_reason,
			rsvp_updated_at=NOW(),
			coach_status='UNVERIFIED',
			verified_by_coach_id=NULL,
			verified_at=NULL
	`, sessionID, userID, input.RSVP, strings.TrimSpace(input.Reason))
	if err != nil {
		http.Error(w, "RSVP could not be saved", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"coachStatus": "UNVERIFIED", "playerRsvp": input.RSVP})
}

func (s *server) coachTrainings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	var input struct {
		SquadID  string `json:"squadId"`
		Title    string `json:"title"`
		Location string `json:"location"`
		StartsAt string `json:"startsAt"`
		EndsAt   string `json:"endsAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid training", http.StatusBadRequest)
		return
	}
	start, err := time.Parse(time.RFC3339, input.StartsAt)
	if err != nil || strings.TrimSpace(input.Title) == "" {
		http.Error(w, "title and valid startsAt are required", http.StatusBadRequest)
		return
	}
	var end *time.Time
	if input.EndsAt != "" {
		parsed, err := time.Parse(time.RFC3339, input.EndsAt)
		if err == nil {
			end = &parsed
		}
	}
	clerkID := r.Context().Value(userIDKey{}).(string)
	var coachID string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&coachID); err != nil {
		http.Error(w, "coach not found", http.StatusForbidden)
		return
	}
	var authorized bool
	if err := s.db.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM squad_memberships sm
			WHERE sm.squad_id=$1::UUID AND sm.user_id=$2::UUID
				AND sm.status='ACTIVE' AND sm.role IN ('COACH','ASSISTANT_COACH')
		)
	`, input.SquadID, coachID).Scan(&authorized); err != nil || !authorized {
		http.Error(w, "coach role required", http.StatusForbidden)
		return
	}
	var id string
	err = s.db.QueryRow(r.Context(), `
		INSERT INTO training_sessions(squad_id,title,location,starts_at,ends_at)
		VALUES($1::UUID,$2,NULLIF($3,''),$4,$5)
		RETURNING id::TEXT
	`, input.SquadID, strings.TrimSpace(input.Title), strings.TrimSpace(input.Location), start, end).Scan(&id)
	if err != nil {
		http.Error(w, "training could not be created", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *server) messages(w http.ResponseWriter, r *http.Request) {
	clerkID := r.Context().Value(userIDKey{}).(string)
	var userID string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&userID); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(r.Context(), `
			SELECT c.id::TEXT, c.kind, COALESCE(s.name,'Direct Message'),
				COALESCE((SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1),''),
				COALESCE((SELECT created_at::TEXT FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1),'')
			FROM conversations c
			JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$1::UUID
			LEFT JOIN squads s ON s.id=c.squad_id
			ORDER BY COALESCE((SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1),c.created_at) DESC
			LIMIT 50
		`, userID)
		if err != nil {
			http.Error(w, "could not load conversations", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		result := []map[string]any{}
		for rows.Next() {
			var id, kind, title, preview, updated string
			if err := rows.Scan(&id, &kind, &title, &preview, &updated); err != nil {
				http.Error(w, "could not load conversations", http.StatusInternalServerError)
				return
			}
			result = append(result, map[string]any{"id": id, "kind": kind, "title": title, "preview": preview, "updatedAt": updated})
		}
		writeJSON(w, http.StatusOK, result)
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var input struct {
			ConversationID string `json:"conversationId"`
			PlayerUUID     string `json:"playerUuid"`
			Body           string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid message", http.StatusBadRequest)
			return
		}
		body := strings.TrimSpace(input.Body)
		if len(body) < 1 || len(body) > 4000 {
			http.Error(w, "message must be between 1 and 4000 characters", http.StatusBadRequest)
			return
		}
		conversationID := input.ConversationID
		if conversationID == "" && input.PlayerUUID != "" {
			var targetID string
			if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE player_uuid=$1`, input.PlayerUUID).Scan(&targetID); err != nil {
				http.Error(w, "player not found", http.StatusNotFound)
				return
			}
			err := s.db.QueryRow(r.Context(), `
				INSERT INTO conversations(kind) VALUES('DIRECT') RETURNING id::TEXT
			`).Scan(&conversationID)
			if err != nil {
				http.Error(w, "conversation could not be created", http.StatusInternalServerError)
				return
			}
			if _, err := s.db.Exec(r.Context(), `
				INSERT INTO conversation_members(conversation_id,user_id)
				SELECT $1::UUID, id FROM users WHERE id=$2::UUID OR id=$3::UUID
				ON CONFLICT DO NOTHING
			`, conversationID, userID, targetID); err != nil {
				http.Error(w, "conversation could not be created", http.StatusInternalServerError)
				return
			}
		}
		if conversationID == "" {
			http.Error(w, "conversationId or playerUuid is required", http.StatusBadRequest)
			return
		}
		var kind string
		var squadID *string
		if err := s.db.QueryRow(r.Context(), `SELECT kind, squad_id::TEXT FROM conversations WHERE id=$1::UUID`, conversationID).Scan(&kind, &squadID); err != nil {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}
		var member bool
		if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1::UUID AND user_id=$2::UUID)`, conversationID, userID).Scan(&member); err != nil || !member {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if kind == "SQUAD_GROUP" {
			if squadID == nil {
				http.Error(w, "squad group invalid", http.StatusForbidden)
				return
			}
			var role string
			if err := s.db.QueryRow(r.Context(), `SELECT role FROM squad_memberships WHERE squad_id=$1::UUID AND user_id=$2::UUID AND status='ACTIVE'`, *squadID, userID).Scan(&role); err != nil ||
				(role != "COACH" && role != "ASSISTANT_COACH" && role != "CAPTAIN") {
				http.Error(w, "only coaches, assistant coaches, and captains can post in squad groups", http.StatusForbidden)
				return
			}
		}
		var messageID string
		if err := s.db.QueryRow(r.Context(), `
			INSERT INTO messages(conversation_id,sender_id,body) VALUES($1::UUID,$2::UUID,$3)
			RETURNING id::TEXT
		`, conversationID, userID, body).Scan(&messageID); err != nil {
			http.Error(w, "message could not be sent", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": messageID, "conversationId": conversationID})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *server) messagesThread(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	conversationID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/messages/"), "/")
	clerkID := r.Context().Value(userIDKey{}).(string)
	var userID string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&userID); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	var member bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1::UUID AND user_id=$2::UUID)`, conversationID, userID).Scan(&member); err != nil || !member {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	cursor := r.URL.Query().Get("cursor")
	query := `
		SELECT m.id::TEXT, m.sender_id::TEXT, u.player_uuid, u.display_name, m.body, m.created_at
		FROM messages m JOIN users u ON u.id=m.sender_id
		WHERE m.conversation_id=$1::UUID
	`
	args := []any{conversationID}
	if cursor != "" {
		query += ` AND m.created_at < $2::TIMESTAMPTZ`
		if parsed, err := time.Parse(time.RFC3339Nano, cursor); err == nil {
			args = append(args, parsed)
		} else {
			args = append(args, time.Now())
		}
	}
	query += ` ORDER BY m.created_at DESC LIMIT 30`
	rows, err := s.db.Query(r.Context(), query, args...)
	if err != nil {
		http.Error(w, "could not load messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, senderID, playerUUID, displayName, body string
		var created time.Time
		if err := rows.Scan(&id, &senderID, &playerUUID, &displayName, &body, &created); err != nil {
			http.Error(w, "could not load messages", http.StatusInternalServerError)
			return
		}
		result = append(result, map[string]any{"id": id, "senderId": senderID, "playerUuid": playerUUID, "displayName": displayName, "body": body, "createdAt": created})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *server) coachTrainingDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/coach/trainings/"), "/"), "/")
	if len(parts) < 2 {
		http.Error(w, "invalid coach training route", http.StatusBadRequest)
		return
	}
	sessionID := parts[0]
	if len(parts) >= 2 && parts[1] == "attendance" {
		if r.Method == http.MethodGet {
			rows, err := s.db.Query(r.Context(), `
				SELECT u.player_uuid, ta.player_rsvp, COALESCE(ta.player_reason,''),
					ta.rsvp_updated_at, ta.coach_status
				FROM training_attendance ta JOIN users u ON u.id=ta.user_id
				WHERE ta.session_id=$1::UUID ORDER BY ta.rsvp_updated_at DESC NULLS LAST
			`, sessionID)
			if err != nil {
				http.Error(w, "attendance could not be loaded", http.StatusInternalServerError)
				return
			}
			defer rows.Close()
			result := []map[string]any{}
			for rows.Next() {
				var playerUUID, rsvp, reason, coachStatus string
				var updated *time.Time
				if err := rows.Scan(&playerUUID, &rsvp, &reason, &updated, &coachStatus); err == nil {
					result = append(result, map[string]any{"player_uuid": playerUUID, "player_rsvp": rsvp, "player_reason": reason, "rsvp_updated_at": updated, "coach_status": coachStatus})
				}
			}
			writeJSON(w, http.StatusOK, result)
			return
		}
		if r.Method == http.MethodPatch && len(parts) == 4 {
			var input struct {
				CoachStatus string `json:"coachStatus"`
			}
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil ||
				(input.CoachStatus != "VERIFIED_PRESENT" && input.CoachStatus != "VERIFIED_LATE" && input.CoachStatus != "VERIFIED_ABSENT") {
				http.Error(w, "invalid coach status", http.StatusBadRequest)
				return
			}
			clerkID := r.Context().Value(userIDKey{}).(string)
			var coachID string
			_ = s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&coachID)
			var userID string
			if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE player_uuid=$1 OR id::TEXT=$1 LIMIT 1`, parts[3]).Scan(&userID); err != nil {
				http.Error(w, "player not found", http.StatusNotFound)
				return
			}
			_, err := s.db.Exec(r.Context(), `
				UPDATE training_attendance SET coach_status=$3, verified_by_coach_id=$4::UUID, verified_at=NOW()
				WHERE session_id=$1::UUID AND user_id=$2::UUID
			`, sessionID, userID, "VERIFIED_"+strings.TrimPrefix(input.CoachStatus, "VERIFIED_"), coachID)
			if err != nil {
				http.Error(w, "attendance could not be updated", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"coachStatus": input.CoachStatus})
			return
		}
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *server) coachSquadActions(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/coach/squads/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) != 2 {
		http.Error(w, "invalid squad action", http.StatusBadRequest)
		return
	}
	squadID := parts[0]
	action := parts[1]
	if r.Method == http.MethodPost && action == "ratings" {
		r.Body = http.MaxBytesReader(w, r.Body, 8192)
		var input struct {
			PlayerUUID string  `json:"playerUuid"`
			Matches    int     `json:"matches"`
			Goals      int     `json:"goals"`
			Assists    int     `json:"assists"`
			Rating     float64 `json:"rating"`
			CoachNotes string  `json:"coachNotes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid rating", http.StatusBadRequest)
			return
		}
		var playerID string
		if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE player_uuid=$1`, input.PlayerUUID).Scan(&playerID); err != nil {
			http.Error(w, "player not found", http.StatusNotFound)
			return
		}
		var squadUUID string
		if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM squads WHERE id::TEXT=$1 OR squad_code=$1`, squadID).Scan(&squadUUID); err != nil {
			http.Error(w, "squad not found", http.StatusNotFound)
			return
		}
		_, err := s.db.Exec(r.Context(), `
			INSERT INTO player_match_ratings(player_id,squad_id,matches_played,goals,assists,rating,coach_notes,played_at)
			VALUES($1::UUID,$2::UUID,$3,$4,$5,$6,NULLIF($7,''),NOW())
		`, playerID, squadUUID, input.Matches, input.Goals, input.Assists, input.Rating, strings.TrimSpace(input.CoachNotes))
		if err != nil {
			http.Error(w, "rating could not be saved", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]bool{"saved": true})
		return
	}
	if r.Method == http.MethodPatch && action == "top-eleven" {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var input struct {
			PlayerUUID string `json:"playerUuid"`
			TopEleven  bool   `json:"topEleven"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid top-eleven request", http.StatusBadRequest)
			return
		}
		var squadUUID string
		_ = s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM squads WHERE id::TEXT=$1 OR squad_code=$1`, squadID).Scan(&squadUUID)
		var playerID string
		_ = s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE player_uuid=$1`, input.PlayerUUID).Scan(&playerID)
		_, err := s.db.Exec(r.Context(), `UPDATE squad_memberships SET is_top_eleven=$3 WHERE squad_id=$1::UUID AND user_id=$2::UUID AND status='ACTIVE'`, squadUUID, playerID, input.TopEleven)
		if err != nil {
			http.Error(w, "top-eleven could not be updated", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *server) coachOffers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	var input struct {
		PlayerUUID  string `json:"playerUuid"`
		FromSquadID string `json:"fromSquadId"`
		ToSquadID   string `json:"toSquadId"`
		OfferType   string `json:"offerType"`
		LoanEndDate string `json:"loanEndDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid offer", http.StatusBadRequest)
		return
	}
	if input.OfferType != "INVITE" && input.OfferType != "LOAN" && input.OfferType != "PERMANENT_TRANSFER" && input.OfferType != "UNIVERSITY_INVITE" {
		http.Error(w, "invalid offer type", http.StatusBadRequest)
		return
	}
	var playerID, toID string
	var fromID any
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE player_uuid=$1`, input.PlayerUUID).Scan(&playerID); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM squads WHERE id::TEXT=$1 OR squad_code=$1`, input.ToSquadID).Scan(&toID); err != nil {
		http.Error(w, "destination squad not found", http.StatusNotFound)
		return
	}
	if input.FromSquadID != "" {
		if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM squads WHERE id::TEXT=$1 OR squad_code=$1`, input.FromSquadID).Scan(&fromID); err != nil {
			http.Error(w, "source squad not found", http.StatusNotFound)
			return
		}
	} else {
		fromID = nil
	}
	var loanEnd any
	if input.LoanEndDate != "" {
		if parsed, err := time.Parse("2006-01-02", input.LoanEndDate); err == nil {
			loanEnd = parsed
		}
	} else {
		loanEnd = nil
	}
	var id string
	err := s.db.QueryRow(r.Context(), `
		INSERT INTO squad_transfer_offers(player_id,from_squad_id,to_squad_id,offer_type,loan_end_date)
		VALUES($1::UUID,$2::UUID,$3::UUID,$4,$5)
		RETURNING id::TEXT
	`, playerID, fromID, toID, input.OfferType, loanEnd).Scan(&id)
	if err != nil {
		http.Error(w, "offer could not be created", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *server) coachOfferDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	offerID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/coach/offers/"), "/")
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var input struct {
		ParentCoachStatus string `json:"parentCoachStatus"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil ||
		(input.ParentCoachStatus != "APPROVED" && input.ParentCoachStatus != "DECLINED") {
		http.Error(w, "invalid parent approval status", http.StatusBadRequest)
		return
	}
	_, err := s.db.Exec(r.Context(), `UPDATE squad_transfer_offers SET parent_coach_status=$2 WHERE id=$1::UUID`, offerID, input.ParentCoachStatus)
	if err != nil {
		http.Error(w, "offer could not be updated", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"parentCoachStatus": input.ParentCoachStatus})
}

func (s *server) teams(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	var input struct {
		Name    string `json:"name"`
		City    string `json:"city"`
		Country string `json:"country"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		http.Error(w, "invalid team details", http.StatusBadRequest)
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.City = strings.TrimSpace(input.City)
	input.Country = strings.TrimSpace(input.Country)
	if len(input.Name) < 2 || len(input.Name) > 80 || len(input.City) > 80 || len(input.Country) > 60 {
		http.Error(w, "team name and location are invalid", http.StatusUnprocessableEntity)
		return
	}
	userID := r.Context().Value(userIDKey{}).(string)
	var teamID string
	err := s.db.QueryRow(r.Context(), `
		INSERT INTO teams(owner_id, name, city, country)
		VALUES($1, $2, NULLIF($3, ''), NULLIF($4, ''))
		RETURNING id::TEXT
	`, userID, input.Name, input.City, input.Country).Scan(&teamID)
	if err != nil {
		http.Error(w, "team could not be created", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": teamID, "name": input.Name})
}

func (s *server) userFollow(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/users/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 || parts[1] != "follow" {
		http.Error(w, "route not found", http.StatusNotFound)
		return
	}
	targetUUID := strings.TrimSpace(parts[0])
	clerkID := r.Context().Value(userIDKey{}).(string)
	var followerID, followingID string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&followerID); err != nil {
		http.Error(w, "current player not found", http.StatusNotFound)
		return
	}
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE player_uuid=$1`, targetUUID).Scan(&followingID); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		http.Error(w, "could not update follow", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())
	switch r.Method {
	case http.MethodPost:
		tag, err := tx.Exec(r.Context(), `
			INSERT INTO user_follows(follower_id, following_id)
			VALUES($1::UUID,$2::UUID)
			ON CONFLICT DO NOTHING
		`, followerID, followingID)
		if err != nil {
			http.Error(w, "could not follow player", http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() > 0 {
			if _, err := tx.Exec(r.Context(), `UPDATE users SET following_count=following_count+1 WHERE id=$1::UUID`, followerID); err != nil {
				http.Error(w, "could not update follower count", http.StatusInternalServerError)
				return
			}
			if _, err := tx.Exec(r.Context(), `UPDATE users SET followers_count=followers_count+1 WHERE id=$1::UUID`, followingID); err != nil {
				http.Error(w, "could not update follower count", http.StatusInternalServerError)
				return
			}
		}
	case http.MethodDelete:
		tag, err := tx.Exec(r.Context(), `DELETE FROM user_follows WHERE follower_id=$1::UUID AND following_id=$2::UUID`, followerID, followingID)
		if err != nil {
			http.Error(w, "could not unfollow player", http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() > 0 {
			if _, err := tx.Exec(r.Context(), `UPDATE users SET following_count=GREATEST(following_count-1,0) WHERE id=$1::UUID`, followerID); err != nil {
				http.Error(w, "could not update follower count", http.StatusInternalServerError)
				return
			}
			if _, err := tx.Exec(r.Context(), `UPDATE users SET followers_count=GREATEST(followers_count-1,0) WHERE id=$1::UUID`, followingID); err != nil {
				http.Error(w, "could not update follower count", http.StatusInternalServerError)
				return
			}
		}
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "could not save follow", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *server) profileViews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var input struct {
		PlayerUUID string `json:"playerUuid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.PlayerUUID) == "" {
		http.Error(w, "playerUuid is required", http.StatusBadRequest)
		return
	}
	clerkID := r.Context().Value(userIDKey{}).(string)
	var viewerID, viewedID, privacy string
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT FROM users WHERE clerk_id=$1`, clerkID).Scan(&viewerID); err != nil {
		http.Error(w, "current player not found", http.StatusNotFound)
		return
	}
	if err := s.db.QueryRow(r.Context(), `SELECT id::TEXT, stats_privacy FROM users WHERE player_uuid=$1`, input.PlayerUUID).Scan(&viewedID, &privacy); err != nil {
		http.Error(w, "player not found", http.StatusNotFound)
		return
	}
	if viewerID != viewedID {
		_, _ = s.db.Exec(r.Context(), `INSERT INTO profile_views(viewer_id, viewed_user_id) VALUES($1::UUID,$2::UUID)`, viewerID, viewedID)
	}
	writeJSON(w, http.StatusCreated, map[string]string{"playerUuid": input.PlayerUUID, "statsPrivacy": privacy})
}

func (s *server) profileViewsMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	clerkID := r.Context().Value(userIDKey{}).(string)
	rows, err := s.db.Query(r.Context(), `
		SELECT u.player_uuid, u.display_name, pv.created_at
		FROM profile_views pv
		JOIN users u ON u.id=pv.viewer_id
		JOIN users me ON me.id=pv.viewed_user_id
		WHERE me.clerk_id=$1
		ORDER BY pv.created_at DESC LIMIT 50
	`, clerkID)
	if err != nil {
		http.Error(w, "profile viewers could not be loaded", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var playerUUID, displayName string
		var viewedAt time.Time
		if err := rows.Scan(&playerUUID, &displayName, &viewedAt); err != nil {
			http.Error(w, "profile viewers could not be loaded", http.StatusInternalServerError)
			return
		}
		result = append(result, map[string]any{"playerUuid": playerUUID, "displayName": displayName, "viewedAt": viewedAt})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *server) ensureElevenUser(w http.ResponseWriter, r *http.Request) {
	clerkID := r.Context().Value(userIDKey{}).(string)
	if r.Method == http.MethodPatch {
		r.Body = http.MaxBytesReader(w, r.Body, 8192)
		var input struct {
			Username     string `json:"username"`
			DisplayName  string `json:"displayName"`
			Position     string `json:"position"`
			DarkMode     *bool  `json:"darkMode"`
			StatsPrivacy string `json:"statsPrivacy"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid settings", http.StatusBadRequest)
			return
		}
		input.Username = strings.TrimSpace(input.Username)
		input.DisplayName = strings.TrimSpace(input.DisplayName)
		if len(input.Username) < 3 || len(input.Username) > 80 || len(input.DisplayName) > 100 {
			http.Error(w, "invalid profile settings", http.StatusBadRequest)
			return
		}
		if input.StatsPrivacy != "EVERYONE" && input.StatsPrivacy != "SQUAD_ONLY" && input.StatsPrivacy != "FRIENDS_ONLY" {
			http.Error(w, "invalid stats privacy", http.StatusBadRequest)
			return
		}
		darkMode := true
		if input.DarkMode != nil {
			darkMode = *input.DarkMode
		}
		_, err := s.db.Exec(r.Context(), `
			UPDATE users SET username=$2, display_name=$3,
				position=NULLIF($4,''), dark_mode=$5, stats_privacy=$6, updated_at=NOW()
			WHERE clerk_id=$1
		`, clerkID, input.Username, input.DisplayName, strings.TrimSpace(input.Position), darkMode, input.StatsPrivacy)
		if err != nil {
			http.Error(w, "settings could not be saved", http.StatusUnprocessableEntity)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var id, playerUUID, username, displayName, position, avatarURL string
	var followersCount, followingCount int64
	var darkMode bool
	var statsPrivacy string
	err := s.db.QueryRow(r.Context(), `
		SELECT id::TEXT, player_uuid, username, display_name,
			COALESCE(position, ''), COALESCE(avatar_url, ''),
			followers_count, following_count, dark_mode, stats_privacy
		FROM users WHERE clerk_id=$1
	`, clerkID).Scan(&id, &playerUUID, &username, &displayName, &position, &avatarURL,
		&followersCount, &followingCount, &darkMode, &statsPrivacy)
	if errors.Is(err, pgx.ErrNoRows) {
		playerUUID, err = s.createElevenUser(r.Context(), clerkID, "", "", "")
		if err != nil {
			http.Error(w, "Eleven profile could not be created", http.StatusInternalServerError)
			return
		}
		err = s.db.QueryRow(r.Context(), `
			SELECT id::TEXT, player_uuid, username, display_name,
				COALESCE(position, ''), COALESCE(avatar_url, ''),
				followers_count, following_count, dark_mode, stats_privacy
			FROM users WHERE clerk_id=$1
		`, clerkID).Scan(&id, &playerUUID, &username, &displayName, &position, &avatarURL,
			&followersCount, &followingCount, &darkMode, &statsPrivacy)
	}
	if err != nil {
		http.Error(w, "Eleven profile could not be loaded", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": id, "clerkId": clerkID, "playerUuid": playerUUID, "username": username,
		"displayName": displayName, "position": position, "avatarUrl": avatarURL,
		"followersCount": followersCount, "followingCount": followingCount,
		"darkMode": darkMode, "statsPrivacy": statsPrivacy,
	})
}

func (s *server) createElevenUser(ctx context.Context, clerkID, username, displayName, avatarURL string) (string, error) {
	if strings.TrimSpace(username) == "" {
		username = "eleven_" + strings.ToLower(strings.ReplaceAll(clerkID, "_", ""))
	}
	if len(username) > 80 {
		username = username[:80]
	}
	if strings.TrimSpace(displayName) == "" {
		displayName = "ELEVEN Player"
	}
	for attempt := 0; attempt < 12; attempt++ {
		var numberBytes [8]byte
		if _, err := rand.Read(numberBytes[:]); err != nil {
			return "", err
		}
		n := 30000 + int(binary.LittleEndian.Uint64(numberBytes[:])%70000)
		playerUUID := fmt.Sprintf("ELE%d", n)
		_, err := s.db.Exec(ctx, `
			INSERT INTO users(clerk_id, player_uuid, username, display_name, avatar_url)
			VALUES($1,$2,$3,$4,NULLIF($5,''))
			ON CONFLICT(clerk_id) DO UPDATE SET
				username=EXCLUDED.username,
				display_name=EXCLUDED.display_name,
				avatar_url=EXCLUDED.avatar_url,
				updated_at=NOW()
		`, clerkID, playerUUID, username, displayName, avatarURL)
		if err == nil {
			return playerUUID, nil
		}
	}
	return "", fmt.Errorf("could not generate a unique ELE player UUID")
}

func (s *server) clerkWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid webhook body", http.StatusBadRequest)
		return
	}
	if !verifyClerkWebhook(r, body) {
		http.Error(w, "invalid webhook signature", http.StatusUnauthorized)
		return
	}
	var event struct {
		Type string `json:"type"`
		Data struct {
			ID             string `json:"id"`
			Username       string `json:"username"`
			FirstName      string `json:"first_name"`
			LastName       string `json:"last_name"`
			ImageURL       string `json:"image_url"`
			EmailAddresses []struct {
				EmailAddress string `json:"email_address"`
			} `json:"email_addresses"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "invalid webhook event", http.StatusBadRequest)
		return
	}
	switch event.Type {
	case "user.created", "user.updated":
		username := strings.TrimSpace(event.Data.Username)
		if username == "" && len(event.Data.EmailAddresses) > 0 {
			username = strings.Split(event.Data.EmailAddresses[0].EmailAddress, "@")[0]
		}
		displayName := strings.TrimSpace(strings.Join([]string{event.Data.FirstName, event.Data.LastName}, " "))
		if displayName == "" {
			displayName = username
		}
		if _, err := s.createElevenUser(r.Context(), event.Data.ID, username, displayName, event.Data.ImageURL); err != nil {
			log.Printf("sync Clerk user: %v", err)
			http.Error(w, "user could not be synchronized", http.StatusInternalServerError)
			return
		}
	case "user.deleted":
		_, _ = s.db.Exec(r.Context(), `DELETE FROM users WHERE clerk_id=$1`, event.Data.ID)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"received": true})
}

func verifyClerkWebhook(r *http.Request, body []byte) bool {
	secret := strings.TrimSpace(os.Getenv("CLERK_WEBHOOK_SIGNING_SECRET"))
	if secret == "" {
		return false
	}
	if strings.HasPrefix(secret, "whsec_") {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
		if err == nil {
			secretBytes := decoded
			return verifySvixSignature(r, body, secretBytes)
		}
	}
	return verifySvixSignature(r, body, []byte(secret))
}

func verifySvixSignature(r *http.Request, body, secret []byte) bool {
	id := r.Header.Get("svix-id")
	timestamp := r.Header.Get("svix-timestamp")
	signatureHeader := r.Header.Get("svix-signature")
	if id == "" || timestamp == "" || signatureHeader == "" {
		return false
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(id + "." + timestamp + "."))
	_, _ = mac.Write(body)
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	for _, signature := range strings.Fields(signatureHeader) {
		signature = strings.TrimPrefix(signature, "v1,")
		if hmac.Equal([]byte(signature), []byte(expected)) {
			return true
		}
	}
	return false
}

func (s *server) search(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(query) < 1 || len(query) > 80 {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	pattern := "%" + strings.ToLower(query) + "%"
	rows, err := s.db.Query(r.Context(), `
		SELECT 'player'::TEXT, user_id, full_name, COALESCE(nickname, ''), primary_position
		FROM player_profiles
		WHERE LOWER(full_name) LIKE $1 OR LOWER(COALESCE(nickname, '')) LIKE $1 OR LOWER(primary_position) LIKE $1
		UNION ALL
		SELECT 'team'::TEXT, id::TEXT, name, '', COALESCE(city, '')
		FROM teams
		WHERE LOWER(name) LIKE $1 OR LOWER(COALESCE(city, '')) LIKE $1
		LIMIT 50
	`, pattern)
	if err != nil {
		http.Error(w, "search failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	result := []map[string]string{}
	for rows.Next() {
		var kind, id, name, nickname, detail string
		if err := rows.Scan(&kind, &id, &name, &nickname, &detail); err != nil {
			http.Error(w, "search failed", http.StatusInternalServerError)
			return
		}
		result = append(result, map[string]string{"kind": kind, "id": id, "name": name, "nickname": nickname, "detail": detail})
	}
	writeJSON(w, http.StatusOK, result)
}
