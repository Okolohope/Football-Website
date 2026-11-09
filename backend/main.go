package main

import (
	"context"
	"encoding/json"
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
	mux.Handle("/api/player/profile", s.withSecurity(s.requireAuth(http.HandlerFunc(s.upsertProfile))))
	mux.Handle("/api/player/avatar", s.withSecurity(s.requireAuth(http.HandlerFunc(s.uploadAvatar))))
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
		w.Header().Set("Access-Control-Allow-Methods", "POST, PUT, OPTIONS")
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

func (s *server) upsertProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
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
			 preferred_foot, playing_level, years_playing, bio, playing_style, strengths, ambitions, languages, avatar_key)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, ''), $13, $14, NULLIF($15, ''), $16, NULLIF($17, ''))
		ON CONFLICT (user_id) DO UPDATE SET
			full_name = EXCLUDED.full_name, nickname = EXCLUDED.nickname, age_group = EXCLUDED.age_group,
			country = EXCLUDED.country, city = EXCLUDED.city, gender = EXCLUDED.gender,
			primary_position = EXCLUDED.primary_position, preferred_foot = EXCLUDED.preferred_foot,
			playing_level = EXCLUDED.playing_level, years_playing = EXCLUDED.years_playing,
			bio = EXCLUDED.bio, playing_style = EXCLUDED.playing_style, strengths = EXCLUDED.strengths,
			ambitions = EXCLUDED.ambitions, languages = EXCLUDED.languages, avatar_key = EXCLUDED.avatar_key, updated_at = NOW()
	`, userID, profile.FullName, profile.Nickname, profile.AgeGroup, profile.Country, profile.City,
		profile.Gender, profile.PrimaryPosition, profile.PreferredFoot, profile.PlayingLevel,
		profile.YearsPlaying, profile.Bio, profile.PlayingStyle, profile.Strengths, profile.Ambitions, profile.Languages, profile.AvatarKey)
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
