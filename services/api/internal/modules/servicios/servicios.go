// Package servicios implementa los servicios de composición/producción por
// encargo: solicitud → cotización staff → aceptación (proyecto con snapshot
// congelado) → comprobante del pago acordado → entregas. No es checkout de
// tienda: jamás crean suscripciones Premium ni licencias; el único efecto de
// acceso permitido es el entitlement de la pista entregada
// (grant_source='service'), concedido en la misma transacción de la entrega.
// La titularidad se verifica siempre: un acceso ajeno devuelve 404 (no se
// revela la existencia del recurso).
package servicios

import (
	"context"
	"encoding/json"
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

// maxAdjuntoBytes es el máximo de los archivos de este dominio (comprobantes
// y entregas): mismo límite que los comprobantes de la tienda.
const maxAdjuntoBytes = 5 << 20

// Register registra los endpoints del titular bajo /api/v1/servicios.
func Register(api huma.API, db database.DB, objects storage.Client, presignTTL time.Duration) {
	huma.Register(api, huma.Operation{
		OperationID: "servicios-crear-solicitud",
		Method:      http.MethodPost,
		Path:        "/api/v1/servicios/solicitudes",
		Summary:     "Solicitar un servicio de composición/producción",
		Description: "Crea una solicitud de encargo (composicion | produccion | arreglo). Idempotente por " +
			"(usuario, clave de cliente): repetir con la misma clave y el mismo payload devuelve la solicitud " +
			"original; reutilizarla con otros datos devuelve 409.",
		Tags:     []string{"servicios"},
		Security: []map[string][]string{{"bearer": {}}},
	}, crearSolicitud(db))

	huma.Register(api, huma.Operation{
		OperationID: "servicios-listar-solicitudes",
		Method:      http.MethodGet,
		Path:        "/api/v1/servicios/solicitudes",
		Summary:     "Mis solicitudes de servicio",
		Description: "Solicitudes del usuario con sus cotizaciones y el proyecto vinculado, de la más reciente " +
			"a la más antigua. Solo el titular.",
		Tags:     []string{"servicios"},
		Security: []map[string][]string{{"bearer": {}}},
	}, listarSolicitudes(db))

	huma.Register(api, huma.Operation{
		OperationID: "servicios-obtener-solicitud",
		Method:      http.MethodGet,
		Path:        "/api/v1/servicios/solicitudes/{id}",
		Summary:     "Detalle de una solicitud propia",
		Description: "Solicitud con cotizaciones (monto, moneda, términos y estado) y el proyecto creado al " +
			"aceptar. Ajena o inexistente → 404.",
		Tags:     []string{"servicios"},
		Security: []map[string][]string{{"bearer": {}}},
	}, obtenerSolicitud(db))

	huma.Register(api, huma.Operation{
		OperationID: "servicios-aceptar-cotizacion",
		Method:      http.MethodPost,
		Path:        "/api/v1/servicios/cotizaciones/{id}/aceptar",
		Summary:     "Aceptar una cotización (crea el proyecto)",
		Description: "Transacción idempotente: marca la cotización aceptada, la solicitud aceptada y crea el " +
			"proyecto con monto, moneda y términos congelados (quote_snapshot). Solo cotizaciones enviada de " +
			"solicitudes propias; repetir devuelve el proyecto sin duplicarlo.",
		Tags:     []string{"servicios"},
		Security: []map[string][]string{{"bearer": {}}},
	}, aceptarCotizacion(db))

	huma.Register(api, huma.Operation{
		OperationID: "servicios-rechazar-cotizacion",
		Method:      http.MethodPost,
		Path:        "/api/v1/servicios/cotizaciones/{id}/rechazar",
		Summary:     "Rechazar una cotización",
		Description: "Marca la cotización rechazada; la solicitud queda cotizada para una re-cotización staff. " +
			"Idempotente si ya estaba rechazada.",
		Tags:     []string{"servicios"},
		Security: []map[string][]string{{"bearer": {}}},
	}, rechazarCotizacion(db))

	huma.Register(api, huma.Operation{
		OperationID: "servicios-subir-pago",
		Method:      http.MethodPost,
		Path:        "/api/v1/servicios/proyectos/{id}/pagos",
		Summary:     "Subir comprobante del pago del proyecto",
		Description: "Multipart autenticado con imagen JPEG, PNG o WebP de máximo 5 MiB. Guarda en " +
			"almacenamiento privado (services/) y deja el pago en revisión. Subir un comprobante nunca " +
			"concede acceso: solo staff puede confirmarlo y los servicios no crean entitlements por pago.",
		MaxBodyBytes: maxAdjuntoBytes + 64*1024,
		Tags:         []string{"servicios"},
		Security:     []map[string][]string{{"bearer": {}}},
	}, subirPago(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "servicios-obtener-proyecto",
		Method:      http.MethodGet,
		Path:        "/api/v1/servicios/proyectos/{id}",
		Summary:     "Detalle de un proyecto propio",
		Description: "Proyecto con sus entregas (las de archivo incluyen URL firmada breve) y comprobantes. " +
			"Ajeno o inexistente → 404.",
		Tags:     []string{"servicios"},
		Security: []map[string][]string{{"bearer": {}}},
	}, obtenerProyecto(db, objects, presignTTL))

	registerStaff(api, db, objects)
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type cotizacionResumen struct {
	ID          string    `json:"id"`
	SolicitudID string    `json:"solicitud_id"`
	MontoMinor  int64     `json:"monto_minor"`
	Moneda      string    `json:"moneda"`
	TermsText   string    `json:"terms_text"`
	Estado      string    `json:"estado" doc:"enviada | aceptada | rechazada"`
	CreadaEn    time.Time `json:"creada_en"`
}

type proyectoCorto struct {
	ID     string `json:"id"`
	Estado string `json:"estado" doc:"en_curso | entregado | cerrado"`
}

type solicitudResumen struct {
	ID            string              `json:"id"`
	Tipo          string              `json:"tipo" doc:"composicion | produccion | arreglo"`
	Titulo        string              `json:"titulo"`
	Descripcion   string              `json:"descripcion"`
	Referencias   json.RawMessage     `json:"referencias" doc:"JSON libre de referencias del cliente"`
	Estado        string              `json:"estado" doc:"nueva | en_revision | cotizada | aceptada | rechazada | cancelada"`
	CreadaEn      time.Time           `json:"creada_en"`
	ActualizadaEn time.Time           `json:"actualizada_en"`
	Cotizaciones  []cotizacionResumen `json:"cotizaciones"`
	Proyecto      *proyectoCorto      `json:"proyecto" doc:"Proyecto creado al aceptar, o null"`
}

type pistaCorta struct {
	ID     string `json:"id"`
	Titulo string `json:"titulo"`
}

type entregaArchivo struct {
	URL      string `json:"url" doc:"URL firmada breve del archivo privado"`
	Mime     string `json:"mime"`
	ByteSize int64  `json:"byte_size"`
}

type entregaResumen struct {
	ID       string          `json:"id"`
	Titulo   string          `json:"titulo"`
	Nota     string          `json:"nota,omitempty"`
	Tipo     string          `json:"tipo" doc:"pista | archivo"`
	Pista    *pistaCorta     `json:"pista,omitempty" doc:"Solo entregas de pista vendida"`
	Archivo  *entregaArchivo `json:"archivo,omitempty" doc:"Solo entregas de archivo"`
	CreadaEn time.Time       `json:"creada_en"`
}

type pagoServicioResumen struct {
	ID         string     `json:"id"`
	Estado     string     `json:"estado" doc:"in_review | confirmed | rejected"`
	ByteSize   int64      `json:"byte_size"`
	CreadoEn   time.Time  `json:"creado_en"`
	RevisadoEn *time.Time `json:"revisado_en,omitempty"`
}

type proyectoResumen struct {
	ID            string                `json:"id"`
	SolicitudID   string                `json:"solicitud_id"`
	CotizacionID  string                `json:"cotizacion_id"`
	MontoMinor    int64                 `json:"monto_minor"`
	Moneda        string                `json:"moneda"`
	Estado        string                `json:"estado" doc:"en_curso | entregado | cerrado"`
	CreadaEn      time.Time             `json:"creada_en"`
	ActualizadaEn time.Time             `json:"actualizada_en"`
	Entregas      []entregaResumen      `json:"entregas"`
	Pagos         []pagoServicioResumen `json:"pagos"`
}

// ── Solicitudes ────────────────────────────────────────────────────────────

type crearSolicitudInput struct {
	Body struct {
		Tipo           string         `json:"tipo" enum:"composicion,produccion,arreglo" doc:"Tipo de encargo"`
		Titulo         string         `json:"titulo" minLength:"3" maxLength:"200"`
		Descripcion    string         `json:"descripcion" minLength:"10" maxLength:"5000" doc:"Alcance, estilo, plazos y detalles del encargo"`
		Referencias    map[string]any `json:"referencias,omitempty" doc:"JSON libre (enlaces, notas, ejemplos)"`
		IdempotencyKey string         `json:"idempotency_key" minLength:"8" maxLength:"128" doc:"Clave de cliente para no duplicar la solicitud ante reintentos"`
	}
}

type crearSolicitudOutput struct {
	Body solicitudResumen
}

// crearSolicitud inserta la solicitud de encargo. La clave idempotente es por
// usuario: repetirla con el mismo payload devuelve la solicitud original;
// con otro payload devuelve 409.
func crearSolicitud(db database.DB) func(ctx context.Context, in *crearSolicitudInput) (*crearSolicitudOutput, error) {
	return func(ctx context.Context, in *crearSolicitudInput) (*crearSolicitudOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		if _, err := ensureProfile(ctx, db, claims.Subject, claims.Email); err != nil {
			return nil, huma.Error500InternalServerError("error asegurando el perfil", err)
		}

		referencias := map[string]any{}
		if in.Body.Referencias != nil {
			referencias = in.Body.Referencias
		}
		referenciasJSON, err := json.Marshal(referencias)
		if err != nil {
			return nil, huma.Error422UnprocessableEntity("las referencias no son un JSON válido")
		}

		// Reintento idempotente: la solicitud ya existe para esta clave.
		var existente solicitudResumen
		err = db.QueryRow(ctx, `
			select id, tipo, titulo, descripcion, estado, created_at, updated_at, referencias
			from service_requests
			where user_id = $1 and idempotency_key = $2`, claims.Subject, in.Body.IdempotencyKey,
		).Scan(&existente.ID, &existente.Tipo, &existente.Titulo, &existente.Descripcion,
			&existente.Estado, &existente.CreadaEn, &existente.ActualizadaEn, &existente.Referencias)
		if err == nil {
			if existente.Tipo != in.Body.Tipo || existente.Titulo != in.Body.Titulo ||
				existente.Descripcion != in.Body.Descripcion || !jsonRawEqual(existente.Referencias, referenciasJSON) {
				return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otra solicitud")
			}
			if err := rellenarSolicitud(ctx, db, &existente); err != nil {
				return nil, err
			}
			out := &crearSolicitudOutput{}
			out.Body = existente
			return out, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando la solicitud", err)
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var s solicitudResumen
		err = tx.QueryRow(ctx, `
			insert into service_requests (user_id, tipo, titulo, descripcion, referencias, idempotency_key)
			values ($1, $2, $3, $4, $5, $6)
			returning id, tipo, titulo, descripcion, estado, created_at, updated_at, referencias`,
			claims.Subject, in.Body.Tipo, in.Body.Titulo, in.Body.Descripcion, referenciasJSON, in.Body.IdempotencyKey,
		).Scan(&s.ID, &s.Tipo, &s.Titulo, &s.Descripcion, &s.Estado, &s.CreadaEn, &s.ActualizadaEn, &s.Referencias)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				if selErr := db.QueryRow(ctx, `
					select id, tipo, titulo, descripcion, estado, created_at, updated_at, referencias
					from service_requests
					where user_id = $1 and idempotency_key = $2`, claims.Subject, in.Body.IdempotencyKey,
				).Scan(&existente.ID, &existente.Tipo, &existente.Titulo, &existente.Descripcion,
					&existente.Estado, &existente.CreadaEn, &existente.ActualizadaEn, &existente.Referencias); selErr == nil {
					if existente.Tipo != in.Body.Tipo || existente.Titulo != in.Body.Titulo ||
						existente.Descripcion != in.Body.Descripcion || !jsonRawEqual(existente.Referencias, referenciasJSON) {
						return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otra solicitud")
					}
					if err := rellenarSolicitud(ctx, db, &existente); err != nil {
						return nil, err
					}
					out := &crearSolicitudOutput{}
					out.Body = existente
					return out, nil
				}
			}
			return nil, huma.Error500InternalServerError("error creando la solicitud", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.creado", "service_request", s.ID,
			map[string]any{"tipo": in.Body.Tipo, "titulo": in.Body.Titulo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		if err := rellenarSolicitud(ctx, db, &s); err != nil {
			return nil, err
		}
		out := &crearSolicitudOutput{}
		out.Body = s
		return out, nil
	}
}

func jsonRawEqual(a json.RawMessage, b []byte) bool {
	var av, bv any
	if err := json.Unmarshal(a, &av); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &bv); err != nil {
		return false
	}
	aj, _ := json.Marshal(av)
	bj, _ := json.Marshal(bv)
	return string(aj) == string(bj)
}

// rellenarSolicitud carga cotizaciones y proyecto de una solicitud ya leída.
func rellenarSolicitud(ctx context.Context, q database.Querier, s *solicitudResumen) error {
	s.Cotizaciones = []cotizacionResumen{}
	rows, err := q.Query(ctx, `
		select id, request_id, amount_minor, currency, terms_text, estado, created_at
		from service_quotes where request_id = $1 order by created_at asc`, s.ID)
	if err != nil {
		return huma.Error500InternalServerError("error consultando las cotizaciones", err)
	}
	defer rows.Close()
	for rows.Next() {
		var c cotizacionResumen
		if err := rows.Scan(&c.ID, &c.SolicitudID, &c.MontoMinor, &c.Moneda, &c.TermsText, &c.Estado, &c.CreadaEn); err != nil {
			return huma.Error500InternalServerError("error leyendo las cotizaciones", err)
		}
		s.Cotizaciones = append(s.Cotizaciones, c)
	}
	if err := rows.Err(); err != nil {
		return huma.Error500InternalServerError("error leyendo las cotizaciones", err)
	}
	rows.Close()

	s.Proyecto = nil
	var p proyectoCorto
	err = q.QueryRow(ctx, `
		select id, estado from service_projects where request_id = $1`, s.ID).Scan(&p.ID, &p.Estado)
	switch {
	case err == nil:
		s.Proyecto = &p
	case errors.Is(err, pgx.ErrNoRows):
	default:
		return huma.Error500InternalServerError("error consultando el proyecto", err)
	}
	return nil
}

type listarSolicitudesOutput struct {
	Body struct {
		Solicitudes []solicitudResumen `json:"solicitudes"`
	}
}

func listarSolicitudes(db database.DB) func(ctx context.Context, _ *struct{}) (*listarSolicitudesOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarSolicitudesOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		out := &listarSolicitudesOutput{}
		out.Body.Solicitudes = []solicitudResumen{}

		rows, err := db.Query(ctx, `
			select id, tipo, titulo, descripcion, estado, created_at, updated_at, referencias
			from service_requests where user_id = $1 order by created_at desc limit 50`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las solicitudes", err)
		}
		defer rows.Close()
		for rows.Next() {
			var s solicitudResumen
			if err := rows.Scan(&s.ID, &s.Tipo, &s.Titulo, &s.Descripcion, &s.Estado,
				&s.CreadaEn, &s.ActualizadaEn, &s.Referencias); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las solicitudes", err)
			}
			out.Body.Solicitudes = append(out.Body.Solicitudes, s)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las solicitudes", err)
		}
		rows.Close()
		for i := range out.Body.Solicitudes {
			if err := rellenarSolicitud(ctx, db, &out.Body.Solicitudes[i]); err != nil {
				return nil, err
			}
		}
		return out, nil
	}
}

type solicitudPath struct {
	ID string `path:"id" format:"uuid" doc:"ID de la solicitud"`
}

type obtenerSolicitudOutput struct {
	Body solicitudResumen
}

func obtenerSolicitud(db database.DB) func(ctx context.Context, in *solicitudPath) (*obtenerSolicitudOutput, error) {
	return func(ctx context.Context, in *solicitudPath) (*obtenerSolicitudOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		var s solicitudResumen
		err := db.QueryRow(ctx, `
			select id, tipo, titulo, descripcion, estado, created_at, updated_at, referencias
			from service_requests where id = $1 and user_id = $2`, in.ID, claims.Subject,
		).Scan(&s.ID, &s.Tipo, &s.Titulo, &s.Descripcion, &s.Estado, &s.CreadaEn, &s.ActualizadaEn, &s.Referencias)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("solicitud no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la solicitud", err)
		}
		if err := rellenarSolicitud(ctx, db, &s); err != nil {
			return nil, err
		}
		out := &obtenerSolicitudOutput{}
		out.Body = s
		return out, nil
	}
}

// ── Cotizaciones (aceptar / rechazar) ──────────────────────────────────────

type aceptarCotizacionOutput struct {
	Body struct {
		Proyecto         proyectoResumen `json:"proyecto" doc:"Proyecto creado (o existente en reintentos)"`
		YaEstabaAceptada bool            `json:"ya_estaba_aceptada" doc:"true cuando la aceptación fue idempotente"`
	}
}

// aceptarCotizacion crea el proyecto con el snapshot congelado de la
// cotización en la misma transacción. Repetir la aceptación devuelve el
// proyecto existente (unique por quote_id); una carrera de dos clics sobre
// cotizaciones distintas de la misma solicitud se serializa con el lock de
// la solicitud y la segunda recibe 409.
func aceptarCotizacion(db database.DB) func(ctx context.Context, in *solicitudPath) (*aceptarCotizacionOutput, error) {
	return func(ctx context.Context, in *solicitudPath) (*aceptarCotizacionOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var (
			requestID    string
			requestState string
			userID       string
			quoteState   string
			monto        int64
			moneda       string
			terms        string
		)
		err = tx.QueryRow(ctx, `
			select q.request_id, q.estado, q.amount_minor, q.currency, q.terms_text, r.user_id, r.estado
			from service_quotes q
			join service_requests r on r.id = q.request_id
			where q.id = $1
			for update of q, r`, in.ID,
		).Scan(&requestID, &quoteState, &monto, &moneda, &terms, &userID, &requestState)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("cotización no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la cotización", err)
		}
		if userID != claims.Subject {
			return nil, huma.Error404NotFound("cotización no encontrada")
		}

		out := &aceptarCotizacionOutput{}
		if quoteState == "aceptada" {
			p, err := proyectoPorCotizacion(ctx, tx, in.ID)
			if err != nil {
				return nil, err
			}
			out.Body.Proyecto = *p
			out.Body.YaEstabaAceptada = true
			if err := tx.Commit(ctx); err != nil {
				return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
			}
			return out, nil
		}
		if quoteState != "enviada" {
			return nil, huma.Error409Conflict("la cotización ya fue rechazada")
		}
		if requestState == "aceptada" {
			return nil, huma.Error409Conflict("la solicitud ya tiene una cotización aceptada")
		}
		if requestState == "rechazada" || requestState == "cancelada" {
			return nil, huma.Error409Conflict("la solicitud no admite aceptación en su estado actual")
		}

		tag, err := tx.Exec(ctx, `
			update service_quotes set estado = 'aceptada' where id = $1 and estado = 'enviada'`, in.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error aceptando la cotización", err)
		}
		if tag.RowsAffected() != 1 {
			return nil, huma.Error409Conflict("la cotización ya no está enviada")
		}
		if _, err := tx.Exec(ctx, `
			update service_requests set estado = 'aceptada' where id = $1`, requestID); err != nil {
			return nil, huma.Error500InternalServerError("error actualizando la solicitud", err)
		}

		snapshot, _ := json.Marshal(map[string]any{
			"cotizacion_id": in.ID, "solicitud_id": requestID,
			"monto_minor": monto, "moneda": moneda, "terms_text": terms,
		})
		p, err := insertarProyecto(ctx, tx, requestID, in.ID, userID, monto, moneda, snapshot)
		if err != nil {
			return nil, err
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.aceptado", "service_request", requestID,
			map[string]any{"cotizacion_id": in.ID, "proyecto_id": p.ID, "monto_minor": monto, "moneda": moneda}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		out.Body.Proyecto = *p
		return out, nil
	}
}

type rechazarCotizacionOutput struct {
	Body struct {
		ID     string `json:"id"`
		Estado string `json:"estado" doc:"rechazada"`
	}
}

func rechazarCotizacion(db database.DB) func(ctx context.Context, in *solicitudPath) (*rechazarCotizacionOutput, error) {
	return func(ctx context.Context, in *solicitudPath) (*rechazarCotizacionOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado, userID string
		err = tx.QueryRow(ctx, `
			select q.estado, r.user_id
			from service_quotes q
			join service_requests r on r.id = q.request_id
			where q.id = $1
			for update of q`, in.ID).Scan(&estado, &userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("cotización no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la cotización", err)
		}
		if userID != claims.Subject {
			return nil, huma.Error404NotFound("cotización no encontrada")
		}

		out := &rechazarCotizacionOutput{}
		out.Body.ID = in.ID
		switch estado {
		case "rechazada":
			out.Body.Estado = "rechazada"
			if err := tx.Commit(ctx); err != nil {
				return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
			}
			return out, nil
		case "aceptada":
			return nil, huma.Error409Conflict("la cotización ya fue aceptada")
		}

		if _, err := tx.Exec(ctx, `
			update service_quotes set estado = 'rechazada' where id = $1 and estado = 'enviada'`, in.ID); err != nil {
			return nil, huma.Error500InternalServerError("error rechazando la cotización", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.cotizacion_rechazada", "service_quote", in.ID, nil); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		out.Body.Estado = "rechazada"
		return out, nil
	}
}

// ── Pagos del proyecto (comprobante) ───────────────────────────────────────

var comprobantePagoExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type subirPagoInput struct {
	ID      string `path:"id" format:"uuid" doc:"ID del proyecto"`
	RawBody huma.MultipartFormFiles[struct {
		Archivo huma.FormFile `form:"archivo" required:"true"`
	}]
}

type subirPagoOutput struct {
	Body pagoServicioResumen
}

// subirPago registra el comprobante del pago acordado de un proyecto propio.
// Mismo patrón que la tienda: multipart ≤ 5 MiB, MIME detectado por contenido
// y objeto privado en MinIO. Solo un comprobante en revisión por proyecto;
// subirlo nunca concede acceso.
func subirPago(db database.DB, objects storage.Client) func(ctx context.Context, in *subirPagoInput) (*subirPagoOutput, error) {
	return func(ctx context.Context, in *subirPagoInput) (*subirPagoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		var estado, userID string
		err := db.QueryRow(ctx, `
			select estado, user_id from service_projects where id = $1`, in.ID,
		).Scan(&estado, &userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("proyecto no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el proyecto", err)
		}
		if userID != claims.Subject {
			return nil, huma.Error404NotFound("proyecto no encontrado")
		}
		if estado == "cerrado" {
			return nil, huma.Error409Conflict("el proyecto está cerrado y no admite pagos")
		}

		archivo := in.RawBody.Data().Archivo
		if archivo.Size > maxAdjuntoBytes {
			return nil, huma.Error422UnprocessableEntity("el comprobante supera el máximo de 5 MiB")
		}
		mimeType, err := detectarMIME(archivo, comprobantePagoExt)
		if err != nil {
			return nil, err
		}
		key := fmt.Sprintf("services/pagos/%s/%d%s", in.ID, time.Now().UnixNano(), comprobantePagoExt[mimeType])
		if err := objects.PutObject(ctx, key, mimeType, archivo); err != nil {
			return nil, huma.Error500InternalServerError("error guardando el comprobante", err)
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var p pagoServicioResumen
		err = tx.QueryRow(ctx, `
			insert into service_payments (project_id, user_id, receipt_key, mime, size_bytes)
			select $1, $2, $3, $4, $5
			where not exists (
				select 1 from service_payments where project_id = $1 and estado = 'in_review'
			)
			returning id, estado, size_bytes, created_at`,
			in.ID, claims.Subject, key, mimeType, archivo.Size,
		).Scan(&p.ID, &p.Estado, &p.ByteSize, &p.CreadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error409Conflict("ya existe un comprobante en revisión para este proyecto")
		}
		if err != nil {
			// Carrera de dos subidas concurrentes: el índice único parcial
			// service_payments_in_review_uidx (00025) rechaza la segunda.
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un comprobante en revisión para este proyecto")
			}
			return nil, huma.Error500InternalServerError("error registrando el pago", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.comprobante_subido", "service_payment", p.ID,
			map[string]any{"proyecto_id": in.ID}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}

		out := &subirPagoOutput{}
		out.Body = p
		return out, nil
	}
}

// ── Proyecto (detalle) ─────────────────────────────────────────────────────

type obtenerProyectoOutput struct {
	Body proyectoResumen
}

func obtenerProyecto(db database.DB, objects storage.Client, presignTTL time.Duration) func(ctx context.Context, in *solicitudPath) (*obtenerProyectoOutput, error) {
	return func(ctx context.Context, in *solicitudPath) (*obtenerProyectoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		p, err := proyectoDelUsuario(ctx, db, in.ID, claims.Subject)
		if err != nil {
			return nil, err
		}
		if err := rellenarProyecto(ctx, db, objects, presignTTL, p); err != nil {
			return nil, err
		}
		out := &obtenerProyectoOutput{}
		out.Body = *p
		return out, nil
	}
}

// proyectoDelUsuario carga un proyecto verificando titularidad (404 si no).
func proyectoDelUsuario(ctx context.Context, q database.Querier, id, userID string) (*proyectoResumen, error) {
	var p proyectoResumen
	err := q.QueryRow(ctx, `
		select id, request_id, quote_id, amount_minor, currency, estado, created_at, updated_at
		from service_projects where id = $1 and user_id = $2`, id, userID,
	).Scan(&p.ID, &p.SolicitudID, &p.CotizacionID, &p.MontoMinor, &p.Moneda, &p.Estado, &p.CreadaEn, &p.ActualizadaEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("proyecto no encontrado")
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando el proyecto", err)
	}
	return &p, nil
}

// rellenarProyecto carga entregas (con URL firmada de las de archivo, solo
// tras verificar titularidad) y pagos de un proyecto ya autorizado.
func rellenarProyecto(ctx context.Context, q database.Querier, objects storage.Client, presignTTL time.Duration, p *proyectoResumen) error {
	p.Entregas = []entregaResumen{}
	rows, err := q.Query(ctx, `
		select d.id, d.titulo, coalesce(d.nota, ''), d.track_id, coalesce(t.title, ''), d.file_key, d.mime, d.size_bytes, d.created_at
		from service_deliverables d
		left join tracks t on t.id = d.track_id
		where d.project_id = $1 order by d.created_at asc`, p.ID)
	if err != nil {
		return huma.Error500InternalServerError("error consultando las entregas", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			e        entregaResumen
			trackID  *string
			trackTit string
			fileKey  *string
			mime     *string
			size     *int64
		)
		if err := rows.Scan(&e.ID, &e.Titulo, &e.Nota, &trackID, &trackTit, &fileKey, &mime, &size, &e.CreadaEn); err != nil {
			return huma.Error500InternalServerError("error leyendo las entregas", err)
		}
		switch {
		case trackID != nil:
			e.Tipo = "pista"
			e.Pista = &pistaCorta{ID: *trackID, Titulo: trackTit}
		case fileKey != nil:
			e.Tipo = "archivo"
			url, err := objects.PresignGet(ctx, *fileKey, presignTTL)
			if err != nil {
				return huma.Error500InternalServerError("error firmando la entrega", err)
			}
			e.Archivo = &entregaArchivo{URL: url, Mime: *mime, ByteSize: *size}
		}
		p.Entregas = append(p.Entregas, e)
	}
	if err := rows.Err(); err != nil {
		return huma.Error500InternalServerError("error leyendo las entregas", err)
	}
	rows.Close()

	p.Pagos = []pagoServicioResumen{}
	prows, err := q.Query(ctx, `
		select id, estado, size_bytes, created_at, reviewed_at
		from service_payments where project_id = $1 order by created_at asc`, p.ID)
	if err != nil {
		return huma.Error500InternalServerError("error consultando los pagos", err)
	}
	defer prows.Close()
	for prows.Next() {
		var pg pagoServicioResumen
		if err := prows.Scan(&pg.ID, &pg.Estado, &pg.ByteSize, &pg.CreadoEn, &pg.RevisadoEn); err != nil {
			return huma.Error500InternalServerError("error leyendo los pagos", err)
		}
		p.Pagos = append(p.Pagos, pg)
	}
	if err := prows.Err(); err != nil {
		return huma.Error500InternalServerError("error leyendo los pagos", err)
	}
	return nil
}

// ── Helpers compartidos con el paquete staff ───────────────────────────────

// proyectoPorCotizacion carga el proyecto de una cotización (aceptación
// idempotente). Debe llamarse dentro de la tx activa.
func proyectoPorCotizacion(ctx context.Context, q database.Querier, quoteID string) (*proyectoResumen, error) {
	var p proyectoResumen
	err := q.QueryRow(ctx, `
		select id, request_id, quote_id, amount_minor, currency, estado, created_at, updated_at
		from service_projects where quote_id = $1`, quoteID,
	).Scan(&p.ID, &p.SolicitudID, &p.CotizacionID, &p.MontoMinor, &p.Moneda, &p.Estado, &p.CreadaEn, &p.ActualizadaEn)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando el proyecto", err)
	}
	return &p, nil
}

// insertarProyecto inserta el proyecto congelando la cotización aceptada.
// El unique por quote_id hace que una carrera de aceptaciones no duplique.
func insertarProyecto(ctx context.Context, q database.Querier, requestID, quoteID, userID string, monto int64, moneda string, snapshot []byte) (*proyectoResumen, error) {
	var p proyectoResumen
	err := q.QueryRow(ctx, `
		insert into service_projects (request_id, quote_id, user_id, amount_minor, currency, quote_snapshot)
		values ($1, $2, $3, $4, $5, $6)
		on conflict (quote_id) do nothing
		returning id, request_id, quote_id, amount_minor, currency, estado, created_at, updated_at`,
		requestID, quoteID, userID, monto, moneda, snapshot,
	).Scan(&p.ID, &p.SolicitudID, &p.CotizacionID, &p.MontoMinor, &p.Moneda, &p.Estado, &p.CreadaEn, &p.ActualizadaEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return proyectoPorCotizacion(ctx, q, quoteID)
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("error creando el proyecto", err)
	}
	return &p, nil
}

// detectarMIME lee la cabecera del archivo, la detecta por contenido y exige
// que el tipo detectado esté permitido (ext es el mapa MIME → extensión).
func detectarMIME(archivo huma.FormFile, ext map[string]string) (string, error) {
	header := make([]byte, 512)
	n, err := archivo.Read(header)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", huma.Error422UnprocessableEntity("no se pudo leer el archivo")
	}
	if _, err := archivo.Seek(0, io.SeekStart); err != nil {
		return "", huma.Error422UnprocessableEntity("no se pudo leer el archivo")
	}
	mimeType := http.DetectContentType(header[:n])
	if _, allowed := ext[mimeType]; !allowed {
		return "", huma.Error422UnprocessableEntity("el contenido no tiene un tipo de archivo permitido")
	}
	return mimeType, nil
}

// registrarAuditoria inserta un evento de auditoría (usa la tx activa si hay).
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
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
