// Package config carga la configuración de la API desde variables de entorno.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
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
	// GoTrueURL es la URL base de GoTrue (administración de cuentas staff).
	GoTrueURL string
	// S3 contiene la configuración del almacenamiento compatible con S3
	// (MinIO en desarrollo). Vacía cuando el servicio no la necesita.
	S3 S3Config
	// FCM describe el envío de notificaciones push. Opcional: sin ella la API
	// arranca y el envío responde 503 (no configurado).
	FCM FCMConfig
	// RateLimit limita peticiones por IP (token bucket por instancia).
	RateLimit RateLimitConfig
}

// RateLimitConfig: límite por usuario autenticado (o por IP si es anónimo) y
// techo por IP para cualquier petición.
type RateLimitConfig struct {
	RPS     float64
	Burst   int
	IPRPS   float64
	IPBurst int
}

// FCMConfig describe Firebase Cloud Messaging (HTTP v1). Las credenciales de
// la cuenta de servicio viven fuera del repo (ruta por entorno).
type FCMConfig struct {
	ProjectID       string
	CredentialsFile string
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
		GoTrueURL:   getEnv("GOTRUE_URL", "http://127.0.0.1:9999"),
		S3: S3Config{
			Endpoint:   os.Getenv("S3_ENDPOINT"),
			Region:     getEnv("S3_REGION", "us-east-1"),
			Bucket:     os.Getenv("S3_BUCKET"),
			AccessKey:  os.Getenv("S3_ACCESS_KEY"),
			SecretKey:  os.Getenv("S3_SECRET_KEY"),
			PublicBase: strings.TrimRight(os.Getenv("S3_PUBLIC_BASE_URL"), "/"),
			PresignTTL: presignTTL,
		},
		RateLimit: RateLimitConfig{
			RPS:     getEnvFloat("API_RATE_LIMIT_RPS", 20),
			Burst:   getEnvInt("API_RATE_LIMIT_BURST", 60),
			IPRPS:   getEnvFloat("API_RATE_LIMIT_IP_RPS", 100),
			IPBurst: getEnvInt("API_RATE_LIMIT_IP_BURST", 300),
		},
		FCM: FCMConfig{
			ProjectID:       os.Getenv("FCM_PROJECT_ID"),
			CredentialsFile: os.Getenv("FCM_CREDENTIALS_FILE"),
		},
	}

	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("API_DATABASE_URL es requerida"))
	}
	if cfg.JWTSecret == "" {
		errs = append(errs, errors.New("GOTRUE_JWT_SECRET es requerida"))
	}
	if cfg.RateLimit.RPS <= 0 || cfg.RateLimit.Burst <= 0 || cfg.RateLimit.IPRPS <= 0 || cfg.RateLimit.IPBurst <= 0 {
		errs = append(errs, errors.New("los límites de tasa (API_RATE_LIMIT_*) deben ser mayores que 0"))
	}
	if (cfg.FCM.ProjectID == "") != (cfg.FCM.CredentialsFile == "") {
		errs = append(errs, errors.New("FCM_PROJECT_ID y FCM_CREDENTIALS_FILE deben configurarse juntas"))
	}
	if len(errs) > 0 {
		return Config{}, fmt.Errorf("configuración incompleta: %w", errors.Join(errs...))
	}
	return cfg, nil
}

func getEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
		return -1 // inválido: la validación de Load lo rechaza
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
		return -1
	}
	return fallback
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
