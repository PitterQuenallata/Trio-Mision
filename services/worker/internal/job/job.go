// Package job procesa un media_job pdf_chordpro: descarga el PDF de MinIO,
// extrae el texto posicionado (pdftotext -bbox), convierte a ChordPro con el
// algoritmo determinista y persiste el resultado en el job. El worker JAMÁS
// escribe en el catálogo: solo llena result_json; la publicación (borrador,
// tras revisión humana) es exclusiva de la API.
package job

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"triomision/worker/internal/convert"
	"triomision/worker/internal/extract"
	"triomision/worker/internal/queue"
	"triomision/worker/internal/store"
)

// ToolVersion identifica la versión del conversor (constante del worker);
// queda registrada en media_jobs.tool_version de cada job procesado.
const ToolVersion = "pdfchordpro-go/1"

// Códigos de error estables para media_jobs.error_code.
const (
	ErrCodePDFInvalido     = "pdf_invalido"
	ErrCodeSinTexto        = "sin_texto_extraible"
	ErrCodeEntradaFaltante = "entrada_faltante"
	ErrCodeErrorInterno    = "error_interno"
)

// resultado es la forma de result_json que el worker persiste y la API enriquece.
type resultado struct {
	ToolVersion    string            `json:"tool_version"`
	TotalCanciones int               `json:"total_canciones"`
	Canciones      []convert.Cancion `json:"canciones"`
	Publicados     []json.RawMessage `json:"publicados"`
}

// Process ejecuta un job ya reclamado (status running). Todo camino de error
// deja el job failed con su error_code; los errores no clasificados se
// reportan también al caller para el log.
func Process(ctx context.Context, q *queue.Queue, objects *store.S3Store, log *slog.Logger, jobID string) error {
	fail := func(code string, err error) error {
		if ferr := q.FinishFailed(ctx, jobID, code); ferr != nil {
			log.Error("no se pudo marcar el job como failed", "job", jobID, "error", ferr)
		}
		return err
	}

	storageKey, mimeType, byteSize, err := q.InputAsset(ctx, jobID)
	if err != nil {
		return fail(ErrCodeEntradaFaltante, fmt.Errorf("job %s: %w", jobID, err))
	}
	log.Info("procesando job", "job", jobID, "key", storageKey, "mime", mimeType, "bytes", byteSize)

	tmpPDF := filepath.Join(os.TempDir(), "triomision-import-"+jobID+".pdf")
	defer os.Remove(tmpPDF)
	if err := objects.DownloadToFile(ctx, storageKey, tmpPDF); err != nil {
		return fail(ErrCodeEntradaFaltante, fmt.Errorf("job %s: descargar entrada: %w", jobID, err))
	}

	items, err := extract.Extract(ctx, tmpPDF)
	if err != nil {
		switch {
		case errors.Is(err, extract.ErrSinTexto):
			return fail(ErrCodeSinTexto, fmt.Errorf("job %s: %w", jobID, err))
		default:
			return fail(ErrCodePDFInvalido, fmt.Errorf("job %s: extraer texto: %w", jobID, err))
		}
	}

	songs := convert.SongsFromLines(convert.ItemsToLines(items))
	res := resultado{
		ToolVersion:    ToolVersion,
		TotalCanciones: len(songs),
		Canciones:      songs,
		Publicados:     []json.RawMessage{},
	}
	if songs == nil {
		res.Canciones = []convert.Cancion{}
	}
	resultJSON, err := json.Marshal(res)
	if err != nil {
		return fail(ErrCodeErrorInterno, fmt.Errorf("job %s: serializar resultado: %w", jobID, err))
	}
	if err := q.FinishDone(ctx, jobID, ToolVersion, resultJSON); err != nil {
		return fmt.Errorf("job %s: marcar done: %w", jobID, err)
	}
	log.Info("job completado", "job", jobID, "canciones", len(songs))
	return nil
}
