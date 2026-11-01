package soporte

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// registerStaff registra los endpoints de operación staff de soporte
// (admin/vendedor; editor → 403). Toda mutación comparte transacción con su
// auditoría. Los tickets ajenos se tratan como inexistentes (404).
func registerStaff(api huma.API, db database.DB, objects storage.Client) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-tickets",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/soporte/tickets",
		Summary:     "Listar tickets de soporte",
		Description: "Tickets con su usuario y conteo de mensajes. Filtros opcionales por estado " +
			"(abierto | en_atencion | resuelto | cerrado) y categoría.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarTicketsStaff(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-agregar-mensaje-ticket",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/soporte/tickets/{id}/mensajes",
		Summary:     "Responder un ticket (staff)",
		Description: "Multipart con cuerpo de texto y adjunto opcional (imagen o PDF, máximo 5 MiB). El mensaje " +
			"queda con autor staff; en tickets cerrados se rechaza con 409. Auditoría ticket.mensaje.",
		MaxBodyBytes: maxAdjuntoBytes + 64*1024,
		Tags:         []string{"staff"},
		Security:     []map[string][]string{{"bearer": {}}},
		Middlewares:  []func(huma.Context, func(huma.Context)){staff},
	}, agregarMensaje(db, objects, "staff"))

	huma.Register(api, huma.Operation{
		OperationID: "staff-estado-ticket",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/soporte/tickets/{id}/estado",
		Summary:     "Cambiar el estado de un ticket",
		Description: "Transiciones válidas: tomar (abierto → en_atencion), resolver (abierto/en_atencion → resuelto), " +
			"cerrar (cualquier estado abierto → cerrado), reabrir (resuelto → abierto). Con motivo y auditoría " +
			"ticket.estado.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, cambiarEstadoTicket(db))
}

// ── Listado staff ──────────────────────────────────────────────────────────

type ticketStaffItem struct {
	ID             string    `json:"id"`
	UsuarioID      string    `json:"usuario_id"`
	UsuarioMail    string    `json:"usuario_email"`
	Categoria      string    `json:"categoria"`
	Asunto         string    `json:"asunto"`
	Estado         string    `json:"estado"`
	OrderID        *string   `json:"order_id,omitempty"`
	LicenseGrantID *string   `json:"license_grant_id,omitempty"`
	YoutubeURL     string    `json:"youtube_url,omitempty"`
	YoutubeClaimID string    `json:"youtube_claim_id,omitempty"`
	Mensajes       int       `json:"mensajes" doc:"Cantidad de mensajes"`
	CreadoEn       time.Time `json:"creado_en"`
	ActualizadoEn  time.Time `json:"actualizada_en"`
}

type listarTicketsStaffInput struct {
	Estado    string `query:"estado" required:"false" enum:"abierto,en_atencion,resuelto,cerrado" doc:"Filtro opcional por estado"`
	Categoria string `query:"categoria" required:"false" enum:"pagos,descargas,permisos,reclamo_youtube,otro" doc:"Filtro opcional por categoría"`
}

type listarTicketsStaffOutput struct {
	Body struct {
		Tickets []ticketStaffItem `json:"tickets"`
	}
}

func listarTicketsStaff(db database.DB) func(ctx context.Context, in *listarTicketsStaffInput) (*listarTicketsStaffOutput, error) {
	return func(ctx context.Context, in *listarTicketsStaffInput) (*listarTicketsStaffOutput, error) {
		where := []string{}
		args := []any{}
		if in.Estado != "" {
			args = append(args, in.Estado)
			where = append(where, "t.estado = $"+strconv.Itoa(len(args)))
		}
		if in.Categoria != "" {
			args = append(args, in.Categoria)
			where = append(where, "t.categoria = $"+strconv.Itoa(len(args)))
		}
		whereClause := ""
		if len(where) > 0 {
			whereClause = "where " + strings.Join(where, " and ")
		}

		out := &listarTicketsStaffOutput{}
		out.Body.Tickets = []ticketStaffItem{}
		rows, err := db.Query(ctx, `
			select t.id, t.user_id, coalesce(p.email, ''), t.categoria, t.asunto, t.estado,
			       t.order_id, t.license_grant_id,
			       coalesce(t.youtube_url, ''), coalesce(t.youtube_claim_id, ''),
			       (select count(*) from support_messages m where m.ticket_id = t.id),
			       t.created_at, t.updated_at
			from support_tickets t
			left join profiles p on p.id = t.user_id
			`+whereClause+`
			order by t.created_at desc limit 100`, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los tickets", err)
		}
		defer rows.Close()
		for rows.Next() {
			var t ticketStaffItem
			if err := rows.Scan(&t.ID, &t.UsuarioID, &t.UsuarioMail, &t.Categoria, &t.Asunto, &t.Estado,
				&t.OrderID, &t.LicenseGrantID, &t.YoutubeURL, &t.YoutubeClaimID, &t.Mensajes,
				&t.CreadoEn, &t.ActualizadoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los tickets", err)
			}
			out.Body.Tickets = append(out.Body.Tickets, t)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los tickets", err)
		}
		return out, nil
	}
}

// ── Estado del ticket ──────────────────────────────────────────────────────

type estadoTicketInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID del ticket"`
	Body struct {
		Accion string `json:"accion" enum:"tomar,resolver,cerrar,reabrir" doc:"tomar: abierto → en_atencion; resolver → resuelto; cerrar → cerrado; reabrir: resuelto → abierto"`
		Motivo string `json:"motivo,omitempty" maxLength:"500"`
	}
}

type estadoTicketOutput struct {
	Body struct {
		ID     string `json:"id"`
		Estado string `json:"estado"`
	}
}

func cambiarEstadoTicket(db database.DB) func(ctx context.Context, in *estadoTicketInput) (*estadoTicketOutput, error) {
	transiciones := map[string]map[string]string{
		"tomar":    {"abierto": "en_atencion"},
		"resolver": {"abierto": "resuelto", "en_atencion": "resuelto"},
		"cerrar":   {"abierto": "cerrado", "en_atencion": "cerrado", "resuelto": "cerrado"},
		"reabrir":  {"resuelto": "abierto"},
	}
	return func(ctx context.Context, in *estadoTicketInput) (*estadoTicketOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estadoActual string
		err = tx.QueryRow(ctx, `
			select estado from support_tickets where id = $1 for update`, in.ID).Scan(&estadoActual)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("ticket no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el ticket", err)
		}
		estadoNuevo, valida := transiciones[in.Body.Accion][estadoActual]
		if !valida {
			return nil, huma.Error409Conflict("transición inválida para el estado actual del ticket")
		}

		if _, err := tx.Exec(ctx, `
			update support_tickets set estado = $2 where id = $1`, in.ID, estadoNuevo); err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el ticket", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "ticket.estado", "support_ticket", in.ID,
			map[string]any{"accion": in.Body.Accion, "estado_anterior": estadoActual,
				"estado_nuevo": estadoNuevo, "motivo": in.Body.Motivo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}

		out := &estadoTicketOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = estadoNuevo
		return out, nil
	}
}
