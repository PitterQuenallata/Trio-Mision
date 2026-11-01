// Package queue implementa la cola de trabajos sobre PostgreSQL: la tabla
// media_jobs ES la cola (sin infraestructura nueva). El claiming es atómico
// con FOR UPDATE SKIP LOCKED: dos workers nunca toman el mismo job.
package queue

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Queue opera sobre media_jobs/media_job_assets.
type Queue struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Queue { return &Queue{pool: pool} }

// Claim toma atómicamente el job encolado más antiguo y lo pasa a running.
// ok es false cuando la cola está vacía.
func (q *Queue) Claim(ctx context.Context) (jobID string, ok bool, err error) {
	err = q.pool.QueryRow(ctx, `
		update media_jobs
		set status = 'running', started_at = now(), progress = 0, error_code = null
		where id = (
			select id from media_jobs
			where status = 'queued'
			order by created_at asc
			limit 1
			for update skip locked
		)
		returning id`).Scan(&jobID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("reclamar job: %w", err)
	}
	return jobID, true, nil
}

// InputAsset devuelve la clave del objeto de entrada (el PDF) del job.
func (q *Queue) InputAsset(ctx context.Context, jobID string) (storageKey, mimeType string, byteSize int64, err error) {
	err = q.pool.QueryRow(ctx, `
		select a.storage_key, a.mime_type, a.byte_size
		from media_job_assets jma
		join media_assets a on a.id = jma.media_asset_id
		where jma.media_job_id = $1 and jma.input_output_role = 'input'`, jobID,
	).Scan(&storageKey, &mimeType, &byteSize)
	if err != nil {
		return "", "", 0, fmt.Errorf("consultar activo de entrada del job %s: %w", jobID, err)
	}
	return storageKey, mimeType, byteSize, nil
}

// FinishDone marca el job como done con su resultado (misma tx).
func (q *Queue) FinishDone(ctx context.Context, jobID, toolVersion string, resultJSON []byte) error {
	_, err := q.pool.Exec(ctx, `
		update media_jobs
		set status = 'done', progress = 100, result_json = $2, tool_version = $3, completed_at = now()
		where id = $1`, jobID, resultJSON, toolVersion)
	if err != nil {
		return fmt.Errorf("marcar job %s como done: %w", jobID, err)
	}
	return nil
}

// FinishFailed marca el job como failed con un error_code estable.
func (q *Queue) FinishFailed(ctx context.Context, jobID, errorCode string) error {
	_, err := q.pool.Exec(ctx, `
		update media_jobs
		set status = 'failed', error_code = $2, completed_at = now()
		where id = $1`, jobID, errorCode)
	if err != nil {
		return fmt.Errorf("marcar job %s como failed: %w", jobID, err)
	}
	return nil
}
