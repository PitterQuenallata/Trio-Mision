// Package config carga la configuración de la API desde variables de entorno.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Config contiene toda la configuración del servicio.
type Config struct {
	// Env es el entorno de ejecución: development, test, production.
	Env string
	// Port es el puerto HTTP de escucha.
	Port string
	// DatabaseURL es la cadena de conexión a PostgreSQL.
	DatabaseURL string
	// JWTSecret es el secreto HS256 compartido con GoTrue.
	JWTSecret string
	// JWTAudience es la audiencia esperada del token (GoTrue: "authenticated").
	JWTAudience string
	// S3 contiene la configuración del almacenamiento compatible con S3
	// (MinIO en desarrollo). Vacía cuando el servicio no la necesita.
	S3 S3Config
}

// S3Config describe el almacenamiento de objetos (media privada, previews
// públicos y comprobantes). Las credenciales viven solo en el entorno.
type S3Config struct {
	Endpoint   string
	Region     string
	Bucket     string
	AccessKey  string
	SecretKey  string
	PublicBase string // base URL pública del bucket (previews)
	PresignTTL time.Duration
}

// Load lee las variables de entorno y valida las obligatorias.
func Load() (Config, error) {
	presignTTL, err := time.ParseDuration(getEnv("S3_PRESIGN_TTL", "15m"))
	if err != nil {
		return Config{}, fmt.Errorf("S3_PRESIGN_TTL inválido: %w", err)
	}
	cfg := Config{
		Env:         getEnv("API_ENV", "development"),
		Port:        getEnv("API_PORT", "8080"),
		DatabaseURL: os.Getenv("API_DATABASE_URL"),
		JWTSecret:   os.Getenv("GOTRUE_JWT_SECRET"),
		JWTAudience: getEnv("GOTRUE_JWT_AUDIENCE", "authenticated"),
		S3: S3Config{
			Endpoint:   os.Getenv("S3_ENDPOINT"),
			Region:     getEnv("S3_REGION", "us-east-1"),
			Bucket:     os.Getenv("S3_BUCKET"),
			AccessKey:  os.Getenv("S3_ACCESS_KEY"),
			SecretKey:  os.Getenv("S3_SECRET_KEY"),
			PublicBase: strings.TrimRight(os.Getenv("S3_PUBLIC_BASE_URL"), "/"),
			PresignTTL: presignTTL,
		},
	}

	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("API_DATABASE_URL es requerida"))
	}
	if cfg.JWTSecret == "" {
		errs = append(errs, errors.New("GOTRUE_JWT_SECRET es requerida"))
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
