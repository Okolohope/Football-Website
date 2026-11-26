package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type objectStorage struct {
	client *s3.Client
	bucket string
}

func newObjectStorage(ctx context.Context) (*objectStorage, error) {
	bucket := os.Getenv("NEON_STORAGE_BUCKET")
	endpoint := os.Getenv("AWS_ENDPOINT_URL_S3")
	if bucket == "" || endpoint == "" {
		return nil, nil
	}

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("load object storage configuration: %w", err)
	}
	cfg.Region = os.Getenv("AWS_REGION")
	// Neon Object Storage does not implement the optional checksum headers
	// emitted by the AWS SDK for otherwise ordinary PutObject requests.
	cfg.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
	client := s3.NewFromConfig(cfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(endpoint)
		options.UsePathStyle = true
	})
	return &objectStorage{client: client, bucket: bucket}, nil
}

func (storage *objectStorage) uploadAvatar(ctx context.Context, userID string, file io.Reader, contentType string) (string, error) {
	var suffix string
	switch contentType {
	case "image/jpeg":
		suffix = ".jpg"
	case "image/png":
		suffix = ".png"
	case "image/webp":
		suffix = ".webp"
	default:
		return "", fmt.Errorf("unsupported image type")
	}

	randomID := make([]byte, 12)
	if _, err := rand.Read(randomID); err != nil {
		return "", fmt.Errorf("create image identifier: %w", err)
	}
	key := filepath.ToSlash(filepath.Join("avatars", userID, hex.EncodeToString(randomID)+suffix))
	body, err := io.ReadAll(io.LimitReader(file, 5<<20))
	if err != nil {
		return "", fmt.Errorf("read avatar: %w", err)
	}
	_, err = storage.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(storage.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(body),
		ContentLength: aws.Int64(int64(len(body))),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("upload avatar: %w", err)
	}
	return key, nil
}

func (storage *objectStorage) avatarURL(ctx context.Context, key string) (string, error) {
	presigner := s3.NewPresignClient(storage.client)
	request, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(storage.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", fmt.Errorf("create avatar URL: %w", err)
	}
	return request.URL, nil
}

func imageContentType(file io.Reader) (io.Reader, string, error) {
	header := make([]byte, 512)
	count, err := file.Read(header)
	if err != nil && err != io.EOF {
		return nil, "", err
	}
	contentType := http.DetectContentType(header[:count])
	if !strings.HasPrefix(contentType, "image/") {
		return nil, "", fmt.Errorf("file must be an image")
	}
	return io.MultiReader(bytes.NewReader(header[:count]), file), contentType, nil
}
