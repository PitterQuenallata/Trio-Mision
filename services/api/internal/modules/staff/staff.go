// Package staff implementa la revisión de pagos y acceso para roles staff
// (admin, vendedor): listar pagos pendientes, ver comprobantes privados,
// aprobar/rechazar con auditoría, revisar entitlements y revocar acceso.
// La aprobación confirma el pago y aplica los efectos del snapshot en una
// transacción idempotente: período Premium o entitlements de las pistas
// congeladas; repetirla nunca duplica pagos, suscripciones ni accesos.
// El paquete también expone la administración comercial mínima: planes
// Premium, cupones y códigos de canje con auditoría transaccional.
package staff

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
	"triomision/api/internal/modules/store"
	"triomision/api/internal/storage"
)

// Register registra los endpoints staff con autorización por staff_roles.
func Register(api huma.API, db database.DB, store storage.Client, presignTTL time.Duration) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")
	RegisterComercial(api, db)

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-pagos",
		Method:      "GET",
		Path:        "/api/v1/staff/pagos",
		Summary:     "Listar pagos para revisión",
		Description: "Intentos de pago con su comprobante y orden. Filtro opcional por estado " +
			"(awaiting_evidence | in_review | confirmed | rejected).",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarPagos(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-obtener-pago",
		Method:      "GET",
		Path:        "/api/v1/staff/pagos/{id}",
		Summary:     "Detalle de un pago con comprobante",
		Description: "Incluye una URL firmada breve (5 min) del comprobante privado y la pista de auditoría del pago.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, obtenerPago(db, store))

	huma.Register(api, huma.Operation{
		OperationID: "staff-aprobar-pago",
		Method:      "POST",
		Path:        "/api/v1/staff/pagos/{id}/aprobar",
		Summary:     "Aprobar un pago y conceder acceso",
		Description: "Transacción idempotente: confirma el pago, marca la orden pagada y aplica los efectos " +
			"de sus ítems con snapshot: período Premium (suscripción que extiende el vigente) o entitlements " +
			"de las pistas congeladas (contenido vigente si include_future_tracks=true). Repetir la aprobación " +
			"devuelve el estado actual sin duplicar pagos, suscripciones ni accesos.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, aprobarPago(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-rechazar-pago",
		Method:      "POST",
		Path:        "/api/v1/staff/pagos/{id}/rechazar",
		Summary:     "Rechazar un pago",
		Description: "Marca el intento y su comprobante como rechazados; la orden queda pendiente para un nuevo intento.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, rechazarPago(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-accesos",
		Method:      "GET",
		Path:        "/api/v1/staff/accesos",
		Summary:     "Listar entitlements",
		Description: "Accesos concedidos con su origen y vigencia. Filtro opcional por usuario (UUID).",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarAccesos(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-revocar-acceso",
		Method:      "POST",
		Path:        "/api/v1/staff/accesos/{id}/revocar",
		Summary:     "Revocar un acceso",
		Description: "Marca el entitlement como revocado con motivo y auditoría. Idempotente si ya estaba revocado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, revocarAcceso(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-auditoria",
		Method:      "GET",
		Path:        "/api/v1/staff/auditoria",
		Summary:     "Pista de auditoría",
		Description: "Eventos de auditoría de operaciones sensibles. Filtros: entidad, accion, limite (máx 200).",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarAuditoria(db))
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type pagoListItem struct {
	ID           string     `json:"id"`
	Proveedor    string     `json:"proveedor"`
	Estado       string     `json:"estado"`
	MontoMinor   int64      `json:"monto_minor"`
	Moneda       string     `json:"moneda"`
	CreadoEn     time.Time  `json:"creado_en"`
	ConfirmadoEn *time.Time `json:"confirmado_en,omitempty"`
	Orden        struct {
		ID          string `json:"id"`
		TotalMinor  int64  `json:"total_minor"`
		Moneda      string `json:"moneda"`
		UsuarioID   string `json:"usuario_id"`
		UsuarioMail string `json:"usuario_email"`
	} `json:"orden"`
	Comprobante struct {
		Estado     string     `json:"estado" doc:"pending | approved | rejected | sin_comprobante"`
		CreadoEn   *time.Time `json:"creado_en,omitempty"`
		RevisadoEn *time.Time `json:"revisado_en,omitempty"`
	} `json:"comprobante"`
}

type pagoDetalle struct {
	Pago           pagoListItem      `json:"pago" doc:"Datos del intento de pago y su orden"`
	ComprobanteURL string            `json:"comprobante_url,omitempty" doc:"URL firmada breve (5 min) del comprobante"`
	ComprobanteKey string            `json:"comprobante_key,omitempty"`
	Comentario     string            `json:"comentario_revision,omitempty"`
	Items          []json.RawMessage `json:"items" doc:"Snapshots congelados de los ítems de la orden"`
	Auditoria      []auditItem       `json:"auditoria"`
}

type auditItem struct {
	Accion     string          `json:"accion"`
	ActorID    *string         `json:"actor_id,omitempty"`
	EntityType string          `json:"entidad"`
	EntityID   string          `json:"entidad_id"`
	Metadata   json.RawMessage `json:"metadata"`
	CreadoEn   time.Time       `json:"creado_en"`
}

const pagoColumnas = `
	select pa.id, pa.provider, pa.status, pa.amount_minor, pa.currency,
	       pa.created_at, pa.confirmed_at,
	       o.id, o.total_minor, o.currency, o.user_id, coalesce(au.email, ''),
	       coalesce(pe.review_status, 'sin_comprobante'), pe.created_at, pe.reviewed_at
	from payment_attempts pa
	join orders o on o.id = pa.order_id
	left join profiles au on au.id = o.user_id
	left join payment_evidence pe on pe.payment_attempt_id = pa.id`

func escanearPago(row pgx.Row) (*pagoListItem, error) {
	var p pagoListItem
	var comprobanteCreado, comprobanteRevisado *time.Time
	err := row.Scan(&p.ID, &p.Proveedor, &p.Estado, &p.MontoMinor, &p.Moneda,
		&p.CreadoEn, &p.ConfirmadoEn,
		&p.Orden.ID, &p.Orden.TotalMinor, &p.Orden.Moneda, &p.Orden.UsuarioID, &p.Orden.UsuarioMail,
		&p.Comprobante.Estado, &comprobanteCreado, &comprobanteRevisado)
	if err != nil {
		return nil, err
	}
	p.Comprobante.CreadoEn = comprobanteCreado
	p.Comprobante.RevisadoEn = comprobanteRevisado
	return &p, nil
}

type listarPagosInput struct {
	Estado string `query:"estado" required:"false" enum:"awaiting_evidence,in_review,confirmed,rejected" doc:"Filtro opcional por estado"`
}

type listarPagosOutput struct {
	Body struct {
		Pagos []pagoListItem `json:"pagos"`
	}
}

func listarPagos(db database.DB) func(context.Context, *listarPagosInput) (*listarPagosOutput, error) {
	return func(ctx context.Context, in *listarPagosInput) (*listarPagosOutput, error) {
		where, args := "", []any{}
		if in.Estado != "" {
			args = append(args, in.Estado)
			where = "where pa.status = $1"
		}
		rows, err := db.Query(ctx, pagoColumnas+" "+where+" order by pa.created_at desc limit 100", args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los pagos", err)
		}
		defer rows.Close()

		out := &listarPagosOutput{}
		out.Body.Pagos = []pagoListItem{}
		for rows.Next() {
			p, err := escanearPago(rows)
			if err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los pagos", err)
			}
			out.Body.Pagos = append(out.Body.Pagos, *p)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los pagos", err)
		}
		return out, nil
	}
}

type obtenerPagoInput struct {
	ID string `path:"id" format:"uuid"`
}

type obtenerPagoOutput struct {
	Body pagoDetalle
}

func obtenerPago(db database.DB, store storage.Client) func(context.Context, *obtenerPagoInput) (*obtenerPagoOutput, error) {
	return func(ctx context.Context, in *obtenerPagoInput) (*obtenerPagoOutput, error) {
		p, err := escanearPago(db.QueryRow(ctx, pagoColumnas+" where pa.id = $1", in.ID))
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pago no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el pago", err)
		}

		out := &obtenerPagoOutput{}
		out.Body.Pago = *p
		out.Body.Items = []json.RawMessage{}
		out.Body.Auditoria = []auditItem{}

		// Comprobante privado: URL firmada breve solo para staff.
		var key, comentario string
		err = db.QueryRow(ctx, `
			select private_storage_key, coalesce(review_comment, '')
			from payment_evidence where payment_attempt_id = $1`, in.ID).Scan(&key, &comentario)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando el comprobante", err)
		}
		if key != "" {
			out.Body.ComprobanteKey = key
			out.Body.Comentario = comentario
			url, err := store.PresignGet(ctx, key, 5*time.Minute)
			if err != nil {
				return nil, huma.Error500InternalServerError("error firmando el comprobante", err)
			}
			out.Body.ComprobanteURL = url
		}

		rows, err := db.Query(ctx, `
			select product_snapshot, content_snapshot from order_items where order_id = $1`, p.Orden.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los ítems", err)
		}
		defer rows.Close()
		for rows.Next() {
			var product, content json.RawMessage
			if err := rows.Scan(&product, &content); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los ítems", err)
			}
			out.Body.Items = append(out.Body.Items, product, content)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los ítems", err)
		}
		rows.Close()

		auditRows, err := db.Query(ctx, `
			select action, actor_id, entity_type, entity_id, metadata, created_at
			from audit_events
			where (entity_type = 'payment_attempt' and entity_id = $1)
			   or (entity_type = 'entitlement' and metadata->>'payment_attempt_id' = $1)
			order by created_at asc limit 50`, in.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la auditoría", err)
		}
		defer auditRows.Close()
		for auditRows.Next() {
			var a auditItem
			if err := auditRows.Scan(&a.Accion, &a.ActorID, &a.EntityType, &a.EntityID, &a.Metadata, &a.CreadoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo la auditoría", err)
			}
			out.Body.Auditoria = append(out.Body.Auditoria, a)
		}
		if err := auditRows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo la auditoría", err)
		}
		return out, nil
	}
}

// ── Aprobación y rechazo ───────────────────────────────────────────────────

type revisarPagoInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Comentario string `json:"comentario,omitempty" maxLength:"500"`
	}
}

type revisarPagoOutput struct {
	Body struct {
		PagoID               string    `json:"pago_id"`
		Estado               string    `json:"estado"`
		OrdenID              string    `json:"orden_id"`
		OrdenEstado          string    `json:"orden_estado"`
		AccesosCreados       int       `json:"accesos_creados" doc:"0 cuando la aprobación fue idempotente (no duplicó nada)"`
		AccesosTotales       int       `json:"accesos_totales" doc:"Accesos vigentes de la orden tras la operación"`
		SuscripcionesCreados int       `json:"suscripciones_creados" doc:"Períodos Premium creados (0 si no era una orden premium o fue idempotente)"`
		SuscripcionesTotales int       `json:"suscripciones_totales" doc:"Suscripciones ligadas a la orden tras la operación"`
		YaEstabaConfirmado   bool      `json:"ya_estaba_confirmado" doc:"true cuando la aprobación fue idempotente (no duplicó nada)"`
		ProcesadoEn          time.Time `json:"procesado_en"`
	}
}

// registrarAuditoria inserta un evento de auditoría (usa la tx activa si hay).
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}

func aprobarPago(db database.DB) func(context.Context, *revisarPagoInput) (*revisarPagoOutput, error) {
	return func(ctx context.Context, in *revisarPagoInput) (*revisarPagoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		staffID := claims.Subject

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var (
			estado  string
			orderID string
		)
		err = tx.QueryRow(ctx, `
			select status, order_id from payment_attempts where id = $1 for update`, in.ID,
		).Scan(&estado, &orderID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pago no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el pago", err)
		}

		out := &revisarPagoOutput{}
		out.Body.PagoID = in.ID
		out.Body.OrdenID = orderID
		out.Body.ProcesadoEn = time.Now()

		// Bloquear la orden serializa aprobaciones de intentos distintos.
		if err := tx.QueryRow(ctx, `select status from orders where id = $1 for update`, orderID).Scan(&out.Body.OrdenEstado); err != nil {
			return nil, huma.Error500InternalServerError("error consultando la orden", err)
		}

		if estado == "confirmed" {
			// Repetir la aprobación del mismo pago no modifica pagos ni accesos.
			if err := tx.QueryRow(ctx, `
				select count(*) from entitlements where order_item_id in
					(select id from order_items where order_id = $1)`, orderID).Scan(&out.Body.AccesosTotales); err != nil {
				return nil, huma.Error500InternalServerError("error contando los accesos", err)
			}
			if err := tx.QueryRow(ctx, `
				select count(*) from subscriptions where order_item_id in
					(select id from order_items where order_id = $1)`, orderID).Scan(&out.Body.SuscripcionesTotales); err != nil {
				return nil, huma.Error500InternalServerError("error contando las suscripciones", err)
			}
			out.Body.Estado = "confirmed"
			out.Body.YaEstabaConfirmado = true
			if err := tx.Commit(ctx); err != nil {
				return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
			}
			return out, nil
		}
		if estado != "in_review" {
			return nil, huma.Error409Conflict("solo se puede aprobar un pago con comprobante en revisión")
		}
		if out.Body.OrdenEstado != "pending" {
			return nil, huma.Error409Conflict("la orden ya tiene un pago confirmado o no admite revisión")
		}

		if _, err := tx.Exec(ctx, `
			update payment_attempts set status = 'confirmed', confirmed_at = now()
			where id = $1`, in.ID); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando el pago", err)
		}
		if _, err := tx.Exec(ctx, `
			update payment_evidence set review_status = 'approved', reviewed_by = $2,
				reviewed_at = now(), review_comment = coalesce($3, review_comment)
			where payment_attempt_id = $1`, in.ID, staffID, in.Body.Comentario); err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el comprobante", err)
		}
		orderTag, err := tx.Exec(ctx, `
			update orders set status = 'paid', paid_at = coalesce(paid_at, now())
			where id = $1 and status = 'pending'`, orderID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error marcando la orden pagada", err)
		}
		if orderTag.RowsAffected() != 1 {
			return nil, huma.Error409Conflict("la orden ya tiene un pago confirmado o no admite revisión")
		}
		if err := registrarAuditoria(ctx, tx, staffID, "pago.aprobado", "payment_attempt", in.ID,
			map[string]any{"orden_id": orderID, "comentario": in.Body.Comentario}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}

		// Efectos por ítem de la orden, en la misma transacción y con locks:
		//   - producto premium  → período de suscripción (extiende el vigente)
		//   - paquete/pista     → entitlements de las pistas del snapshot
		//     (o del contenido vigente si include_future_tracks=true)
		// ON CONFLICT garantiza que ni una doble aprobación ni una carrera de
		// dos clics dupliquen períodos ni accesos.
		var userID string
		if err := tx.QueryRow(ctx, `select user_id from orders where id = $1`, orderID).Scan(&userID); err != nil {
			return nil, huma.Error500InternalServerError("error consultando la orden", err)
		}
		type itemEfecto struct {
			itemID          string
			productID       string
			productType     string
			planID          string
			durationDays    int
			includeFuture   bool
			contentSnapshot json.RawMessage
		}
		items := []itemEfecto{}
		itemRows, err := tx.Query(ctx, `
			select id, product_snapshot, content_snapshot
			from order_items where order_id = $1`, orderID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los ítems de la orden", err)
		}
		for itemRows.Next() {
			var it itemEfecto
			var productSnapshot json.RawMessage
			if err := itemRows.Scan(&it.itemID, &productSnapshot, &it.contentSnapshot); err != nil {
				itemRows.Close()
				return nil, huma.Error500InternalServerError("error leyendo los ítems de la orden", err)
			}
			var product struct {
				ID   string `json:"product_id"`
				Tipo string `json:"tipo"`
			}
			var content struct {
				Plan *struct {
					ID       string `json:"plan_id"`
					Duracion int    `json:"duracion_dias"`
				} `json:"plan"`
				IncludeFuture bool `json:"include_future_tracks"`
			}
			if err := json.Unmarshal(productSnapshot, &product); err != nil {
				itemRows.Close()
				return nil, huma.Error500InternalServerError("error interpretando el producto congelado", err)
			}
			if err := json.Unmarshal(it.contentSnapshot, &content); err != nil {
				itemRows.Close()
				return nil, huma.Error500InternalServerError("error interpretando el contenido congelado", err)
			}
			it.productID, it.productType, it.includeFuture = product.ID, product.Tipo, content.IncludeFuture
			if content.Plan != nil {
				it.planID, it.durationDays = content.Plan.ID, content.Plan.Duracion
			}
			items = append(items, it)
		}
		itemRows.Close()
		if err := itemRows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los ítems de la orden", err)
		}

		for _, it := range items {
			switch {
			case it.productType == "premium":
				if it.planID == "" || it.durationDays <= 0 {
					return nil, huma.Error500InternalServerError("el snapshot premium no tiene un plan y duración válidos")
				}
				creada, err := store.ConcederPremium(ctx, tx, userID, it.planID, it.durationDays, &it.itemID, nil, "purchase")
				if err != nil {
					return nil, huma.Error500InternalServerError("error concediendo el período premium", err)
				}
				if creada {
					out.Body.SuscripcionesCreados++
				}
			case it.includeFuture:
				n, err := store.ConcederPistasProducto(ctx, tx, userID, it.productID, &it.itemID, nil, "purchase")
				if err != nil {
					return nil, huma.Error500InternalServerError("error concediendo el acceso", err)
				}
				out.Body.AccesosCreados += int(n)
			default:
				n, err := store.ConcederPistasSnapshot(ctx, tx, userID, &it.itemID, it.contentSnapshot, "purchase")
				if err != nil {
					return nil, huma.Error500InternalServerError("error concediendo el acceso", err)
				}
				out.Body.AccesosCreados += int(n)
			}
		}

		if err := tx.QueryRow(ctx, `
			select count(*) from entitlements where order_item_id in
				(select id from order_items where order_id = $1)`, orderID).Scan(&out.Body.AccesosTotales); err != nil {
			return nil, huma.Error500InternalServerError("error contando los accesos", err)
		}
		if err := tx.QueryRow(ctx, `
			select count(*) from subscriptions where order_item_id in
				(select id from order_items where order_id = $1)`, orderID).Scan(&out.Body.SuscripcionesTotales); err != nil {
			return nil, huma.Error500InternalServerError("error contando las suscripciones", err)
		}
		if err := registrarAuditoria(ctx, tx, staffID, "acceso.concedido", "entitlement", orderID,
			map[string]any{"orden_id": orderID, "payment_attempt_id": in.ID,
				"accesos": out.Body.AccesosCreados, "suscripciones": out.Body.SuscripcionesCreados, "usuario_id": userID}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.QueryRow(ctx, `select status from orders where id = $1`, orderID).Scan(&out.Body.OrdenEstado); err != nil {
			return nil, huma.Error500InternalServerError("error consultando la orden", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		out.Body.Estado = "confirmed"
		return out, nil
	}
}

func rechazarPago(db database.DB) func(context.Context, *revisarPagoInput) (*revisarPagoOutput, error) {
	return func(ctx context.Context, in *revisarPagoInput) (*revisarPagoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		staffID := claims.Subject

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado string
		err = tx.QueryRow(ctx, `
			select status from payment_attempts where id = $1 for update`, in.ID).Scan(&estado)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pago no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el pago", err)
		}
		if estado != "in_review" {
			return nil, huma.Error409Conflict("solo se puede rechazar un pago con comprobante en revisión")
		}

		if _, err := tx.Exec(ctx, `
			update payment_attempts set status = 'rejected' where id = $1`, in.ID); err != nil {
			return nil, huma.Error500InternalServerError("error rechazando el pago", err)
		}
		if _, err := tx.Exec(ctx, `
			update payment_evidence set review_status = 'rejected', reviewed_by = $2,
				reviewed_at = now(), review_comment = coalesce($3, review_comment)
			where payment_attempt_id = $1`, in.ID, staffID, in.Body.Comentario); err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el comprobante", err)
		}
		if err := registrarAuditoria(ctx, tx, staffID, "pago.rechazado", "payment_attempt", in.ID,
			map[string]any{"comentario": in.Body.Comentario}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}

		out := &revisarPagoOutput{}
		out.Body.PagoID = in.ID
		out.Body.Estado = "rejected"
		out.Body.ProcesadoEn = time.Now()
		return out, nil
	}
}

// ── Accesos y auditoría ────────────────────────────────────────────────────

type accesoItem struct {
	ID          string     `json:"id"`
	UsuarioID   string     `json:"usuario_id"`
	UsuarioMail string     `json:"usuario_email"`
	PistaID     string     `json:"pista_id"`
	PistaTitulo string     `json:"pista_titulo"`
	Origen      string     `json:"origen"`
	ConcedidoEn time.Time  `json:"concedido_en"`
	RevocadoEn  *time.Time `json:"revocado_en,omitempty"`
	ValidoHasta *time.Time `json:"valido_hasta,omitempty"`
}

type listarAccesosInput struct {
	Usuario string `query:"usuario" required:"false" format:"uuid" doc:"Filtro opcional por UUID de usuario"`
}

type listarAccesosOutput struct {
	Body struct {
		Accesos []accesoItem `json:"accesos"`
	}
}

func listarAccesos(db database.DB) func(context.Context, *listarAccesosInput) (*listarAccesosOutput, error) {
	return func(ctx context.Context, in *listarAccesosInput) (*listarAccesosOutput, error) {
		where, args := "", []any{}
		if in.Usuario != "" {
			args = append(args, in.Usuario)
			where = "where e.user_id = $1"
		}
		rows, err := db.Query(ctx, `
			select e.id, e.user_id, coalesce(au.email, ''), t.id, t.title,
			       e.grant_source, e.granted_at, e.revoked_at, e.valid_until
			from entitlements e
			join tracks t on t.id = e.track_id
			left join profiles au on au.id = e.user_id
			`+where+`
			order by e.granted_at desc limit 200`, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los accesos", err)
		}
		defer rows.Close()

		out := &listarAccesosOutput{}
		out.Body.Accesos = []accesoItem{}
		for rows.Next() {
			var a accesoItem
			if err := rows.Scan(&a.ID, &a.UsuarioID, &a.UsuarioMail, &a.PistaID, &a.PistaTitulo,
				&a.Origen, &a.ConcedidoEn, &a.RevocadoEn, &a.ValidoHasta); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los accesos", err)
			}
			out.Body.Accesos = append(out.Body.Accesos, a)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los accesos", err)
		}
		return out, nil
	}
}

type revocarAccesoInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Motivo string `json:"motivo" minLength:"3" maxLength:"500"`
	}
}

type revocarAccesoOutput struct {
	Body struct {
		ID         string    `json:"id"`
		Estado     string    `json:"estado" doc:"revocado"`
		RevocadoEn time.Time `json:"revocado_en"`
	}
}

func revocarAcceso(db database.DB) func(context.Context, *revocarAccesoInput) (*revocarAccesoOutput, error) {
	return func(ctx context.Context, in *revocarAccesoInput) (*revocarAccesoOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var revocadoEn time.Time
		err = tx.QueryRow(ctx, `
			update entitlements
			set revoked_at = coalesce(revoked_at, now()), revoked_reason = $2
			where id = $1
			returning revoked_at`, in.ID, in.Body.Motivo).Scan(&revocadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("acceso no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error revocando el acceso", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "acceso.revocado", "entitlement", in.ID,
			map[string]any{"motivo": in.Body.Motivo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}

		out := &revocarAccesoOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = "revocado"
		out.Body.RevocadoEn = revocadoEn
		return out, nil
	}
}

type listarAuditoriaInput struct {
	Entidad string `query:"entidad" required:"false" doc:"Filtro por tipo de entidad (p. ej. payment_attempt)"`
	Accion  string `query:"accion" required:"false" doc:"Filtro por acción (p. ej. pago.aprobado)"`
	Limite  int    `query:"limite" required:"false" maximum:"200" doc:"Máximo de eventos (default 50)"`
}

type listarAuditoriaOutput struct {
	Body struct {
		Eventos []auditItem `json:"eventos"`
	}
}

func listarAuditoria(db database.DB) func(context.Context, *listarAuditoriaInput) (*listarAuditoriaOutput, error) {
	return func(ctx context.Context, in *listarAuditoriaInput) (*listarAuditoriaOutput, error) {
		limite := in.Limite
		if limite <= 0 {
			limite = 50
		}
		where, args := "where true", []any{}
		if in.Entidad != "" {
			args = append(args, in.Entidad)
			where += " and entity_type = $" + itoa(len(args))
		}
		if in.Accion != "" {
			args = append(args, in.Accion)
			where += " and action = $" + itoa(len(args))
		}
		args = append(args, limite)
		rows, err := db.Query(ctx, `
			select action, actor_id, entity_type, entity_id, metadata, created_at
			from audit_events `+where+`
			order by created_at desc limit $`+itoa(len(args)), args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la auditoría", err)
		}
		defer rows.Close()

		out := &listarAuditoriaOutput{}
		out.Body.Eventos = []auditItem{}
		for rows.Next() {
			var a auditItem
			if err := rows.Scan(&a.Accion, &a.ActorID, &a.EntityType, &a.EntityID, &a.Metadata, &a.CreadoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo la auditoría", err)
			}
			out.Body.Eventos = append(out.Body.Eventos, a)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo la auditoría", err)
		}
		return out, nil
	}
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
