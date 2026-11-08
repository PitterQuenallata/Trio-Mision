package servicios

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"triomision/api/internal/apierr"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// uuidRe valida el formato del track_id recibido por formulario multipart
// (los campos de formulario no pasan por la validación format de Huma).
var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// entregaExt asocia el MIME detectado por contenido a la extensión del
// archivo de entrega (stems, partituras, PDFs, imágenes de referencia).
var entregaExt = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
	"audio/wav":       ".wav",
	"audio/mpeg":      ".mp3",
	"audio/aiff":      ".aiff",
	"application/zip": ".zip",
}

// registerStaff registra los endpoints de operación staff (admin/vendedor;
// editor → 403). Toda mutación comparte transacción con su auditoría.
func registerStaff(api huma.API, db database.DB, objects storage.Client) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-solicitudes-servicio",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/servicios/solicitudes",
		Summary:     "Listar solicitudes de servicio",
		Description: "Solicitudes de encargo con su usuario y proyecto. Filtro opcional por estado " +
			"(nueva | en_revision | cotizada | aceptada | rechazada | cancelada).",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarSolicitudesStaff(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-cotizar-solicitud",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/servicios/solicitudes/{id}/cotizar",
		Summary:     "Cotizar una solicitud",
		Description: "Crea una cotización (enviada) con monto, moneda y términos; la solicitud pasa a cotizada. " +
			"Una solicitud admite re-cotizaciones hasta que el cliente acepta. Auditoría servicio.cotizado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, cotizar(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-estado-solicitud-servicio",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/servicios/solicitudes/{id}/estado",
		Summary:     "Cambiar el estado de una solicitud",
		Description: "Transiciones válidas: tomar (nueva → en_revision), descartar (nueva/en_revision/cotizada " +
			"→ rechazada), cancelar (nueva/en_revision/cotizada → cancelada). Con motivo y auditoría servicio.estado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, cambiarEstadoSolicitud(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-crear-entrega",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/servicios/proyectos/{id}/entregas",
		Summary:     "Publicar una entrega del proyecto",
		Description: "Multipart con exactamente uno de: track_id (pista vendida: exige master publicado y concede " +
			"el entitlement del cliente con grant_source=service, ON CONFLICT DO NOTHING: repetir no duplica el " +
			"acceso) o archivo (privado en services/, máximo 5 MiB, MIME por contenido). Auditoría " +
			"servicio.entregado y, cuando se concede, acceso.concedido en la misma transacción.",
		MaxBodyBytes: maxAdjuntoBytes + 64*1024,
		Tags:         []string{"staff"},
		Security:     []map[string][]string{{"bearer": {}}},
		Middlewares:  []func(huma.Context, func(huma.Context)){staff},
	}, crearEntrega(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "staff-estado-proyecto-servicio",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/servicios/proyectos/{id}/estado",
		Summary:     "Cambiar el estado de un proyecto",
		Description: "Transiciones válidas: marcar_entregado (en_curso → entregado; exige al menos una entrega) y " +
			"cerrar (entregado → cerrado). Con motivo y auditoría servicio.proyecto_estado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, cambiarEstadoProyecto(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-aprobar-pago-servicio",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/servicios/pagos/{id}/aprobar",
		Summary:     "Confirmar el pago de un servicio",
		Description: "Transacción idempotente: confirma el comprobante revisado. No concede acceso alguno: los " +
			"servicios jamás crean entitlements por pago (el único acceso posible es el de la entrega de pista). " +
			"Auditoría servicio.pago_confirmado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, revisarPagoServicio(db, true))

	huma.Register(api, huma.Operation{
		OperationID: "staff-rechazar-pago-servicio",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/servicios/pagos/{id}/rechazar",
		Summary:     "Rechazar el pago de un servicio",
		Description: "Marca el comprobante rechazado con motivo y auditoría servicio.pago_rechazado; el cliente " +
			"puede subir otro comprobante. Idempotente si ya estaba rechazado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, revisarPagoServicio(db, false))
}

// ── Listado staff ──────────────────────────────────────────────────────────

type solicitudStaffItem struct {
	ID            string          `json:"id"`
	UsuarioID     string          `json:"usuario_id"`
	UsuarioMail   string          `json:"usuario_email"`
	Tipo          string          `json:"tipo"`
	Titulo        string          `json:"titulo"`
	Descripcion   string          `json:"descripcion"`
	Referencias   json.RawMessage `json:"referencias"`
	Estado        string          `json:"estado"`
	CreadaEn      time.Time       `json:"creada_en"`
	ActualizadaEn time.Time       `json:"actualizada_en"`
	Proyecto      *proyectoCorto  `json:"proyecto"`
}

type listarSolicitudesStaffInput struct {
	Estado string `query:"estado" required:"false" enum:"nueva,en_revision,cotizada,aceptada,rechazada,cancelada" doc:"Filtro opcional por estado"`
}

type listarSolicitudesStaffOutput struct {
	Body struct {
		Solicitudes []solicitudStaffItem `json:"solicitudes"`
	}
}

func listarSolicitudesStaff(db database.DB) func(ctx context.Context, in *listarSolicitudesStaffInput) (*listarSolicitudesStaffOutput, error) {
	return func(ctx context.Context, in *listarSolicitudesStaffInput) (*listarSolicitudesStaffOutput, error) {
		where, args := "", []any{}
		if in.Estado != "" {
			args = append(args, in.Estado)
			where = "where sr.estado = $1"
		}
		out := &listarSolicitudesStaffOutput{}
		out.Body.Solicitudes = []solicitudStaffItem{}

		rows, err := db.Query(ctx, `
			select sr.id, sr.user_id, coalesce(p.email, ''), sr.tipo, sr.titulo, sr.descripcion,
			       sr.referencias, sr.estado, sr.created_at, sr.updated_at,
			       (select json_build_object('id', pr.id, 'estado', pr.estado)::text
			          from service_projects pr where pr.request_id = sr.id)
			from service_requests sr
			left join profiles p on p.id = sr.user_id
			`+where+`
			order by sr.created_at desc limit 100`, args...)
		if err != nil {
			return nil, apierr.Internal("error consultando las solicitudes", err)
		}
		defer rows.Close()
		for rows.Next() {
			var s solicitudStaffItem
			var proyectoJSON *string
			if err := rows.Scan(&s.ID, &s.UsuarioID, &s.UsuarioMail, &s.Tipo, &s.Titulo, &s.Descripcion,
				&s.Referencias, &s.Estado, &s.CreadaEn, &s.ActualizadaEn, &proyectoJSON); err != nil {
				return nil, apierr.Internal("error leyendo las solicitudes", err)
			}
			if proyectoJSON != nil {
				var p proyectoCorto
				if err := json.Unmarshal([]byte(*proyectoJSON), &p); err == nil {
					s.Proyecto = &p
				}
			}
			out.Body.Solicitudes = append(out.Body.Solicitudes, s)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo las solicitudes", err)
		}
		return out, nil
	}
}

// ── Cotizar ────────────────────────────────────────────────────────────────

type cotizarInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID de la solicitud"`
	Body struct {
		MontoMinor int64  `json:"monto_minor" minimum:"1" doc:"Precio del encargo en unidades menores"`
		Moneda     string `json:"moneda" minLength:"3" maxLength:"3" doc:"ISO 4217"`
		TermsText  string `json:"terms_text" minLength:"10" maxLength:"20000" doc:"Alcance, entregables y condiciones del encargo"`
	}
}

type cotizarOutput struct {
	Body cotizacionResumen
}

func cotizar(db database.DB) func(ctx context.Context, in *cotizarInput) (*cotizarOutput, error) {
	return func(ctx context.Context, in *cotizarInput) (*cotizarOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		moneda := strings.ToUpper(strings.TrimSpace(in.Body.Moneda))

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado string
		err = tx.QueryRow(ctx, `
			select estado from service_requests where id = $1 for update`, in.ID).Scan(&estado)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("solicitud no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la solicitud", err)
		}
		switch estado {
		case "nueva", "en_revision", "cotizada":
		default:
			return nil, huma.Error409Conflict("la solicitud no admite cotización en su estado actual")
		}

		var c cotizacionResumen
		err = tx.QueryRow(ctx, `
			insert into service_quotes (request_id, staff_id, amount_minor, currency, terms_text)
			values ($1, $2, $3, $4, $5)
			returning id, request_id, amount_minor, currency, terms_text, estado, created_at`,
			in.ID, claims.Subject, in.Body.MontoMinor, moneda, in.Body.TermsText,
		).Scan(&c.ID, &c.SolicitudID, &c.MontoMinor, &c.Moneda, &c.TermsText, &c.Estado, &c.CreadaEn)
		if err != nil {
			return nil, apierr.Internal("error creando la cotización", err)
		}
		if _, err := tx.Exec(ctx, `
			update service_requests set estado = 'cotizada' where id = $1`, in.ID); err != nil {
			return nil, apierr.Internal("error actualizando la solicitud", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.cotizado", "service_request", in.ID,
			map[string]any{"cotizacion_id": c.ID, "monto_minor": in.Body.MontoMinor, "moneda": moneda}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		out := &cotizarOutput{}
		out.Body = c
		return out, nil
	}
}

// ── Estado de la solicitud ─────────────────────────────────────────────────

type estadoSolicitudInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID de la solicitud"`
	Body struct {
		Accion string `json:"accion" enum:"tomar,descartar,cancelar" doc:"tomar: nueva → en_revision; descartar → rechazada; cancelar → cancelada"`
		Motivo string `json:"motivo,omitempty" maxLength:"500"`
	}
}

type estadoSolicitudOutput struct {
	Body struct {
		ID     string `json:"id"`
		Estado string `json:"estado"`
	}
}

func cambiarEstadoSolicitud(db database.DB) func(ctx context.Context, in *estadoSolicitudInput) (*estadoSolicitudOutput, error) {
	transiciones := map[string]map[string]string{
		"tomar":     {"nueva": "en_revision"},
		"descartar": {"nueva": "rechazada", "en_revision": "rechazada", "cotizada": "rechazada"},
		"cancelar":  {"nueva": "cancelada", "en_revision": "cancelada", "cotizada": "cancelada"},
	}
	return func(ctx context.Context, in *estadoSolicitudInput) (*estadoSolicitudOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estadoActual string
		err = tx.QueryRow(ctx, `
			select estado from service_requests where id = $1 for update`, in.ID).Scan(&estadoActual)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("solicitud no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la solicitud", err)
		}
		estadoNuevo, valida := transiciones[in.Body.Accion][estadoActual]
		if !valida {
			return nil, huma.Error409Conflict("transición inválida para el estado actual de la solicitud")
		}

		if _, err := tx.Exec(ctx, `
			update service_requests set estado = $2 where id = $1`, in.ID, estadoNuevo); err != nil {
			return nil, apierr.Internal("error actualizando la solicitud", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.estado", "service_request", in.ID,
			map[string]any{"accion": in.Body.Accion, "estado_anterior": estadoActual,
				"estado_nuevo": estadoNuevo, "motivo": in.Body.Motivo}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}

		out := &estadoSolicitudOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = estadoNuevo
		return out, nil
	}
}

// ── Entregas ───────────────────────────────────────────────────────────────

type crearEntregaInput struct {
	ID      string `path:"id" format:"uuid" doc:"ID del proyecto"`
	RawBody huma.MultipartFormFiles[struct {
		Titulo  string        `form:"titulo" required:"true" minLength:"3" maxLength:"200"`
		Nota    string        `form:"nota" required:"false" maxLength:"2000"`
		TrackID string        `form:"track_id" required:"false" doc:"ID de la pista vendida (sin archivo)"`
		Archivo huma.FormFile `form:"archivo" required:"false" doc:"Archivo privado (sin track_id)"`
	}]
}

type crearEntregaOutput struct {
	Body struct {
		Entrega      entregaResumen `json:"entrega"`
		AccesoCreado bool           `json:"acceso_creado" doc:"true cuando la entrega concedió el entitlement (solo pistas)"`
	}
}

func crearEntrega(db database.DB, objects storage.Client) func(ctx context.Context, in *crearEntregaInput) (*crearEntregaOutput, error) {
	return func(ctx context.Context, in *crearEntregaInput) (*crearEntregaOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		form := in.RawBody.Data()
		conTrack := strings.TrimSpace(form.TrackID) != ""
		conArchivo := form.Archivo.IsSet
		if conTrack == conArchivo {
			return nil, huma.Error422UnprocessableEntity("la entrega requiere exactamente uno de track_id o archivo")
		}

		// El proyecto debe existir y estar en curso (lock).
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var projectUserID, projectEstado string
		err = tx.QueryRow(ctx, `
			select user_id, estado from service_projects where id = $1 for update`, in.ID,
		).Scan(&projectUserID, &projectEstado)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("proyecto no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el proyecto", err)
		}
		if projectEstado != "en_curso" {
			return nil, huma.Error409Conflict("el proyecto no admite entregas en su estado actual")
		}

		out := &crearEntregaOutput{}
		if conTrack {
			entrega, creado, err := entregarPista(ctx, tx, claims.Subject, in.ID, projectUserID, form.Titulo, form.Nota, form.TrackID)
			if err != nil {
				return nil, err
			}
			out.Body.Entrega = *entrega
			out.Body.AccesoCreado = creado
		} else {
			entrega, err := entregarArchivo(ctx, tx, objects, claims.Subject, in.ID, form.Titulo, form.Nota, form.Archivo)
			if err != nil {
				return nil, err
			}
			out.Body.Entrega = *entrega
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		return out, nil
	}
}

// entregarPista registra la entrega de una pista vendida y concede, en la
// misma transacción, el entitlement del cliente (grant_source='service').
// ON CONFLICT DO NOTHING sobre entitlements_active_track_uidx: repetir la
// entrega no duplica el acceso. Jamás crea licencias ni períodos Premium.
func entregarPista(ctx context.Context, tx pgx.Tx, staffID, projectID, projectUserID, titulo, nota, trackID string) (*entregaResumen, bool, error) {
	// El track_id llega por formulario multipart (sin validación format de
	// Huma): un UUID mal formado sería un 500 en la consulta, no un 4xx.
	if !uuidRe.MatchString(trackID) {
		return nil, false, huma.Error422UnprocessableEntity("la pista no existe o no tiene master publicado")
	}
	// La pista debe tener master publicado (rol master, relación publicada,
	// asset vigente); si no existe o no lo tiene → 422.
	var trackTitulo string
	err := tx.QueryRow(ctx, `
		select t.title
		from tracks t
		where t.id = $1 and t.deleted_at is null
		  and exists (
		    select 1 from track_media tm
		    join media_assets ma on ma.id = tm.media_asset_id and ma.deleted_at is null
		    where tm.track_id = t.id and tm.role = 'master' and tm.is_published
		  )`, trackID).Scan(&trackTitulo)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, huma.Error422UnprocessableEntity("la pista no existe o no tiene master publicado")
	}
	if err != nil {
		return nil, false, apierr.Internal("error consultando la pista", err)
	}

	var entregaID string
	var creadaEn time.Time
	err = tx.QueryRow(ctx, `
		insert into service_deliverables (project_id, staff_id, titulo, nota, track_id)
		values ($1, $2, $3, $4, $5)
		returning id, created_at`, projectID, staffID, titulo, notaNull(nota), trackID,
	).Scan(&entregaID, &creadaEn)
	if err != nil {
		return nil, false, apierr.Internal("error registrando la entrega", err)
	}

	// Acceso vinculado: idempotente por el índice único parcial vigente.
	accesoCreado := false
	var accesoID string
	err = tx.QueryRow(ctx, `
		insert into entitlements (user_id, track_id, grant_source)
		values ($1, $2, 'service')
		on conflict do nothing
		returning id`, projectUserID, trackID).Scan(&accesoID)
	if err == nil {
		accesoCreado = true
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, apierr.Internal("error concediendo el acceso", err)
	}

	if err := registrarAuditoria(ctx, tx, staffID, "servicio.entregado", "service_deliverable", entregaID,
		map[string]any{"proyecto_id": projectID, "pista_id": trackID, "tipo": "pista"}); err != nil {
		return nil, false, apierr.Internal("error registrando auditoría", err)
	}
	if accesoCreado {
		if err := registrarAuditoria(ctx, tx, staffID, "acceso.concedido", "entitlement", accesoID,
			map[string]any{"proyecto_id": projectID, "pista_id": trackID, "usuario_id": projectUserID,
				"origen": "service", "entrega_id": entregaID}); err != nil {
			return nil, false, apierr.Internal("error registrando auditoría de acceso", err)
		}
	}

	return &entregaResumen{
		ID:       entregaID,
		Titulo:   titulo,
		Nota:     nota,
		Tipo:     "pista",
		Pista:    &pistaCorta{ID: trackID, Titulo: trackTitulo},
		CreadaEn: creadaEn,
	}, accesoCreado, nil
}

// entregarArchivo sube el archivo privado a MinIO y registra la entrega.
func entregarArchivo(ctx context.Context, tx pgx.Tx, objects storage.Client, staffID, projectID, titulo, nota string, archivo huma.FormFile) (*entregaResumen, error) {
	if archivo.Size > maxAdjuntoBytes {
		return nil, huma.Error422UnprocessableEntity("el archivo supera el máximo de 5 MiB")
	}
	mimeType, err := detectarMIME(archivo, entregaExt)
	if err != nil {
		return nil, err
	}
	key := fmt.Sprintf("services/proyectos/%s/entregas/%d%s", projectID, time.Now().UnixNano(), entregaExt[mimeType])
	if err := objects.PutObject(ctx, key, mimeType, archivo); err != nil {
		return nil, apierr.Internal("error guardando la entrega", err)
	}

	var entregaID string
	var creadaEn time.Time
	err = tx.QueryRow(ctx, `
		insert into service_deliverables (project_id, staff_id, titulo, nota, file_key, mime, size_bytes)
		values ($1, $2, $3, $4, $5, $6, $7)
		returning id, created_at`, projectID, staffID, titulo, notaNull(nota), key, mimeType, archivo.Size,
	).Scan(&entregaID, &creadaEn)
	if err != nil {
		return nil, apierr.Internal("error registrando la entrega", err)
	}
	if err := registrarAuditoria(ctx, tx, staffID, "servicio.entregado", "service_deliverable", entregaID,
		map[string]any{"proyecto_id": projectID, "tipo": "archivo", "mime": mimeType, "bytes": archivo.Size}); err != nil {
		return nil, apierr.Internal("error registrando auditoría", err)
	}
	return &entregaResumen{
		ID:       entregaID,
		Titulo:   titulo,
		Nota:     nota,
		Tipo:     "archivo",
		CreadaEn: creadaEn,
	}, nil
}

func notaNull(nota string) *string {
	if strings.TrimSpace(nota) == "" {
		return nil
	}
	return &nota
}

// ── Estado del proyecto ────────────────────────────────────────────────────

type estadoProyectoInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID del proyecto"`
	Body struct {
		Accion string `json:"accion" enum:"marcar_entregado,cerrar" doc:"marcar_entregado: en_curso → entregado; cerrar: entregado → cerrado"`
		Motivo string `json:"motivo,omitempty" maxLength:"500"`
	}
}

type estadoProyectoOutput struct {
	Body struct {
		ID     string `json:"id"`
		Estado string `json:"estado"`
	}
}

func cambiarEstadoProyecto(db database.DB) func(ctx context.Context, in *estadoProyectoInput) (*estadoProyectoOutput, error) {
	return func(ctx context.Context, in *estadoProyectoInput) (*estadoProyectoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estadoActual string
		err = tx.QueryRow(ctx, `
			select estado from service_projects where id = $1 for update`, in.ID).Scan(&estadoActual)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("proyecto no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el proyecto", err)
		}

		var estadoNuevo string
		switch in.Body.Accion {
		case "marcar_entregado":
			if estadoActual != "en_curso" {
				return nil, huma.Error409Conflict("marcar_entregado exige un proyecto en curso")
			}
			var entregas int
			if err := tx.QueryRow(ctx, `
				select count(*) from service_deliverables where project_id = $1`, in.ID).Scan(&entregas); err != nil {
				return nil, apierr.Internal("error contando las entregas", err)
			}
			if entregas == 0 {
				return nil, huma.Error422UnprocessableEntity("no se puede marcar entregado sin entregas publicadas")
			}
			estadoNuevo = "entregado"
		case "cerrar":
			if estadoActual != "entregado" {
				return nil, huma.Error409Conflict("cerrar exige un proyecto entregado")
			}
			estadoNuevo = "cerrado"
		}

		if _, err := tx.Exec(ctx, `
			update service_projects set estado = $2 where id = $1`, in.ID, estadoNuevo); err != nil {
			return nil, apierr.Internal("error actualizando el proyecto", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "servicio.proyecto_estado", "service_project", in.ID,
			map[string]any{"accion": in.Body.Accion, "estado_anterior": estadoActual,
				"estado_nuevo": estadoNuevo, "motivo": in.Body.Motivo}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}

		out := &estadoProyectoOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = estadoNuevo
		return out, nil
	}
}

// ── Revisión de pagos ──────────────────────────────────────────────────────

type revisarPagoServicioInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID del pago del servicio"`
	Body struct {
		Comentario string `json:"comentario,omitempty" maxLength:"500"`
	}
}

type revisarPagoServicioOutput struct {
	Body struct {
		PagoID           string     `json:"pago_id"`
		ProyectoID       string     `json:"proyecto_id"`
		Estado           string     `json:"estado"`
		YaEstabaRevisado bool       `json:"ya_estaba_revisado" doc:"true cuando la revisión fue idempotente"`
		RevisadoEn       *time.Time `json:"revisado_en,omitempty"`
		ProcesadoEn      time.Time  `json:"procesado_en"`
	}
}

// revisarPagoServicio confirma o rechaza el comprobante de un servicio. Es el
// único efecto posible sobre el pago: los servicios jamás crean entitlements,
// suscripciones ni licencias por un pago. Idempotente: repetir la revisión
// devuelve el estado actual.
func revisarPagoServicio(db database.DB, aprobar bool) func(ctx context.Context, in *revisarPagoServicioInput) (*revisarPagoServicioOutput, error) {
	return func(ctx context.Context, in *revisarPagoServicioInput) (*revisarPagoServicioOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado, proyectoID string
		err = tx.QueryRow(ctx, `
			select estado, project_id from service_payments where id = $1 for update`, in.ID,
		).Scan(&estado, &proyectoID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pago no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el pago", err)
		}

		estadoNuevo := "rejected"
		accion := "servicio.pago_rechazado"
		if aprobar {
			estadoNuevo = "confirmed"
			accion = "servicio.pago_confirmado"
		}

		out := &revisarPagoServicioOutput{}
		out.Body.PagoID = in.ID
		out.Body.ProyectoID = proyectoID
		out.Body.ProcesadoEn = time.Now()

		if estado == estadoNuevo {
			out.Body.Estado = estado
			out.Body.YaEstabaRevisado = true
			if err := tx.QueryRow(ctx, `
				select reviewed_at from service_payments where id = $1`, in.ID).Scan(&out.Body.RevisadoEn); err != nil {
				return nil, apierr.Internal("error consultando el pago", err)
			}
			if err := tx.Commit(ctx); err != nil {
				return nil, apierr.Internal("error confirmando la transacción", err)
			}
			return out, nil
		}
		if estado != "in_review" {
			return nil, huma.Error409Conflict("solo se puede revisar un comprobante en revisión")
		}

		if err := tx.QueryRow(ctx, `
			update service_payments
			set estado = $2, reviewed_by = $3, reviewed_at = now()
			where id = $1
			returning reviewed_at`, in.ID, estadoNuevo, claims.Subject).Scan(&out.Body.RevisadoEn); err != nil {
			return nil, apierr.Internal("error actualizando el pago", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, accion, "service_payment", in.ID,
			map[string]any{"proyecto_id": proyectoID, "comentario": in.Body.Comentario}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		out.Body.Estado = estadoNuevo
		return out, nil
	}
}
