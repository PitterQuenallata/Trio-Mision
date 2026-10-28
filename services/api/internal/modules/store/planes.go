package store

import (
	"context"
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"triomision/api/internal/database"
)

// listarPlanes expone los planes Premium activos con sus beneficios
// publicados. Premium es un período temporal: no concede audio descargable
// ni licencias adicionales.
func listarPlanes(db database.DB) func(context.Context, *struct{}) (*listarPlanesOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarPlanesOutput, error) {
		rows, err := db.Query(ctx, `
			select id, code, name, coalesce(description, ''), duration_days, benefits
			from plans
			where active
			order by duration_days, name`)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los planes", err)
		}
		defer rows.Close()

		out := &listarPlanesOutput{}
		out.Body.Planes = []planPublico{}
		for rows.Next() {
			var p planPublico
			if err := rows.Scan(&p.ID, &p.Codigo, &p.Nombre, &p.Descripcion, &p.DuracionDias, &p.Beneficios); err != nil {
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

type planPublico struct {
	ID           string          `json:"id"`
	Codigo       string          `json:"codigo"`
	Nombre       string          `json:"nombre"`
	Descripcion  string          `json:"descripcion,omitempty"`
	DuracionDias int             `json:"duracion_dias"`
	Beneficios   json.RawMessage `json:"beneficios" doc:"Beneficios publicados del plan"`
}

type listarPlanesOutput struct {
	Body struct {
		Planes []planPublico `json:"planes"`
	}
}
