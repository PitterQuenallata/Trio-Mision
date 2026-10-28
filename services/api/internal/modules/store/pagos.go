package store

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// ── Intentos de pago ───────────────────────────────────────────────────────

type crearPagoInput struct {
	OrdenID string `path:"id" format:"uuid" doc:"ID de la orden"`
	Body    struct {
		Proveedor      string `json:"proveedor" enum:"qr,transfer" doc:"Método manual de pago"`
		MontoMinor     int64  `json:"monto_minor" minimum:"1" doc:"Importe transferido; debe coincidir con el total de la orden"`
		IdempotencyKey string `json:"idempotency_key" minLength:"8" maxLength:"128"`
		Referencia     string `json:"referencia,omitempty" maxLength:"128" doc:"Nro. de transacción o depósito, si existe"`
	}
}

type crearPagoOutput struct {
	Body pagoResumen
}

// crearPago registra el intento de pago manual de una orden propia. La clave
// idempotente tiene alcance en esa orden y un reintento debe repetir el payload.
func crearPago(db database.DB) func(ctx context.Context, in *crearPagoInput) (*crearPagoOutput, error) {
	return func(ctx context.Context, in *crearPagoInput) (*crearPagoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		var orderID, userID, status string
		var total int64
		var expiresAt *time.Time
		err := db.QueryRow(ctx, `
			select id, user_id, status, total_minor, expires_at from orders where id = $1`, in.OrdenID,
		).Scan(&orderID, &userID, &status, &total, &expiresAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("orden no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la orden", err)
		}
		if userID != claims.Subject {
			return nil, huma.Error404NotFound("orden no encontrada")
		}

		if existing, err := pagoPorClave(ctx, db, orderID, in.Body.IdempotencyKey); err == nil {
			return respuestaReintentoPago(existing, in)
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando el pago", err)
		}

		if status != "pending" {
			return nil, huma.Error409Conflict("la orden no admite pagos en su estado actual")
		}
		if expiresAt != nil && !expiresAt.After(time.Now()) {
			return nil, huma.Error409Conflict("la orden está vencida")
		}
		if in.Body.MontoMinor != total {
			return nil, huma.Error422UnprocessableEntity(
				fmt.Sprintf("el monto declarado (%d) no coincide con el total de la orden (%d)", in.Body.MontoMinor, total))
		}

		rawPayload := map[string]any{}
		if in.Body.Referencia != "" {
			rawPayload["referencia"] = in.Body.Referencia
		}

		var pago pagoResumen
		err = db.QueryRow(ctx, `
			insert into payment_attempts (order_id, provider, amount_minor, currency, idempotency_key, raw_payload)
			select $1, $2, o.total_minor, o.currency, $3, $4
			from orders o where o.id = $1
			returning id, provider, status, amount_minor, currency, created_at, confirmed_at`,
			orderID, in.Body.Proveedor, in.Body.IdempotencyKey, rawPayload,
		).Scan(&pago.ID, &pago.Proveedor, &pago.Estado, &pago.MontoMinor, &pago.Moneda, &pago.CreadoEn, &pago.ConfirmadoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				if existing, selErr := pagoPorClave(ctx, db, orderID, in.Body.IdempotencyKey); selErr == nil {
					return respuestaReintentoPago(existing, in)
				}
			}
			return nil, huma.Error500InternalServerError("error registrando el pago", err)
		}
		out := &crearPagoOutput{}
		out.Body = pago
		return out, nil
	}
}

type pagoIdempotente struct {
	pagoResumen
	referencia string
}

// pagoPorClave carga un intento solo dentro de la orden ya autorizada.
func pagoPorClave(ctx context.Context, db database.DB, orderID, clave string) (*pagoIdempotente, error) {
	var p pagoIdempotente
	err := db.QueryRow(ctx, `
		select id, provider, status, amount_minor, currency, created_at, confirmed_at,
		       coalesce(raw_payload->>'referencia', '')
		from payment_attempts where order_id = $1 and idempotency_key = $2`, orderID, clave,
	).Scan(&p.ID, &p.Proveedor, &p.Estado, &p.MontoMinor, &p.Moneda, &p.CreadoEn, &p.ConfirmadoEn, &p.referencia)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func respuestaReintentoPago(existing *pagoIdempotente, in *crearPagoInput) (*crearPagoOutput, error) {
	if existing.Proveedor != in.Body.Proveedor || existing.MontoMinor != in.Body.MontoMinor || existing.referencia != in.Body.Referencia {
		return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otros datos de pago")
	}
	out := &crearPagoOutput{}
	out.Body = existing.pagoResumen
	return out, nil
}

// comprobanteExt asocia la extensión de archivo al MIME permitido.
var comprobanteExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type urlComprobanteInput struct {
	PagoID string `path:"pagoId" format:"uuid"`
	Body   struct {
		MimeType string `json:"mime_type" enum:"image/jpeg,image/png,image/webp"`
	}
}

type urlComprobanteOutput struct {
	Body struct {
		StorageKey string            `json:"storage_key"`
		UploadURL  string            `json:"upload_url"`
		Fields     map[string]string `json:"fields" doc:"Campos obligatorios del formulario multipart POST"`
		ExpiraEn   time.Time         `json:"expira_en"`
	}
}

// urlComprobante firma un formulario POST limitado a 5 MiB para el comprobante.
// Solo el titular puede pedirlo y el objeto queda en el prefijo privado evidence/.
func urlComprobante(db database.DB, store storage.Client, ttl time.Duration) func(ctx context.Context, in *urlComprobanteInput) (*urlComprobanteOutput, error) {
	return func(ctx context.Context, in *urlComprobanteInput) (*urlComprobanteOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		pago, err := pagoDelUsuario(ctx, db, in.PagoID, claims.Subject)
		if err != nil {
			return nil, err
		}
		if pago.Estado != "awaiting_evidence" && pago.Estado != "in_review" {
			return nil, huma.Error409Conflict("el pago no admite comprobante en su estado actual")
		}

		ext := comprobanteExt[in.Body.MimeType]
		key := fmt.Sprintf("evidence/%s/comprobante%s", pago.ID, ext)
		upload, err := store.PresignPost(ctx, key, in.Body.MimeType, maxComprobanteBytes, ttl)
		if err != nil {
			return nil, huma.Error500InternalServerError("error firmando la subida", err)
		}

		out := &urlComprobanteOutput{}
		out.Body.StorageKey = key
		out.Body.UploadURL = upload.URL
		out.Body.Fields = upload.Fields
		out.Body.ExpiraEn = time.Now().Add(ttl)
		return out, nil
	}
}

const maxComprobanteBytes = 5 << 20

type confirmarComprobanteInput struct {
	PagoID string `path:"pagoId" format:"uuid"`
	Body   struct {
		StorageKey string `json:"storage_key" minLength:"8"`
		MimeType   string `json:"mime_type" enum:"image/jpeg,image/png,image/webp"`
		ByteSize   int64  `json:"byte_size" minimum:"1" maximum:"5242880"`
	}
}

type confirmarComprobanteOutput struct {
	Body struct {
		PagoID         string    `json:"pago_id"`
		Estado         string    `json:"estado"`
		ComprobanteKey string    `json:"comprobante_key"`
		SubidoEn       time.Time `json:"subido_en"`
	}
}

// confirmarComprobante registra el comprobante subido: verifica que el objeto
// existe en el almacén privado y que coincide tamaño y tipo declarados.
// Ningún archivo activa acceso: solo marca el intento como pendiente de revisión.
func confirmarComprobante(db database.DB, store storage.Client) func(ctx context.Context, in *confirmarComprobanteInput) (*confirmarComprobanteOutput, error) {
	return func(ctx context.Context, in *confirmarComprobanteInput) (*confirmarComprobanteOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		pago, err := pagoDelUsuario(ctx, db, in.PagoID, claims.Subject)
		if err != nil {
			return nil, err
		}
		if pago.Estado != "awaiting_evidence" {
			return nil, huma.Error409Conflict("ya existe un comprobante para este pago")
		}
		if !strings.HasPrefix(in.Body.StorageKey, fmt.Sprintf("evidence/%s/", pago.ID)) {
			return nil, huma.Error422UnprocessableEntity("la clave no corresponde a este pago")
		}

		size, contentType, err := store.Head(ctx, in.Body.StorageKey)
		if err != nil {
			return nil, huma.Error422UnprocessableEntity("no se encontró el comprobante en el almacén; súbelo con la URL firmada primero")
		}
		if size > maxComprobanteBytes {
			return nil, huma.Error422UnprocessableEntity("el comprobante supera el máximo de 5 MiB")
		}
		if size != in.Body.ByteSize || contentType != in.Body.MimeType {
			return nil, huma.Error422UnprocessableEntity("el tamaño o tipo del archivo no coincide con lo declarado")
		}

		var subidoEn time.Time
		err = db.QueryRow(ctx, `
			with nuevo_comprobante as (
				insert into payment_evidence (payment_attempt_id, private_storage_key)
				values ($1, $2)
				returning created_at
			)
			update payment_attempts set status = 'in_review'
			where id = $1
			returning (select created_at from nuevo_comprobante)`,
			pago.ID, in.Body.StorageKey).Scan(&subidoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un comprobante para este pago")
			}
			return nil, huma.Error500InternalServerError("error registrando el comprobante", err)
		}

		out := &confirmarComprobanteOutput{}
		out.Body.PagoID = pago.ID
		out.Body.Estado = "in_review"
		out.Body.ComprobanteKey = in.Body.StorageKey
		out.Body.SubidoEn = subidoEn
		return out, nil
	}
}

type subirComprobanteInput struct {
	PagoID  string `path:"pagoId" format:"uuid"`
	RawBody huma.MultipartFormFiles[struct {
		Archivo huma.FormFile `form:"file" required:"true"`
	}]
}

type subirComprobanteOutput struct {
	Body struct {
		PagoID         string    `json:"pago_id"`
		Estado         string    `json:"estado"`
		ComprobanteKey string    `json:"comprobante_key"`
		ByteSize       int64     `json:"byte_size"`
		SubidoEn       time.Time `json:"subido_en"`
	}
}

func subirComprobante(db database.DB, store storage.Client) func(context.Context, *subirComprobanteInput) (*subirComprobanteOutput, error) {
	return func(ctx context.Context, in *subirComprobanteInput) (*subirComprobanteOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		pago, err := pagoDelUsuario(ctx, db, in.PagoID, claims.Subject)
		if err != nil {
			return nil, err
		}
		if pago.Estado != "awaiting_evidence" {
			return nil, huma.Error409Conflict("ya existe un comprobante para este pago")
		}

		archivo := in.RawBody.Data().Archivo
		if archivo.Size > maxComprobanteBytes {
			return nil, huma.Error422UnprocessableEntity("el comprobante supera el máximo de 5 MiB")
		}
		header := make([]byte, 512)
		n, err := archivo.Read(header)
		if err != nil && !errors.Is(err, io.EOF) {
			return nil, huma.Error422UnprocessableEntity("no se pudo leer el comprobante")
		}
		if _, err := archivo.Seek(0, io.SeekStart); err != nil {
			return nil, huma.Error422UnprocessableEntity("no se pudo leer el comprobante")
		}
		mimeType := http.DetectContentType(header[:n])
		ext, allowed := comprobanteExt[mimeType]
		if !allowed {
			return nil, huma.Error422UnprocessableEntity("el contenido no es una imagen JPEG, PNG o WebP válida")
		}
		key := fmt.Sprintf("evidence/%s/comprobante%s", pago.ID, ext)
		if err := store.PutObject(ctx, key, mimeType, archivo); err != nil {
			return nil, huma.Error500InternalServerError("error guardando el comprobante", err)
		}

		var subidoEn time.Time
		err = db.QueryRow(ctx, `
			with nuevo_comprobante as (
				insert into payment_evidence (payment_attempt_id, private_storage_key)
				values ($1, $2)
				returning created_at
			)
			update payment_attempts set status = 'in_review'
			where id = $1
			returning (select created_at from nuevo_comprobante)`,
			pago.ID, key).Scan(&subidoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un comprobante para este pago")
			}
			return nil, huma.Error500InternalServerError("error registrando el comprobante", err)
		}

		out := &subirComprobanteOutput{}
		out.Body.PagoID = pago.ID
		out.Body.Estado = "in_review"
		out.Body.ComprobanteKey = key
		out.Body.ByteSize = archivo.Size
		out.Body.SubidoEn = subidoEn
		return out, nil
	}
}

// pagoDelUsuario carga un pago verificando que pertenece al usuario; 404 si no.
func pagoDelUsuario(ctx context.Context, db database.DB, pagoID, userID string) (*pagoResumen, error) {
	var p pagoResumen
	err := db.QueryRow(ctx, `
		select pa.id, pa.provider, pa.status, pa.amount_minor, pa.currency, pa.created_at, pa.confirmed_at
		from payment_attempts pa
		join orders o on o.id = pa.order_id
		where pa.id = $1 and o.user_id = $2`, pagoID, userID,
	).Scan(&p.ID, &p.Proveedor, &p.Estado, &p.MontoMinor, &p.Moneda, &p.CreadoEn, &p.ConfirmadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("pago no encontrado")
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando el pago", err)
	}
	return &p, nil
}
