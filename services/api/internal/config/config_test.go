package config

import (
	"testing"
)

func TestLoadOK(t *testing.T) {
	t.Setenv("API_DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("GOTRUE_JWT_SECRET", "secreto")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, se esperaba el default 8080", cfg.Port)
	}
	if cfg.JWTAudience != "authenticated" {
		t.Errorf("JWTAudience = %q, se esperaba el default authenticated", cfg.JWTAudience)
	}
	if cfg.Env != "development" {
		t.Errorf("Env = %q, se esperaba development", cfg.Env)
	}
}

func TestLoadFaltanRequeridas(t *testing.T) {
	t.Setenv("API_DATABASE_URL", "")
	t.Setenv("GOTRUE_JWT_SECRET", "")

	if _, err := Load(); err == nil {
		t.Fatal("Load() debería fallar sin las variables requeridas")
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Setenv("API_DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("GOTRUE_JWT_SECRET", "secreto")
	t.Setenv("API_PORT", "9090")
	t.Setenv("API_ENV", "production")
	t.Setenv("GOTRUE_JWT_AUDIENCE", "custom-aud")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Port != "9090" || cfg.Env != "production" || cfg.JWTAudience != "custom-aud" {
		t.Errorf("overrides no aplicados: %+v", cfg)
	}
}

func TestLoadS3(t *testing.T) {
	t.Setenv("API_DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("GOTRUE_JWT_SECRET", "secreto")
	t.Setenv("S3_ENDPOINT", "http://localhost:9000")
	t.Setenv("S3_BUCKET", "media")
	t.Setenv("S3_ACCESS_KEY", "ak")
	t.Setenv("S3_SECRET_KEY", "sk")
	t.Setenv("S3_PUBLIC_BASE_URL", "http://localhost:9000/media/")
	t.Setenv("S3_PRESIGN_TTL", "10m")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.S3.Endpoint != "http://localhost:9000" || cfg.S3.Bucket != "media" ||
		cfg.S3.AccessKey != "ak" || cfg.S3.SecretKey != "sk" {
		t.Errorf("config S3 incompleta: %+v", cfg.S3)
	}
	if cfg.S3.Region != "us-east-1" {
		t.Errorf("Region = %q, se esperaba el default us-east-1", cfg.S3.Region)
	}
	// PublicBase se normaliza sin barra final.
	if cfg.S3.PublicBase != "http://localhost:9000/media" {
		t.Errorf("PublicBase = %q", cfg.S3.PublicBase)
	}
	if cfg.S3.PresignTTL.Minutes() != 10 {
		t.Errorf("PresignTTL = %v", cfg.S3.PresignTTL)
	}
}

func TestLoadS3PresignTTLInvalido(t *testing.T) {
	t.Setenv("API_DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("GOTRUE_JWT_SECRET", "secreto")
	t.Setenv("S3_PRESIGN_TTL", "no-es-duracion")

	if _, err := Load(); err == nil {
		t.Fatal("Load() debería fallar con S3_PRESIGN_TTL inválido")
	}
}
