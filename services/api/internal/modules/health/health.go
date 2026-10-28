// Package health expone los endpoints de estado del servicio.
package health

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Pinger es la parte de *pgxpool.Pool que necesita el readiness check.
type Pinger interface {
	Ping(ctx context.Context) error
}

type healthOutput struct {
	Body struct {
		Status  string `json:"status" example:"ok" doc:"Estado del proceso"`
		Version string `json:"version" example:"0.1.0" doc:"Versión de la API"`
	}
}

type readyOutput struct {
	Status int `json:"-"`
	Body   struct {
		Status   string `json:"status" example:"ok" doc:"Estado general"`
		Database string `json:"database" example:"up" doc:"Estado de PostgreSQL"`
	}
}

// Register registra /api/v1/health (liveness) y /api/v1/ready (readiness).
func Register(api huma.API, db Pinger, version string) {
	huma.Register(api, huma.Operation{
		OperationID: "health",
		Method:      http.MethodGet,
		Path:        "/api/v1/health",
		Summary:     "Estado del servicio",
		Description: "Liveness: responde si el proceso está vivo, sin dependencias.",
		Tags:        []string{"system"},
	}, func(_ context.Context, _ *struct{}) (*healthOutput, error) {
		out := &healthOutput{}
		out.Body.Status = "ok"
		out.Body.Version = version
		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "ready",
		Method:      http.MethodGet,
		Path:        "/api/v1/ready",
		Summary:     "Disponibilidad del servicio",
		Description: "Readiness: verifica que PostgreSQL responda. Devuelve 503 si alguna dependencia falla.",
		Tags:        []string{"system"},
		Responses:   map[string]*huma.Response{"200": {}, "503": {}},
	}, func(ctx context.Context, _ *struct{}) (*readyOutput, error) {
		out := &readyOutput{Status: http.StatusOK}
		out.Body.Status = "ok"
		out.Body.Database = "up"
		if err := db.Ping(ctx); err != nil {
			out.Status = http.StatusServiceUnavailable
			out.Body.Status = "error"
			out.Body.Database = "down"
		}
		return out, nil
	})
}
