// Command api es el punto de entrada del servicio.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"triomision/api/internal/auth"
	"triomision/api/internal/config"
	"triomision/api/internal/database"
	"triomision/api/internal/server"
	"triomision/api/internal/storage"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("configuración inválida", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("no se pudo conectar a PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	objects, err := storage.New(ctx, cfg.S3)
	if err != nil {
		slog.Error("no se pudo configurar el almacenamiento S3", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.New(cfg, db, auth.NewValidator(cfg.JWTSecret, cfg.JWTAudience), objects),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("API escuchando",
			"addr", srv.Addr,
			"env", cfg.Env,
			"docs", "http://localhost:"+cfg.Port+"/docs",
		)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		slog.Info("apagando la API...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			slog.Error("error al apagar", "error", err)
			os.Exit(1)
		}
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			slog.Error("error del servidor", "error", err)
			os.Exit(1)
		}
	}
}
