// Package himnario expone el himnario versionado en solo lectura.
package himnario

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/database"
)

// Register registra los endpoints públicos de lectura del himnario.
func Register(api huma.API, db database.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "himnario-listar-himnos",
		Method:      http.MethodGet,
		Path:        "/api/v1/himnario/himnos",
		Summary:     "Lista de himnos",
		Description: "Himnos publicados de una colección, con las versiones de contenido disponibles. " +
			"Soporta paginación con limite (máx. 1000, default 1000) y desde (offset).",
		Tags: []string{"himnario"},
	}, listarHimnos(db))

	huma.Register(api, huma.Operation{
		OperationID: "himnario-obtener-himno",
		Method:      http.MethodGet,
		Path:        "/api/v1/himnario/himnos/{numero}",
		Summary:     "Detalle de un himno",
		Description: "Himno con el contenido ChordPro de todas sus versiones publicadas.",
		Tags:        []string{"himnario"},
	}, obtenerHimno(db))
}

type versionItem struct {
	Codigo   string `json:"codigo" example:"chords_full" doc:"Código de la versión de contenido"`
	Alcance  string `json:"alcance" example:"full_song" doc:"Cobertura de acordes"`
	Etiqueta string `json:"etiqueta,omitempty" example:"Acordes completos" doc:"Nombre visible del arreglo"`
}

type himnoResumen struct {
	Numero    int      `json:"numero" example:"1" doc:"Número del himno en la colección"`
	Titulo    string   `json:"titulo" example:"Cantad alegres al Señor"`
	Versiones []string `json:"versiones" example:"chords_full,verse_chorus" doc:"Versiones publicadas disponibles"`
}

type listarHimnosInput struct {
	Coleccion string `query:"coleccion" default:"himnario-adventista" doc:"Slug de la colección"`
	Limite    int    `query:"limite" required:"false" minimum:"1" maximum:"1000" default:"1000" doc:"Máximo de himnos por página"`
	Desde     int    `query:"desde" required:"false" minimum:"0" default:"0" doc:"Desplazamiento (offset) para paginar"`
}

type listarHimnosOutput struct {
	Body struct {
		Coleccion string         `json:"coleccion"`
		Himnos    []himnoResumen `json:"himnos"`
	}
}

func listarHimnos(db database.DB) func(context.Context, *listarHimnosInput) (*listarHimnosOutput, error) {
	return func(ctx context.Context, in *listarHimnosInput) (*listarHimnosOutput, error) {
		limite := in.Limite
		if limite <= 0 {
			limite = 1000
		}
		rows, err := db.Query(ctx, `
			select h.hymn_number, h.title,
			       coalesce(array_agg(hv.version_code order by hv.version_code)
			                filter (where hv.id is not null), '{}')
			from hymns h
			join hymn_collections c on c.id = h.collection_id
			left join hymn_versions hv
			       on hv.hymn_id = h.id and hv.is_published and hv.deleted_at is null
			where c.slug = $1 and h.deleted_at is null
			group by h.hymn_number, h.title
			order by h.hymn_number
			limit $2 offset $3`, in.Coleccion, limite, in.Desde)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el himnario", err)
		}
		defer rows.Close()

		out := &listarHimnosOutput{}
		out.Body.Coleccion = in.Coleccion
		out.Body.Himnos = []himnoResumen{}
		for rows.Next() {
			var h himnoResumen
			if err := rows.Scan(&h.Numero, &h.Titulo, &h.Versiones); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo el himnario", err)
			}
			out.Body.Himnos = append(out.Body.Himnos, h)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo el himnario", err)
		}
		return out, nil
	}
}

type obtenerHimnoInput struct {
	Numero    int    `path:"numero" doc:"Número del himno en la colección"`
	Coleccion string `query:"coleccion" default:"himnario-adventista" doc:"Slug de la colección"`
}

type versionDetalle struct {
	versionItem
	Formato  string `json:"formato" example:"chordpro" doc:"Formato del contenido"`
	Tono     string `json:"tono,omitempty" example:"D" doc:"Tono original"`
	Capo     *int   `json:"capo,omitempty" doc:"Traste del capo"`
	Chordpro string `json:"chordpro" doc:"Contenido completo en ChordPro"`
}

type obtenerHimnoOutput struct {
	Body struct {
		Numero    int              `json:"numero"`
		Titulo    string           `json:"titulo"`
		Coleccion string           `json:"coleccion"`
		Versiones []versionDetalle `json:"versiones"`
	}
}

func obtenerHimno(db database.DB) func(context.Context, *obtenerHimnoInput) (*obtenerHimnoOutput, error) {
	return func(ctx context.Context, in *obtenerHimnoInput) (*obtenerHimnoOutput, error) {
		var hymnID string
		out := &obtenerHimnoOutput{}
		out.Body.Coleccion = in.Coleccion
		out.Body.Versiones = []versionDetalle{}

		err := db.QueryRow(ctx, `
			select h.id, h.hymn_number, h.title
			from hymns h
			join hymn_collections c on c.id = h.collection_id
			where c.slug = $1 and h.hymn_number = $2 and h.deleted_at is null`,
			in.Coleccion, in.Numero,
		).Scan(&hymnID, &out.Body.Numero, &out.Body.Titulo)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("himno no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el himno", err)
		}

		rows, err := db.Query(ctx, `
			select version_code, chord_scope, coalesce(arrangement_label, ''),
			       content_format, coalesce(original_key, ''), capo, chordpro
			from hymn_versions
			where hymn_id = $1 and is_published and deleted_at is null
			order by version_code`, hymnID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las versiones", err)
		}
		defer rows.Close()

		for rows.Next() {
			var v versionDetalle
			if err := rows.Scan(&v.Codigo, &v.Alcance, &v.Etiqueta, &v.Formato, &v.Tono, &v.Capo, &v.Chordpro); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las versiones", err)
			}
			out.Body.Versiones = append(out.Body.Versiones, v)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las versiones", err)
		}
		return out, nil
	}
}
