// Package config carga la configuración del worker desde el entorno (el mismo
// .env raíz que la API: comparten solo PostgreSQL y MinIO).
package config

import (
	"errors"
	"fmt"
	"os"
	"time"
)

// Config del worker.
type Config struct {
	// DatabaseURL es la cadena de conexión a PostgreSQL. El worker comparte la
	// cuenta api_app con la API (decisión documentada en README): WORKER_DATABASE_URL
	// permite separarla en el futuro sin cambios de código.
	DatabaseURL string
	// PollInterval es el intervalo entre rondas de la cola cuando no hay jobs.
	PollInterval time.Duration
	// S3 es el almacenamiento de objetos (mismas variables que la API).
	S3 S3Config
}

// S3Config describe el almacenamiento compatible con S3 (MinIO en desarrollo).
type S3Config struct {
	Endpoint  string
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
}

// Load lee la configuración y valida lo obligatorio.
func Load() (Config, error) {
	poll, err := time.ParseDuration(getEnv("WORKER_POLL_INTERVAL", "5s"))
	if err != nil {
		return Config{}, fmt.Errorf("WORKER_POLL_INTERVAL inválido: %w", err)
	}
	dbURL := os.Getenv("WORKER_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("API_DATABASE_URL")
	}
	cfg := Config{
		DatabaseURL:  dbURL,
		PollInterval: poll,
		S3: S3Config{
			Endpoint:  os.Getenv("S3_ENDPOINT"),
			Region:    getEnv("S3_REGION", "us-east-1"),
			Bucket:    os.Getenv("S3_BUCKET"),
			AccessKey: os.Getenv("S3_ACCESS_KEY"),
			SecretKey: os.Getenv("S3_SECRET_KEY"),
		},
	}
	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("API_DATABASE_URL (o WORKER_DATABASE_URL) es requerida"))
	}
	if cfg.S3.Endpoint == "" || cfg.S3.Bucket == "" || cfg.S3.AccessKey == "" || cfg.S3.SecretKey == "" {
		errs = append(errs, errors.New("configuración S3 incompleta: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY y S3_SECRET_KEY son requeridos"))
	}
	if len(errs) > 0 {
		return Config{}, fmt.Errorf("configuración incompleta: %w", errors.Join(errs...))
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
