// Worker de Trio Misión: toma media_jobs pdf_chordpro de la cola (PostgreSQL,
// FOR UPDATE SKIP LOCKED), convierte el PDF a ChordPro y persiste el resultado.
// Uso:
//
//	worker [--once] [--sleep 5s]
//
// --once procesa todos los jobs pendientes y sale (verificación automatizada);
// sin --once hace polling cada --sleep (o WORKER_POLL_INTERVAL).
package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"triomision/worker/internal/config"
	"triomision/worker/internal/extract"
	"triomision/worker/internal/job"
	"triomision/worker/internal/queue"
	"triomision/worker/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	once := flag.Bool("once", false, "procesa los jobs pendientes y sale")
	sleep := flag.Duration("sleep", 0, "intervalo entre rondas de la cola (sobreescribe WORKER_POLL_INTERVAL)")
	flag.Parse()

	if err := extract.CheckTool(); err != nil {
		log.Error("prerequisito faltante", "error", err)
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		log.Error("configuración", "error", err)
		os.Exit(1)
	}
	interval := cfg.PollInterval
	if *sleep > 0 {
		interval = *sleep
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("conectar a PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Error("ping a PostgreSQL", "error", err)
		os.Exit(1)
	}

	objects, err := store.New(ctx, cfg.S3)
	if err != nil {
		log.Error("cliente S3", "error", err)
		os.Exit(1)
	}

	q := queue.New(pool)
	log.Info("worker listo", "intervalo", interval.String(), "once", *once)

	processed := 0
	for {
		jobID, ok, err := q.Claim(ctx)
		if err != nil {
			log.Error("reclamar job", "error", err)
			if !wait(ctx, interval) {
				break
			}
			continue
		}
		if !ok {
			if *once {
				log.Info("cola vacía: sin jobs pendientes", "procesados", processed)
				break
			}
			if !wait(ctx, interval) {
				break
			}
			continue
		}
		processed++
		if err := job.Process(ctx, q, objects, log, jobID); err != nil {
			log.Error("job falló (quedó failed para reintento)", "job", jobID, "error", err)
		}
		if ctx.Err() != nil {
			break
		}
	}
	log.Info("apagando el worker", "procesados", processed)
}

// wait duerme el intervalo o devuelve false si el contexto se canceló.
func wait(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
