// Package soporte implementa los tickets de soporte con mensajes y adjuntos
// privados: categorías pagos, descargas, permisos, reclamo YouTube y otro.
// Un ticket es visible solo para su titular y para staff; los adjuntos viven
// en MinIO (prefijo support/) y se entregan con URL firmada breve tras
// verificar acceso, nunca en logs. Los mensajes son append-only. Los reclamos
// YouTube exigen URL y claim ID (validación de API, no de dominio).
package soporte

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
	"triomision/api/internal/apierr"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// maxAdjuntoBytes es el máximo de los adjuntos de mensajes (5 MiB, como los
// comprobantes de la tienda).
const maxAdjuntoBytes = 5 << 20

// adjuntoExt asocia el MIME detectado por contenido a la extensión del
// adjunto (imágenes de captura/evidencia y PDFs).
var adjuntoExt = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

// Register registra los endpoints del titular bajo /api/v1/soporte.
func Register(api huma.API, db database.DB, objects storage.Client, presignTTL time.Duration) {
	huma.Register(api, huma.Operation{
		OperationID: "soporte-crear-ticket",
		Method:      http.MethodPost,
		Path:        "/api/v1/soporte/tickets",
		Summary:     "Abrir un ticket de soporte",
		Description: "Crea un ticket (pagos | descargas | permisos | reclamo_youtube | otro). Reclamo YouTube exige " +
			"youtube_url y youtube_claim_id (422 si faltan). order_id y license_grant_id referencian solo compras " +
			"propias (404 si son ajenas). Idempotente por (usuario, clave de cliente): repetir con el mismo payload " +
			"devuelve el ticket; con otro devuelve 409.",
		Tags:     []string{"soporte"},
		Security: []map[string][]string{{"bearer": {}}},
	}, crearTicket(db))

	huma.Register(api, huma.Operation{
		OperationID: "soporte-listar-tickets",
		Method:      http.MethodGet,
		Path:        "/api/v1/soporte/tickets",
		Summary:     "Mis tickets de soporte",
		Description: "Tickets del usuario con el conteo de mensajes, del más reciente al más antiguo. Solo el titular.",
		Tags:        []string{"soporte"},
		Security:    []map[string][]string{{"bearer": {}}},
	}, listarTickets(db))

	huma.Register(api, huma.Operation{
		OperationID: "soporte-obtener-ticket",
		Method:      http.MethodGet,
		Path:        "/api/v1/soporte/tickets/{id}",
		Summary:     "Detalle de un ticket propio",
		Description: "Ticket con sus mensajes; los adjuntos incluyen URL firmada breve. Ajeno o inexistente → 404.",
		Tags:        []string{"soporte"},
		Security:    []map[string][]string{{"bearer": {}}},
	}, obtenerTicket(db, objects, presignTTL))

	huma.Register(api, huma.Operation{
		OperationID: "soporte-agregar-mensaje",
		Method:      http.MethodPost,
		Path:        "/api/v1/soporte/tickets/{id}/mensajes",
		Summary:     "Responder un ticket (texto y adjunto opcional)",
		Description: "Multipart con cuerpo de texto y adjunto opcional (imagen JPEG/PNG/WebP o PDF, máximo 5 MiB). " +
			"No se permite en tickets cerrados (409). Auditoría ticket.mensaje.",
		MaxBodyBytes: maxAdjuntoBytes + 64*1024,
		Tags:         []string{"soporte"},
		Security:     []map[string][]string{{"bearer": {}}},
	}, agregarMensaje(db, objects, "usuario"))

	registerStaff(api, db, objects)
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type adjuntoMensaje struct {
	URL      string `json:"url" doc:"URL firmada breve del adjunto privado"`
	Mime     string `json:"mime"`
	ByteSize int64  `json:"byte_size"`
}

type mensajeResumen struct {
	ID       string          `json:"id"`
	AutorID  string          `json:"autor_id"`
	Autor    string          `json:"autor" doc:"usuario | staff"`
	Cuerpo   string          `json:"cuerpo"`
	Adjunto  *adjuntoMensaje `json:"adjunto,omitempty"`
	CreadoEn time.Time       `json:"creado_en"`
}

type ticketResumen struct {
	ID             string           `json:"id"`
	Categoria      string           `json:"categoria" doc:"pagos | descargas | permisos | reclamo_youtube | otro"`
	Asunto         string           `json:"asunto"`
	Estado         string           `json:"estado" doc:"abierto | en_atencion | resuelto | cerrado"`
	OrderID        *string          `json:"order_id,omitempty"`
	LicenseGrantID *string          `json:"license_grant_id,omitempty"`
	YoutubeURL     string           `json:"youtube_url,omitempty"`
	YoutubeClaimID string           `json:"youtube_claim_id,omitempty"`
	CreadoEn       time.Time        `json:"creado_en"`
	ActualizadoEn  time.Time        `json:"actualizada_en"`
	Mensajes       []mensajeResumen `json:"mensajes"`
}

// ── Creación ───────────────────────────────────────────────────────────────

type crearTicketInput struct {
	Body struct {
		Categoria      string `json:"categoria" enum:"pagos,descargas,permisos,reclamo_youtube,otro"`
		Asunto         string `json:"asunto" minLength:"5" maxLength:"200"`
		OrderID        string `json:"order_id,omitempty" format:"uuid" doc:"Orden propia vinculada (opcional)"`
		LicenseGrantID string `json:"license_grant_id,omitempty" format:"uuid" doc:"Licencia propia vinculada (opcional)"`
		YoutubeURL     string `json:"youtube_url,omitempty" maxLength:"500" doc:"URL del video reclamado (obligatoria en reclamo_youtube)"`
		YoutubeClaimID string `json:"youtube_claim_id,omitempty" maxLength:"128" doc:"Claim ID de YouTube (obligatorio en reclamo_youtube)"`
		IdempotencyKey string `json:"idempotency_key" minLength:"8" maxLength:"128" doc:"Clave de cliente para no duplicar el ticket ante reintentos"`
	}
}

type crearTicketOutput struct {
	Body ticketResumen
}

func crearTicket(db database.DB) func(ctx context.Context, in *crearTicketInput) (*crearTicketOutput, error) {
	return func(ctx context.Context, in *crearTicketInput) (*crearTicketOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		if _, err := ensureProfile(ctx, db, claims.Subject, claims.Email); err != nil {
			return nil, apierr.Internal("error asegurando el perfil", err)
		}

		if in.Body.Categoria == "reclamo_youtube" &&
			(strings.TrimSpace(in.Body.YoutubeURL) == "" || strings.TrimSpace(in.Body.YoutubeClaimID) == "") {
			return nil, huma.Error422UnprocessableEntity("el reclamo YouTube exige youtube_url y youtube_claim_id")
		}

		// Las referencias deben ser propias (404 si no: no se revela su existencia).
		if in.Body.OrderID != "" {
			var dueno bool
			if err := db.QueryRow(ctx, `
				select exists(select 1 from orders where id = $1 and user_id = $2)`,
				in.Body.OrderID, claims.Subject).Scan(&dueno); err != nil {
				return nil, apierr.Internal("error consultando la orden", err)
			}
			if !dueno {
				return nil, huma.Error404NotFound("orden no encontrada")
			}
		}
		if in.Body.LicenseGrantID != "" {
			var dueno bool
			if err := db.QueryRow(ctx, `
				select exists(select 1 from license_grants where id = $1 and user_id = $2)`,
				in.Body.LicenseGrantID, claims.Subject).Scan(&dueno); err != nil {
				return nil, apierr.Internal("error consultando la licencia", err)
			}
			if !dueno {
				return nil, huma.Error404NotFound("licencia no encontrada")
			}
		}

		// Reintento idempotente: el ticket ya existe para esta clave.
		var existente ticketResumen
		err := db.QueryRow(ctx, `
			select id, categoria, asunto, estado, order_id, license_grant_id,
			       coalesce(youtube_url, ''), coalesce(youtube_claim_id, ''), created_at, updated_at
			from support_tickets
			where user_id = $1 and idempotency_key = $2`, claims.Subject, in.Body.IdempotencyKey,
		).Scan(&existente.ID, &existente.Categoria, &existente.Asunto, &existente.Estado,
			&existente.OrderID, &existente.LicenseGrantID, &existente.YoutubeURL, &existente.YoutubeClaimID,
			&existente.CreadoEn, &existente.ActualizadoEn)
		if err == nil {
			if existente.Categoria != in.Body.Categoria || existente.Asunto != in.Body.Asunto ||
				!ptrEqual(existente.OrderID, in.Body.OrderID) ||
				!ptrEqual(existente.LicenseGrantID, in.Body.LicenseGrantID) ||
				existente.YoutubeURL != in.Body.YoutubeURL || existente.YoutubeClaimID != in.Body.YoutubeClaimID {
				return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro ticket")
			}
			if err := rellenarMensajes(ctx, db, &existente, nil, 0); err != nil {
				return nil, err
			}
			out := &crearTicketOutput{}
			out.Body = existente
			return out, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.Internal("error consultando el ticket", err)
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var t ticketResumen
		err = tx.QueryRow(ctx, `
			insert into support_tickets (user_id, categoria, asunto, order_id, license_grant_id,
			                             youtube_url, youtube_claim_id, idempotency_key)
			values ($1, $2, $3, $4, $5, $6, $7, $8)
			returning id, categoria, asunto, estado, order_id, license_grant_id,
			          coalesce(youtube_url, ''), coalesce(youtube_claim_id, ''), created_at, updated_at`,
			claims.Subject, in.Body.Categoria, in.Body.Asunto, uuidPtr(in.Body.OrderID),
			uuidPtr(in.Body.LicenseGrantID), emptyNull(in.Body.YoutubeURL), emptyNull(in.Body.YoutubeClaimID),
			in.Body.IdempotencyKey,
		).Scan(&t.ID, &t.Categoria, &t.Asunto, &t.Estado, &t.OrderID, &t.LicenseGrantID,
			&t.YoutubeURL, &t.YoutubeClaimID, &t.CreadoEn, &t.ActualizadoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				// Carrera entre dos reintentos: devuelve el ticket ya creado
				// si el payload coincide; 409 solo si la clave se reusa con
				// otros datos (mismo criterio que la lectura previa).
				if selErr := db.QueryRow(ctx, `
					select id, categoria, asunto, estado, order_id, license_grant_id,
					       coalesce(youtube_url, ''), coalesce(youtube_claim_id, ''), created_at, updated_at
					from support_tickets
					where user_id = $1 and idempotency_key = $2`, claims.Subject, in.Body.IdempotencyKey,
				).Scan(&existente.ID, &existente.Categoria, &existente.Asunto, &existente.Estado,
					&existente.OrderID, &existente.LicenseGrantID, &existente.YoutubeURL, &existente.YoutubeClaimID,
					&existente.CreadoEn, &existente.ActualizadoEn); selErr == nil {
					if existente.Categoria != in.Body.Categoria || existente.Asunto != in.Body.Asunto ||
						!ptrEqual(existente.OrderID, in.Body.OrderID) ||
						!ptrEqual(existente.LicenseGrantID, in.Body.LicenseGrantID) ||
						existente.YoutubeURL != in.Body.YoutubeURL || existente.YoutubeClaimID != in.Body.YoutubeClaimID {
						return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro ticket")
					}
					if err := rellenarMensajes(ctx, db, &existente, nil, 0); err != nil {
						return nil, err
					}
					out := &crearTicketOutput{}
					out.Body = existente
					return out, nil
				}
				return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro ticket")
			}
			return nil, apierr.Internal("error creando el ticket", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "ticket.creado", "support_ticket", t.ID,
			map[string]any{"categoria": in.Body.Categoria, "asunto": in.Body.Asunto}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		if err := rellenarMensajes(ctx, db, &t, nil, 0); err != nil {
			return nil, err
		}
		out := &crearTicketOutput{}
		out.Body = t
		return out, nil
	}
}

// ── Listado y detalle ──────────────────────────────────────────────────────

type listarTicketsOutput struct {
	Body struct {
		Tickets []ticketResumen `json:"tickets"`
	}
}

func listarTickets(db database.DB) func(ctx context.Context, _ *struct{}) (*listarTicketsOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarTicketsOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		out := &listarTicketsOutput{}
		out.Body.Tickets = []ticketResumen{}

		rows, err := db.Query(ctx, `
			select id, categoria, asunto, estado, order_id, license_grant_id,
			       coalesce(youtube_url, ''), coalesce(youtube_claim_id, ''), created_at, updated_at
			from support_tickets where user_id = $1 order by created_at desc limit 50`, claims.Subject)
		if err != nil {
			return nil, apierr.Internal("error consultando los tickets", err)
		}
		defer rows.Close()
		for rows.Next() {
			var t ticketResumen
			if err := rows.Scan(&t.ID, &t.Categoria, &t.Asunto, &t.Estado, &t.OrderID, &t.LicenseGrantID,
				&t.YoutubeURL, &t.YoutubeClaimID, &t.CreadoEn, &t.ActualizadoEn); err != nil {
				return nil, apierr.Internal("error leyendo los tickets", err)
			}
			out.Body.Tickets = append(out.Body.Tickets, t)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo los tickets", err)
		}
		return out, nil
	}
}

type ticketPath struct {
	ID string `path:"id" format:"uuid" doc:"ID del ticket"`
}

type obtenerTicketOutput struct {
	Body ticketResumen
}

func obtenerTicket(db database.DB, objects storage.Client, presignTTL time.Duration) func(ctx context.Context, in *ticketPath) (*obtenerTicketOutput, error) {
	return func(ctx context.Context, in *ticketPath) (*obtenerTicketOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		t, err := ticketDelUsuario(ctx, db, in.ID, claims.Subject)
		if err != nil {
			return nil, err
		}
		if err := rellenarMensajes(ctx, db, t, objects, presignTTL); err != nil {
			return nil, err
		}
		out := &obtenerTicketOutput{}
		out.Body = *t
		return out, nil
	}
}

// ticketDelUsuario carga un ticket verificando titularidad (404 si no).
func ticketDelUsuario(ctx context.Context, q database.Querier, id, userID string) (*ticketResumen, error) {
	var t ticketResumen
	err := q.QueryRow(ctx, `
		select id, categoria, asunto, estado, order_id, license_grant_id,
		       coalesce(youtube_url, ''), coalesce(youtube_claim_id, ''), created_at, updated_at
		from support_tickets where id = $1 and user_id = $2`, id, userID,
	).Scan(&t.ID, &t.Categoria, &t.Asunto, &t.Estado, &t.OrderID, &t.LicenseGrantID,
		&t.YoutubeURL, &t.YoutubeClaimID, &t.CreadoEn, &t.ActualizadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("ticket no encontrado")
	}
	if err != nil {
		return nil, apierr.Internal("error consultando el ticket", err)
	}
	return &t, nil
}

// rellenarMensajes carga los mensajes de un ticket; cuando hay cliente de
// almacén, los adjuntos se entregan con URL firmada breve.
func rellenarMensajes(ctx context.Context, q database.Querier, t *ticketResumen, objects storage.Client, presignTTL time.Duration) error {
	t.Mensajes = []mensajeResumen{}
	rows, err := q.Query(ctx, `
		select id, author_id, author_kind, cuerpo, attachment_key, attachment_mime, attachment_size, created_at
		from support_messages where ticket_id = $1 order by created_at asc`, t.ID)
	if err != nil {
		return apierr.Internal("error consultando los mensajes", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			m    mensajeResumen
			key  *string
			mime *string
			size *int64
		)
		if err := rows.Scan(&m.ID, &m.AutorID, &m.Autor, &m.Cuerpo, &key, &mime, &size, &m.CreadoEn); err != nil {
			return apierr.Internal("error leyendo los mensajes", err)
		}
		if key != nil && objects != nil {
			url, err := objects.PresignGet(ctx, *key, presignTTL)
			if err != nil {
				return apierr.Internal("error firmando el adjunto", err)
			}
			m.Adjunto = &adjuntoMensaje{URL: url, Mime: *mime, ByteSize: *size}
		}
		t.Mensajes = append(t.Mensajes, m)
	}
	if err := rows.Err(); err != nil {
		return apierr.Internal("error leyendo los mensajes", err)
	}
	return nil
}

// ── Mensajes ───────────────────────────────────────────────────────────────

type agregarMensajeInput struct {
	ID      string `path:"id" format:"uuid" doc:"ID del ticket"`
	RawBody huma.MultipartFormFiles[struct {
		Cuerpo  string        `form:"cuerpo" required:"true" minLength:"1" maxLength:"5000"`
		Archivo huma.FormFile `form:"archivo" required:"false" doc:"Adjunto opcional (imagen o PDF, máximo 5 MiB)"`
	}]
}

type agregarMensajeOutput struct {
	Body mensajeResumen
}

// agregarMensaje agrega un mensaje al ticket. El authorKind distingue al
// titular ("usuario") del staff; ambos flujos comparten la lógica. En tickets
// cerrados se rechaza con 409.
func agregarMensaje(db database.DB, objects storage.Client, authorKind string) func(ctx context.Context, in *agregarMensajeInput) (*agregarMensajeOutput, error) {
	return func(ctx context.Context, in *agregarMensajeInput) (*agregarMensajeOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado, duenoID string
		err = tx.QueryRow(ctx, `
			select estado, user_id from support_tickets where id = $1 for update`, in.ID,
		).Scan(&estado, &duenoID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("ticket no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el ticket", err)
		}
		if authorKind == "usuario" && duenoID != claims.Subject {
			// 404 (no 403) para no revelar la existencia del ticket ajeno.
			return nil, huma.Error404NotFound("ticket no encontrado")
		}
		if estado == "cerrado" {
			return nil, huma.Error409Conflict("el ticket está cerrado y no admite mensajes")
		}

		form := in.RawBody.Data()
		var adjunto *mensajeAdjuntoGuardado
		if form.Archivo.IsSet {
			adjunto, err = guardarAdjunto(ctx, objects, in.ID, form.Archivo)
			if err != nil {
				return nil, err
			}
		}
		var adjuntoKey, adjuntoMIME *string
		var adjuntoSize *int64
		if adjunto != nil {
			adjuntoKey = &adjunto.key
			adjuntoMIME = &adjunto.mime
			adjuntoSize = &adjunto.size
		}

		var (
			msgID    string
			creadoEn time.Time
		)
		err = tx.QueryRow(ctx, `
			insert into support_messages (ticket_id, author_id, author_kind, cuerpo, attachment_key, attachment_mime, attachment_size)
			values ($1, $2, $3, $4, $5, $6, $7)
			returning id, created_at`,
			in.ID, claims.Subject, authorKind, form.Cuerpo,
			adjuntoKey, adjuntoMIME, adjuntoSize,
		).Scan(&msgID, &creadoEn)
		if err != nil {
			return nil, apierr.Internal("error registrando el mensaje", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "ticket.mensaje", "support_ticket", in.ID,
			map[string]any{"mensaje_id": msgID, "autor": authorKind, "con_adjunto": adjunto != nil}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}

		out := &agregarMensajeOutput{}
		out.Body.ID = msgID
		out.Body.AutorID = claims.Subject
		out.Body.Autor = authorKind
		out.Body.Cuerpo = form.Cuerpo
		out.Body.CreadoEn = creadoEn
		return out, nil
	}
}

type mensajeAdjuntoGuardado struct {
	key  string
	mime string
	size int64
}

// guardarAdjunto valida y sube el adjunto al prefijo privado support/.
func guardarAdjunto(ctx context.Context, objects storage.Client, ticketID string, archivo huma.FormFile) (*mensajeAdjuntoGuardado, error) {
	if archivo.Size > maxAdjuntoBytes {
		return nil, huma.Error422UnprocessableEntity("el adjunto supera el máximo de 5 MiB")
	}
	header := make([]byte, 512)
	n, err := archivo.Read(header)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, huma.Error422UnprocessableEntity("no se pudo leer el adjunto")
	}
	if _, err := archivo.Seek(0, io.SeekStart); err != nil {
		return nil, huma.Error422UnprocessableEntity("no se pudo leer el adjunto")
	}
	mimeType := http.DetectContentType(header[:n])
	ext, allowed := adjuntoExt[mimeType]
	if !allowed {
		return nil, huma.Error422UnprocessableEntity("el contenido no es una imagen JPEG, PNG, WebP o PDF válida")
	}
	key := fmt.Sprintf("support/tickets/%s/%d%s", ticketID, time.Now().UnixNano(), ext)
	if err := objects.PutObject(ctx, key, mimeType, archivo); err != nil {
		return nil, apierr.Internal("error guardando el adjunto", err)
	}
	return &mensajeAdjuntoGuardado{key: key, mime: mimeType, size: archivo.Size}, nil
}

// ── Helpers compartidos con el paquete staff ───────────────────────────────

func uuidPtr(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}

func emptyNull(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func ptrEqual(p *string, s string) bool {
	if p == nil {
		return s == ""
	}
	return *p == s
}

// registrarAuditoria inserta un evento de auditoría (usa la tx activa si hay).
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}

// ensureProfile crea el perfil si no existe (mismo patrón que /me y la tienda).
func ensureProfile(ctx context.Context, db database.DB, userID, email string) (bool, error) {
	var initial *string
	if email != "" {
		name := strings.SplitN(email, "@", 2)[0]
		initial = &name
	}
	var created bool
	err := db.QueryRow(ctx, `
		insert into profiles (id, display_name, email) values ($1, $2, $3)
		on conflict (id) do update set email = coalesce(excluded.email, profiles.email)
		returning (xmax = 0)`, userID, initial, email).Scan(&created)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return created, err
}
