// Administración comercial mínima para staff (admin, vendedor): planes
// Premium, cupones y códigos de canje. Toda mutación queda auditada en la
// misma transacción (pista de auditoría compartida con pagos/accesos).
package staff

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// RegisterComercial registra los endpoints staff de planes, cupones y canjes.
func RegisterComercial(api huma.API, db database.DB) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")
	mw := []func(huma.Context, func(huma.Context)){staff}

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-planes", Method: "GET", Path: "/api/v1/staff/planes",
		Summary:     "Listar planes Premium",
		Description: "Todos los planes con su duración, beneficios y estado, con total de suscripciones.",
		Tags:        []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, listarPlanesStaff(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-crear-plan", Method: "POST", Path: "/api/v1/staff/planes",
		Summary:     "Crear un plan Premium",
		Description: "Plan con duración en días y beneficios publicados (json). Auditoría plan.creado.",
		Tags:        []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, crearPlan(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-actualizar-plan", Method: "PATCH", Path: "/api/v1/staff/planes/{id}",
		Summary:     "Actualizar un plan Premium",
		Description: "Nombre, descripción, duración, beneficios y/o estado. Auditoría plan.actualizado.",
		Tags:        []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, actualizarPlan(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-cupones", Method: "GET", Path: "/api/v1/staff/cupones",
		Summary:     "Listar cupones",
		Description: "Cupones con su tipo de descuento, vigencia, límites y usos consumidos.",
		Tags:        []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, listarCupones(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-crear-cupon", Method: "POST", Path: "/api/v1/staff/cupones",
		Summary: "Crear un cupón",
		Description: "Cupón porcentual (1-99%) o fijo (monto y moneda) con vigencia y límites total/por usuario. " +
			"El cliente solo envía el código; el descuento lo calcula el backend. Auditoría cupon.creado.",
		Tags: []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, crearCupon(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-actualizar-cupon", Method: "PATCH", Path: "/api/v1/staff/cupones/{id}",
		Summary: "Actualizar un cupón",
		Description: "Descripción, monto mínimo, límites de uso, vigencia y/o estado. El tipo y el valor " +
			"del descuento no cambian (las órdenes congelan lo calculado). Auditoría cupon.actualizado.",
		Tags: []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, actualizarCupon(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-canjes", Method: "GET", Path: "/api/v1/staff/canjes",
		Summary:     "Listar códigos de canje",
		Description: "Códigos con su beneficio (plan premium o paquete), vigencia y usos consumidos.",
		Tags:        []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, listarCanjes(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-crear-canje", Method: "POST", Path: "/api/v1/staff/canjes",
		Summary: "Crear un código de canje",
		Description: "Código que concede un período Premium (plan_id) o entitlements de un paquete (product_id), " +
			"sin pago. Auditoría canje.creado.",
		Tags: []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, crearCanje(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-actualizar-canje", Method: "PATCH", Path: "/api/v1/staff/canjes/{id}",
		Summary: "Actualizar un código de canje",
		Description: "Descripción, máximo de usos (no menor a los ya consumidos), vigencia y/o estado. " +
			"Auditoría canje.actualizado.",
		Tags: []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, actualizarCanje(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-obtener-canje", Method: "GET", Path: "/api/v1/staff/canjes/{id}",
		Summary:     "Detalle de un código de canje",
		Description: "Código con la lista de redenciones (usuario y fecha).",
		Tags:        []string{"staff"}, Security: []map[string][]string{{"bearer": {}}},
		Middlewares: mw,
	}, obtenerCanje(db))
}

// ── Planes ─────────────────────────────────────────────────────────────────

type planStaffOut struct {
	ID            string          `json:"id"`
	Codigo        string          `json:"codigo"`
	Nombre        string          `json:"nombre"`
	Descripcion   string          `json:"descripcion,omitempty"`
	DuracionDias  int             `json:"duracion_dias"`
	Beneficios    json.RawMessage `json:"beneficios"`
	Activo        bool            `json:"activo"`
	Suscripciones int             `json:"suscripciones" doc:"Total de suscripciones del plan"`
	CreadoEn      time.Time       `json:"creado_en"`
}

type listarPlanesStaffOutput struct {
	Body struct {
		Planes []planStaffOut `json:"planes"`
	}
}

func listarPlanesStaff(db database.DB) func(context.Context, *struct{}) (*listarPlanesStaffOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarPlanesStaffOutput, error) {
		rows, err := db.Query(ctx, `
			select p.id, p.code, p.name, coalesce(p.description, ''), p.duration_days, p.benefits,
			       p.active, (select count(*) from subscriptions s where s.plan_id = p.id), p.created_at
			from plans p order by p.created_at desc`)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los planes", err)
		}
		defer rows.Close()
		out := &listarPlanesStaffOutput{}
		out.Body.Planes = []planStaffOut{}
		for rows.Next() {
			var p planStaffOut
			if err := rows.Scan(&p.ID, &p.Codigo, &p.Nombre, &p.Descripcion, &p.DuracionDias,
				&p.Beneficios, &p.Activo, &p.Suscripciones, &p.CreadoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los planes", err)
			}
			out.Body.Planes = append(out.Body.Planes, p)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los planes", err)
		}
		return out, nil
	}
}

type crearPlanInput struct {
	Body struct {
		Codigo       string         `json:"codigo" minLength:"2" maxLength:"64" doc:"Código único del plan (p. ej. premium-30)"`
		Nombre       string         `json:"nombre" minLength:"2" maxLength:"200"`
		Descripcion  string         `json:"descripcion,omitempty" maxLength:"1000"`
		DuracionDias int            `json:"duracion_dias" minimum:"1" maximum:"3650"`
		Beneficios   map[string]any `json:"beneficios,omitempty" doc:"Beneficios publicados (objeto JSON)"`
		Activo       bool           `json:"activo"`
	}
}

type planIDOutput struct {
	Body planStaffOut
}

func crearPlan(db database.DB) func(context.Context, *crearPlanInput) (*planIDOutput, error) {
	return func(ctx context.Context, in *crearPlanInput) (*planIDOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		beneficios := map[string]any{}
		if in.Body.Beneficios != nil {
			beneficios = in.Body.Beneficios
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var out planIDOutput
		err = tx.QueryRow(ctx, `
			insert into plans (code, name, description, duration_days, benefits, active)
			values ($1, $2, $3, $4, $5, $6)
			returning id, code, name, coalesce(description, ''), duration_days, benefits, active, created_at`,
			in.Body.Codigo, in.Body.Nombre, in.Body.Descripcion, in.Body.DuracionDias, beneficios, in.Body.Activo,
		).Scan(&out.Body.ID, &out.Body.Codigo, &out.Body.Nombre, &out.Body.Descripcion,
			&out.Body.DuracionDias, &out.Body.Beneficios, &out.Body.Activo, &out.Body.CreadoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un plan con ese código")
			}
			return nil, huma.Error500InternalServerError("error creando el plan", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "plan.creado", "plan", out.Body.ID,
			map[string]any{"codigo": out.Body.Codigo, "duracion_dias": out.Body.DuracionDias}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		return &planIDOutput{Body: out.Body}, nil
	}
}

type actualizarPlanInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Nombre       *string        `json:"nombre,omitempty" minLength:"2" maxLength:"200"`
		Descripcion  *string        `json:"descripcion,omitempty" maxLength:"1000"`
		DuracionDias *int           `json:"duracion_dias,omitempty" minimum:"1" maximum:"3650"`
		Beneficios   map[string]any `json:"beneficios,omitempty"`
		Activo       *bool          `json:"activo,omitempty"`
	}
}

func actualizarPlan(db database.DB) func(context.Context, *actualizarPlanInput) (*planIDOutput, error) {
	return func(ctx context.Context, in *actualizarPlanInput) (*planIDOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var out planIDOutput
		err = tx.QueryRow(ctx, `
			update plans set
				name = coalesce($2, name),
				description = case when $3::text is not null then $3 else description end,
				duration_days = coalesce($4, duration_days),
				benefits = coalesce($5, benefits),
				active = coalesce($6, active)
			where id = $1
			returning id, code, name, coalesce(description, ''), duration_days, benefits, active, created_at`,
			in.ID, in.Body.Nombre, in.Body.Descripcion, in.Body.DuracionDias, in.Body.Beneficios, in.Body.Activo,
		).Scan(&out.Body.ID, &out.Body.Codigo, &out.Body.Nombre, &out.Body.Descripcion,
			&out.Body.DuracionDias, &out.Body.Beneficios, &out.Body.Activo, &out.Body.CreadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("plan no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el plan", err)
		}
		campos := []string{}
		if in.Body.Nombre != nil {
			campos = append(campos, "nombre")
		}
		if in.Body.Descripcion != nil {
			campos = append(campos, "descripcion")
		}
		if in.Body.DuracionDias != nil {
			campos = append(campos, "duracion_dias")
		}
		if in.Body.Beneficios != nil {
			campos = append(campos, "beneficios")
		}
		if in.Body.Activo != nil {
			campos = append(campos, "activo")
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "plan.actualizado", "plan", in.ID,
			map[string]any{"campos": campos}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		return &planIDOutput{Body: out.Body}, nil
	}
}

// ── Cupones ────────────────────────────────────────────────────────────────

type cuponStaffOut struct {
	ID                string     `json:"id"`
	Codigo            string     `json:"codigo"`
	Descripcion       string     `json:"descripcion,omitempty"`
	Tipo              string     `json:"tipo" doc:"percent | fixed"`
	Porcentaje        *int       `json:"porcentaje,omitempty"`
	MontoMinor        *int64     `json:"monto_minor,omitempty"`
	Moneda            string     `json:"moneda,omitempty"`
	MinSubtotalMinor  int64      `json:"min_subtotal_minor"`
	MaxUsosTotal      *int       `json:"max_usos_total,omitempty"`
	MaxUsosPorUsuario int        `json:"max_usos_por_usuario"`
	Usos              int        `json:"usos" doc:"Usos consumidos"`
	IniciaEn          *time.Time `json:"inicia_en,omitempty"`
	TerminaEn         *time.Time `json:"termina_en,omitempty"`
	Activo            bool       `json:"activo"`
	CreadoEn          time.Time  `json:"creado_en"`
}

type listarCuponesOutput struct {
	Body struct {
		Cupones []cuponStaffOut `json:"cupones"`
	}
}

const cuponColumnas = `
	select id, code, coalesce(description, ''), discount_type, percent_off, amount_minor,
	       coalesce(currency, ''), min_subtotal_minor, max_uses_total, max_uses_per_user, used_count,
	       starts_at, ends_at, active, created_at
	from coupons`

func escanearCupon(row pgx.Row) (*cuponStaffOut, error) {
	var c cuponStaffOut
	err := row.Scan(&c.ID, &c.Codigo, &c.Descripcion, &c.Tipo, &c.Porcentaje, &c.MontoMinor,
		&c.Moneda, &c.MinSubtotalMinor, &c.MaxUsosTotal, &c.MaxUsosPorUsuario, &c.Usos,
		&c.IniciaEn, &c.TerminaEn, &c.Activo, &c.CreadoEn)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func listarCupones(db database.DB) func(context.Context, *struct{}) (*listarCuponesOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarCuponesOutput, error) {
		rows, err := db.Query(ctx, cuponColumnas+" order by created_at desc limit 200")
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los cupones", err)
		}
		defer rows.Close()
		out := &listarCuponesOutput{}
		out.Body.Cupones = []cuponStaffOut{}
		for rows.Next() {
			c, err := escanearCupon(rows)
			if err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los cupones", err)
			}
			out.Body.Cupones = append(out.Body.Cupones, *c)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los cupones", err)
		}
		return out, nil
	}
}

type crearCuponInput struct {
	Body struct {
		Codigo            string     `json:"codigo" minLength:"3" maxLength:"64"`
		Descripcion       string     `json:"descripcion,omitempty" maxLength:"500"`
		Tipo              string     `json:"tipo" enum:"percent,fixed"`
		Porcentaje        *int       `json:"porcentaje,omitempty" minimum:"1" maximum:"99" doc:"Obligatorio si tipo=percent"`
		MontoMinor        *int64     `json:"monto_minor,omitempty" minimum:"1" doc:"Obligatorio si tipo=fixed"`
		Moneda            string     `json:"moneda,omitempty" minLength:"3" maxLength:"3" doc:"Obligatoria si tipo=fixed (ISO 4217)"`
		MinSubtotalMinor  int64      `json:"min_subtotal_minor,omitempty" minimum:"0"`
		MaxUsosTotal      *int       `json:"max_usos_total,omitempty" minimum:"1"`
		MaxUsosPorUsuario int        `json:"max_usos_por_usuario" minimum:"1" maximum:"1000"`
		IniciaEn          *time.Time `json:"inicia_en,omitempty"`
		TerminaEn         *time.Time `json:"termina_en,omitempty"`
		Activo            bool       `json:"activo"`
	}
}

type cuponIDOutput struct {
	Body cuponStaffOut
}

func crearCupon(db database.DB) func(context.Context, *crearCuponInput) (*cuponIDOutput, error) {
	return func(ctx context.Context, in *crearCuponInput) (*cuponIDOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		var moneda *string
		if in.Body.Moneda != "" {
			m := strings.ToUpper(in.Body.Moneda)
			moneda = &m
		}
		switch in.Body.Tipo {
		case "percent":
			if in.Body.Porcentaje == nil {
				return nil, huma.Error422UnprocessableEntity("porcentaje es obligatorio cuando tipo=percent")
			}
		case "fixed":
			if in.Body.MontoMinor == nil || moneda == nil {
				return nil, huma.Error422UnprocessableEntity("monto_minor y moneda son obligatorios cuando tipo=fixed")
			}
		default:
			return nil, huma.Error422UnprocessableEntity("tipo debe ser percent o fixed")
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var id string
		err = tx.QueryRow(ctx, `
			insert into coupons (code, description, discount_type, percent_off, amount_minor, currency,
				min_subtotal_minor, max_uses_total, max_uses_per_user, starts_at, ends_at, active)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			returning id`,
			strings.ToUpper(strings.TrimSpace(in.Body.Codigo)), in.Body.Descripcion, in.Body.Tipo,
			in.Body.Porcentaje, in.Body.MontoMinor, moneda,
			in.Body.MinSubtotalMinor, in.Body.MaxUsosTotal, in.Body.MaxUsosPorUsuario,
			in.Body.IniciaEn, in.Body.TerminaEn, in.Body.Activo).Scan(&id)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un cupón con ese código")
			}
			return nil, huma.Error500InternalServerError("error creando el cupón", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "cupon.creado", "coupon", id,
			map[string]any{"codigo": strings.ToUpper(strings.TrimSpace(in.Body.Codigo)), "tipo": in.Body.Tipo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		c, err := escanearCupon(db.QueryRow(ctx, cuponColumnas+" where id = $1", id))
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el cupón", err)
		}
		return &cuponIDOutput{Body: *c}, nil
	}
}

type actualizarCuponInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Descripcion       *string    `json:"descripcion,omitempty" maxLength:"500"`
		MinSubtotalMinor  *int64     `json:"min_subtotal_minor,omitempty" minimum:"0"`
		MaxUsosTotal      *int       `json:"max_usos_total,omitempty" minimum:"1"`
		MaxUsosPorUsuario *int       `json:"max_usos_por_usuario,omitempty" minimum:"1" maximum:"1000"`
		IniciaEn          *time.Time `json:"inicia_en,omitempty"`
		TerminaEn         *time.Time `json:"termina_en,omitempty"`
		Activo            *bool      `json:"activo,omitempty"`
	}
}

func actualizarCupon(db database.DB) func(context.Context, *actualizarCuponInput) (*cuponIDOutput, error) {
	return func(ctx context.Context, in *actualizarCuponInput) (*cuponIDOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		tag, err := tx.Exec(ctx, `
			update coupons set
				description = case when $2::text is not null then $2 else description end,
				min_subtotal_minor = coalesce($3, min_subtotal_minor),
				max_uses_total = coalesce($4, max_uses_total),
				max_uses_per_user = coalesce($5, max_uses_per_user),
				starts_at = coalesce($6, starts_at),
				ends_at = coalesce($7, ends_at),
				active = coalesce($8, active)
			where id = $1`, in.ID, in.Body.Descripcion, in.Body.MinSubtotalMinor,
			in.Body.MaxUsosTotal, in.Body.MaxUsosPorUsuario, in.Body.IniciaEn, in.Body.TerminaEn, in.Body.Activo)
		if err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el cupón", err)
		}
		if tag.RowsAffected() == 0 {
			return nil, huma.Error404NotFound("cupón no encontrado")
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "cupon.actualizado", "coupon", in.ID, nil); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		c, err := escanearCupon(db.QueryRow(ctx, cuponColumnas+" where id = $1", in.ID))
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el cupón", err)
		}
		return &cuponIDOutput{Body: *c}, nil
	}
}

// ── Códigos de canje ───────────────────────────────────────────────────────

type canjeStaffOut struct {
	ID          string     `json:"id"`
	Codigo      string     `json:"codigo"`
	Descripcion string     `json:"descripcion,omitempty"`
	Tipo        string     `json:"tipo" doc:"premium | package"`
	PlanID      *string    `json:"plan_id,omitempty"`
	ProductID   *string    `json:"product_id,omitempty"`
	MaxUsos     int        `json:"max_usos"`
	Usos        int        `json:"usos"`
	IniciaEn    *time.Time `json:"inicia_en,omitempty"`
	TerminaEn   *time.Time `json:"termina_en,omitempty"`
	Activo      bool       `json:"activo"`
	CreadoEn    time.Time  `json:"creado_en"`
}

type listarCanjesOutput struct {
	Body struct {
		Canjes []canjeStaffOut `json:"canjes"`
	}
}

const canjeColumnas = `
	select id, code, coalesce(description, ''), grant_type, plan_id, product_id, max_uses, used_count,
	       starts_at, ends_at, active, created_at
	from redemption_codes`

func escanearCanje(row pgx.Row) (*canjeStaffOut, error) {
	var c canjeStaffOut
	err := row.Scan(&c.ID, &c.Codigo, &c.Descripcion, &c.Tipo, &c.PlanID, &c.ProductID,
		&c.MaxUsos, &c.Usos, &c.IniciaEn, &c.TerminaEn, &c.Activo, &c.CreadoEn)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func listarCanjes(db database.DB) func(context.Context, *struct{}) (*listarCanjesOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarCanjesOutput, error) {
		rows, err := db.Query(ctx, canjeColumnas+" order by created_at desc limit 200")
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los códigos de canje", err)
		}
		defer rows.Close()
		out := &listarCanjesOutput{}
		out.Body.Canjes = []canjeStaffOut{}
		for rows.Next() {
			c, err := escanearCanje(rows)
			if err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los códigos", err)
			}
			out.Body.Canjes = append(out.Body.Canjes, *c)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los códigos", err)
		}
		return out, nil
	}
}

type crearCanjeInput struct {
	Body struct {
		Codigo      string     `json:"codigo" minLength:"3" maxLength:"64"`
		Descripcion string     `json:"descripcion,omitempty" maxLength:"500"`
		Tipo        string     `json:"tipo" enum:"premium,package"`
		PlanID      string     `json:"plan_id,omitempty" format:"uuid" doc:"Obligatorio si tipo=premium"`
		ProductID   string     `json:"product_id,omitempty" format:"uuid" doc:"Obligatorio si tipo=package"`
		MaxUsos     int        `json:"max_usos" minimum:"1"`
		IniciaEn    *time.Time `json:"inicia_en,omitempty"`
		TerminaEn   *time.Time `json:"termina_en,omitempty"`
		Activo      bool       `json:"activo"`
	}
}

type canjeIDOutput struct {
	Body canjeStaffOut
}

func crearCanje(db database.DB) func(context.Context, *crearCanjeInput) (*canjeIDOutput, error) {
	return func(ctx context.Context, in *crearCanjeInput) (*canjeIDOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		var planID, productID *string
		switch in.Body.Tipo {
		case "premium":
			if in.Body.PlanID == "" {
				return nil, huma.Error422UnprocessableEntity("plan_id es obligatorio cuando tipo=premium")
			}
			planID = &in.Body.PlanID
		case "package":
			if in.Body.ProductID == "" {
				return nil, huma.Error422UnprocessableEntity("product_id es obligatorio cuando tipo=package")
			}
			productID = &in.Body.ProductID
		default:
			return nil, huma.Error422UnprocessableEntity("tipo debe ser premium o package")
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// El plan o producto referenciado debe existir y estar activo.
		if planID != nil {
			var activo bool
			if err := tx.QueryRow(ctx, `select active from plans where id = $1`, *planID).Scan(&activo); errors.Is(err, pgx.ErrNoRows) {
				return nil, huma.Error422UnprocessableEntity("el plan no existe")
			} else if err != nil {
				return nil, huma.Error500InternalServerError("error consultando el plan", err)
			} else if !activo {
				return nil, huma.Error422UnprocessableEntity("el plan está inactivo")
			}
		}
		if productID != nil {
			var activo bool
			if err := tx.QueryRow(ctx, `select active from products where id = $1`, *productID).Scan(&activo); errors.Is(err, pgx.ErrNoRows) {
				return nil, huma.Error422UnprocessableEntity("el producto no existe")
			} else if err != nil {
				return nil, huma.Error500InternalServerError("error consultando el producto", err)
			} else if !activo {
				return nil, huma.Error422UnprocessableEntity("el producto está inactivo")
			}
		}

		var id string
		err = tx.QueryRow(ctx, `
			insert into redemption_codes (code, description, grant_type, plan_id, product_id, max_uses, starts_at, ends_at, active)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			returning id`,
			strings.ToUpper(strings.TrimSpace(in.Body.Codigo)), in.Body.Descripcion, in.Body.Tipo,
			planID, productID, in.Body.MaxUsos, in.Body.IniciaEn, in.Body.TerminaEn, in.Body.Activo).Scan(&id)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un código de canje con ese código")
			}
			return nil, huma.Error500InternalServerError("error creando el código", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "canje.creado", "redemption_code", id,
			map[string]any{"codigo": strings.ToUpper(strings.TrimSpace(in.Body.Codigo)), "tipo": in.Body.Tipo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		c, err := escanearCanje(db.QueryRow(ctx, canjeColumnas+" where id = $1", id))
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el código", err)
		}
		return &canjeIDOutput{Body: *c}, nil
	}
}

type actualizarCanjeInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Descripcion *string    `json:"descripcion,omitempty" maxLength:"500"`
		MaxUsos     *int       `json:"max_usos,omitempty" minimum:"1"`
		IniciaEn    *time.Time `json:"inicia_en,omitempty"`
		TerminaEn   *time.Time `json:"termina_en,omitempty"`
		Activo      *bool      `json:"activo,omitempty"`
	}
}

func actualizarCanje(db database.DB) func(context.Context, *actualizarCanjeInput) (*canjeIDOutput, error) {
	return func(ctx context.Context, in *actualizarCanjeInput) (*canjeIDOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		tag, err := tx.Exec(ctx, `
			update redemption_codes set
				description = case when $2::text is not null then $2 else description end,
				max_uses = coalesce($3, max_uses),
				starts_at = coalesce($4, starts_at),
				ends_at = coalesce($5, ends_at),
				active = coalesce($6, active)
			where id = $1`, in.ID, in.Body.Descripcion, in.Body.MaxUsos,
			in.Body.IniciaEn, in.Body.TerminaEn, in.Body.Activo)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, huma.Error409Conflict("max_usos no puede ser menor a los usos ya consumidos")
			}
			return nil, huma.Error500InternalServerError("error actualizando el código", err)
		}
		if tag.RowsAffected() == 0 {
			return nil, huma.Error404NotFound("código de canje no encontrado")
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "canje.actualizado", "redemption_code", in.ID, nil); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		c, err := escanearCanje(db.QueryRow(ctx, canjeColumnas+" where id = $1", in.ID))
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el código", err)
		}
		return &canjeIDOutput{Body: *c}, nil
	}
}

type obtenerCanjeInput struct {
	ID string `path:"id" format:"uuid"`
}

type obtenerCanjeOutput struct {
	Body struct {
		Canje       canjeStaffOut `json:"canje"`
		Redenciones []struct {
			ID          string    `json:"id"`
			UsuarioID   string    `json:"usuario_id"`
			ConcedidoEn time.Time `json:"concedido_en"`
		} `json:"redenciones"`
	}
}

func obtenerCanje(db database.DB) func(context.Context, *obtenerCanjeInput) (*obtenerCanjeOutput, error) {
	return func(ctx context.Context, in *obtenerCanjeInput) (*obtenerCanjeOutput, error) {
		c, err := escanearCanje(db.QueryRow(ctx, canjeColumnas+" where id = $1", in.ID))
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("código de canje no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el código", err)
		}
		out := &obtenerCanjeOutput{}
		out.Body.Canje = *c
		out.Body.Redenciones = []struct {
			ID          string    `json:"id"`
			UsuarioID   string    `json:"usuario_id"`
			ConcedidoEn time.Time `json:"concedido_en"`
		}{}
		rows, err := db.Query(ctx, `
			select id, user_id, created_at from redemptions where code_id = $1 order by created_at desc limit 200`, in.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las redenciones", err)
		}
		defer rows.Close()
		for rows.Next() {
			var r struct {
				ID          string    `json:"id"`
				UsuarioID   string    `json:"usuario_id"`
				ConcedidoEn time.Time `json:"concedido_en"`
			}
			if err := rows.Scan(&r.ID, &r.UsuarioID, &r.ConcedidoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las redenciones", err)
			}
			out.Body.Redenciones = append(out.Body.Redenciones, r)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las redenciones", err)
		}
		return out, nil
	}
}
