// Package artists implementa la autorización por artista sobre
// artist_members: member lee (con ChordPro) el contenido publicado de sus
// artistas; manager administra únicamente sus artistas (álbumes, canciones,
// ficha y membresías), con auditoría. El alcance se valida siempre por
// artist_id en cada query y mutación; sin alcance global.
package artists

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// Register registra los endpoints de membresía por artista bajo
// /api/v1/mis-artistas. Las lecturas admiten member y manager; las mutaciones
// solo manager (middleware authz.RequireArtistRole).
func Register(api huma.API, db database.DB) {
	miembros := authz.RequireArtistRole(api, db, "artistId", "member")
	managers := authz.RequireArtistRole(api, db, "artistId", "manager")

	huma.Register(api, huma.Operation{
		OperationID: "artistas-listar-mias",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-artistas",
		Summary:     "Mis artistas",
		Description: "Artistas donde el usuario autenticado es member o manager, con su rol por artista.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
	}, listarMias(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-obtener-mio",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-artistas/{artistId}",
		Summary:     "Detalle de mi artista",
		Description: "Ficha del artista con sus álbumes y canciones publicados (metadatos). " +
			"Requiere ser member o manager del artista; el detalle de canción incluye el ChordPro.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){miembros},
	}, obtenerMio(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-obtener-cancion",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-artistas/{artistId}/canciones/{songId}",
		Summary:     "Canción de mi artista con ChordPro",
		Description: "Canción publicada con su contenido ChordPro completo, con independencia de su " +
			"nivel de acceso (free, premium o purchase): la membresía autoriza la lectura. " +
			"Requiere ser member o manager del artista.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){miembros},
	}, obtenerCancion(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-actualizar",
		Method:      http.MethodPatch,
		Path:        "/api/v1/mis-artistas/{artistId}",
		Summary:     "Actualizar ficha del artista (manager)",
		Description: "Actualiza bio, país, enlaces sociales y portada de su artista. " +
			"Nombre, slug y publicación siguen siendo operación staff.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, actualizarArtista(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-crear-album",
		Method:      http.MethodPost,
		Path:        "/api/v1/mis-artistas/{artistId}/albumes",
		Summary:     "Crear álbum (manager)",
		Description: "Crea un álbum de su artista (sin publicar por defecto).",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, crearAlbum(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-actualizar-album",
		Method:      http.MethodPatch,
		Path:        "/api/v1/mis-artistas/{artistId}/albumes/{albumId}",
		Summary:     "Actualizar álbum (manager)",
		Description: "Actualiza título, año, orden, portada y publicación de un álbum de su artista.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, actualizarAlbum(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-crear-cancion",
		Method:      http.MethodPost,
		Path:        "/api/v1/mis-artistas/{artistId}/canciones",
		Summary:     "Crear canción (manager)",
		Description: "Crea una canción con ChordPro en un álbum de su artista (sin publicar por defecto).",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, crearCancion(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-actualizar-cancion",
		Method:      http.MethodPatch,
		Path:        "/api/v1/mis-artistas/{artistId}/canciones/{songId}",
		Summary:     "Actualizar canción (manager)",
		Description: "Actualiza letra/acordes, tono, capo, BPM, créditos, orden, nivel de acceso y " +
			"publicación de una canción de su artista.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, actualizarCancion(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-agregar-miembro",
		Method:      http.MethodPost,
		Path:        "/api/v1/mis-artistas/{artistId}/miembros",
		Summary:     "Agregar member/manager al artista (manager)",
		Description: "Asigna un rol member o manager de este artista a un usuario con perfil " +
			"(debe haber iniciado sesión al menos una vez). Con auditoría.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, agregarMiembro(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-quitar-miembro",
		Method:      http.MethodDelete,
		Path:        "/api/v1/mis-artistas/{artistId}/miembros/{userId}",
		Summary:     "Quitar member/manager del artista (manager)",
		Description: "Revoca la membresía de un usuario en este artista. Con auditoría.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, quitarMiembro(db))
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type artistaMio struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	Nombre    string `json:"nombre"`
	MiRol     string `json:"mi_rol" doc:"member | manager"`
	CoverKey  string `json:"cover_key,omitempty"`
	Publicado bool   `json:"publicado"`
}

type cancionMia struct {
	ID        string `json:"id"`
	Titulo    string `json:"titulo"`
	Tono      string `json:"tono,omitempty"`
	Capo      *int   `json:"capo,omitempty"`
	BPM       *int   `json:"bpm,omitempty"`
	Autor     string `json:"autor,omitempty"`
	Arreglo   string `json:"arreglista,omitempty"`
	Acceso    string `json:"acceso" doc:"free | premium | purchase | creator"`
	Orden     int    `json:"orden"`
	AlbumID   string `json:"album_id"`
	Publicada bool   `json:"publicada"`
}

type albumResumen struct {
	ID        string       `json:"id"`
	Titulo    string       `json:"titulo"`
	Anio      *int         `json:"anio,omitempty"`
	CoverKey  string       `json:"cover_key,omitempty"`
	Orden     int          `json:"orden"`
	Publicado bool         `json:"publicado"`
	Canciones []cancionMia `json:"canciones"`
}

// ── Lecturas ───────────────────────────────────────────────────────────────

type listarMiasOutput struct {
	Body struct {
		Artistas []artistaMio `json:"artistas"`
	}
}

func listarMias(db database.DB) func(context.Context, *struct{}) (*listarMiasOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarMiasOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		rows, err := db.Query(ctx, `
			select ar.id, ar.slug, ar.name, am.member_role,
			       coalesce(ar.cover_key, ''), ar.is_published
			from artist_members am
			join artists ar on ar.id = am.artist_id
			where am.user_id = $1 and ar.deleted_at is null
			order by ar.name`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando tus artistas", err)
		}
		defer rows.Close()

		out := &listarMiasOutput{}
		out.Body.Artistas = []artistaMio{}
		for rows.Next() {
			var a artistaMio
			if err := rows.Scan(&a.ID, &a.Slug, &a.Nombre, &a.MiRol, &a.CoverKey, &a.Publicado); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo tus artistas", err)
			}
			out.Body.Artistas = append(out.Body.Artistas, a)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo tus artistas", err)
		}
		return out, nil
	}
}

type artistaPath struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
}

type obtenerMioOutput struct {
	Body struct {
		ID       string          `json:"id"`
		Slug     string          `json:"slug"`
		Nombre   string          `json:"nombre"`
		Pais     string          `json:"pais,omitempty"`
		Bio      string          `json:"bio,omitempty"`
		CoverKey string          `json:"cover_key,omitempty"`
		Redes    json.RawMessage `json:"redes"`
		Albumes  []albumResumen  `json:"albumes"`
	}
}

// obtenerMio devuelve la ficha con álbumes y canciones publicados. La
// membresía ya quedó validada en el middleware.
func obtenerMio(db database.DB) func(context.Context, *artistaPath) (*obtenerMioOutput, error) {
	return func(ctx context.Context, in *artistaPath) (*obtenerMioOutput, error) {
		out := &obtenerMioOutput{}
		out.Body.Albumes = []albumResumen{}

		err := db.QueryRow(ctx, `
			select a.slug, a.name, coalesce(a.country, ''), coalesce(a.bio, ''),
			       coalesce(a.cover_key, ''), a.social_links
			from artists a
			where a.id = $1 and a.deleted_at is null`, in.ArtistID,
		).Scan(&out.Body.Slug, &out.Body.Nombre, &out.Body.Pais, &out.Body.Bio,
			&out.Body.CoverKey, &out.Body.Redes)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("artista no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el artista", err)
		}
		out.Body.ID = in.ArtistID

		rows, err := db.Query(ctx, `
			select al.id, al.title, al.year, coalesce(al.cover_key, ''), al.sort_order, al.is_published,
			       s.id, s.title, s.original_key, s.capo, s.bpm,
			       s.author, s.arranger,
			       s.publication_access, s.sort_order, s.is_published
			from albums al
			left join songs s
			       on s.album_id = al.id and s.is_published and s.deleted_at is null
			where al.artist_id = $1 and al.deleted_at is null
			order by al.sort_order, al.title, s.sort_order, s.title`, in.ArtistID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los álbumes", err)
		}
		defer rows.Close()

		indices := map[string]int{}
		for rows.Next() {
			// Las columnas de canción llegan NULL cuando el álbum no tiene
			// canciones publicadas: se escanean en punteros y solo se
			// materializa la canción cuando s.id existe.
			var (
				albumID, albumTitulo, cover string
				orden                       int
				publicado                   bool
				anio                        *int
				cancionID                   *string
				cTitulo, cTono              *string
				cCapo, cBPM                 *int
				cAutor, cArreglo, cAcceso   *string
				songOrden                   *int
				songPublicada               *bool
			)
			if err := rows.Scan(&albumID, &albumTitulo, &anio, &cover, &orden, &publicado,
				&cancionID, &cTitulo, &cTono, &cCapo, &cBPM,
				&cAutor, &cArreglo, &cAcceso, &songOrden, &songPublicada); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los álbumes", err)
			}
			idx, ok := indices[albumID]
			if !ok {
				indices[albumID] = len(out.Body.Albumes)
				out.Body.Albumes = append(out.Body.Albumes, albumResumen{
					ID: albumID, Titulo: albumTitulo, Anio: anio, CoverKey: cover,
					Orden: orden, Publicado: publicado, Canciones: []cancionMia{},
				})
				idx = len(out.Body.Albumes) - 1
			}
			if cancionID != nil {
				cancion := cancionMia{
					ID: *cancionID, AlbumID: albumID, Capo: cCapo, BPM: cBPM,
				}
				if songOrden != nil {
					cancion.Orden = *songOrden
				}
				if songPublicada != nil {
					cancion.Publicada = *songPublicada
				}
				if cTitulo != nil {
					cancion.Titulo = *cTitulo
				}
				if cTono != nil {
					cancion.Tono = *cTono
				}
				if cAutor != nil {
					cancion.Autor = *cAutor
				}
				if cArreglo != nil {
					cancion.Arreglo = *cArreglo
				}
				if cAcceso != nil {
					cancion.Acceso = *cAcceso
				}
				out.Body.Albumes[idx].Canciones = append(out.Body.Albumes[idx].Canciones, cancion)
			}
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los álbumes", err)
		}
		return out, nil
	}
}

type cancionPath struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	SongID   string `path:"songId" format:"uuid" doc:"ID de la canción"`
}

type obtenerCancionOutput struct {
	Body struct {
		ID       string `json:"id"`
		Titulo   string `json:"titulo"`
		Tono     string `json:"tono,omitempty"`
		Capo     *int   `json:"capo,omitempty"`
		BPM      *int   `json:"bpm,omitempty"`
		Autor    string `json:"autor,omitempty"`
		Arreglo  string `json:"arreglista,omitempty"`
		Acceso   string `json:"acceso" doc:"free | premium | purchase | creator"`
		Orden    int    `json:"orden"`
		AlbumID  string `json:"album_id"`
		Album    string `json:"album"`
		Chordpro string `json:"chordpro" doc:"Contenido completo: la membresía autoriza la lectura"`
	}
}

// obtenerCancion entrega el ChordPro de una canción publicada de su artista
// con independencia del nivel de acceso del catálogo: la autorización es la
// membresía (member o manager), no el tipo de acceso público.
func obtenerCancion(db database.DB) func(context.Context, *cancionPath) (*obtenerCancionOutput, error) {
	return func(ctx context.Context, in *cancionPath) (*obtenerCancionOutput, error) {
		out := &obtenerCancionOutput{}
		var acceso string
		err := db.QueryRow(ctx, `
			select s.title, coalesce(s.original_key, ''), s.capo, s.bpm,
			       coalesce(s.author, ''), coalesce(s.arranger, ''),
			       s.publication_access, s.sort_order, s.album_id, al.title, s.chordpro
			from songs s
			join albums al on al.id = s.album_id
			where s.id = $1 and s.is_published and s.deleted_at is null
			  and al.artist_id = $2 and al.deleted_at is null`, in.SongID, in.ArtistID,
		).Scan(&out.Body.Titulo, &out.Body.Tono, &out.Body.Capo, &out.Body.BPM,
			&out.Body.Autor, &out.Body.Arreglo, &acceso, &out.Body.Orden,
			&out.Body.AlbumID, &out.Body.Album, &out.Body.Chordpro)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("canción no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la canción", err)
		}
		out.Body.ID = in.SongID
		out.Body.Acceso = acceso
		return out, nil
	}
}

// ── Mutaciones (manager) ───────────────────────────────────────────────────

type actualizarArtistaInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	Body     struct {
		Pais     *string          `json:"pais,omitempty" maxLength:"80"`
		Bio      *string          `json:"bio,omitempty" maxLength:"4000"`
		Social   *json.RawMessage `json:"redes,omitempty" doc:"Enlaces sociales (objeto JSON)"`
		CoverKey *string          `json:"cover_key,omitempty" maxLength:"300"`
	}
}

type artistaOut struct {
	Body struct {
		ID            string          `json:"id"`
		Slug          string          `json:"slug"`
		Nombre        string          `json:"nombre"`
		Pais          string          `json:"pais,omitempty"`
		Bio           string          `json:"bio,omitempty"`
		CoverKey      string          `json:"cover_key,omitempty"`
		Redes         json.RawMessage `json:"redes"`
		ActualizadoEn time.Time       `json:"actualizado_en"`
	}
}

func actualizarArtista(db database.DB) func(context.Context, *actualizarArtistaInput) (*artistaOut, error) {
	return func(ctx context.Context, in *actualizarArtistaInput) (*artistaOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		var redes *json.RawMessage
		if in.Body.Social != nil && json.Valid(*in.Body.Social) {
			redes = in.Body.Social
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		out := &artistaOut{}
		err = tx.QueryRow(ctx, `
			update artists set
			  country   = coalesce($2, country),
			  bio       = coalesce($3, bio),
			  social_links = coalesce($4, social_links),
			  cover_key = coalesce($5, cover_key)
			where id = $1 and deleted_at is null
			returning slug, name, coalesce(country, ''), coalesce(bio, ''),
			          coalesce(cover_key, ''), social_links, updated_at`,
			in.ArtistID, in.Body.Pais, in.Body.Bio, redes, in.Body.CoverKey,
		).Scan(&out.Body.Slug, &out.Body.Nombre, &out.Body.Pais, &out.Body.Bio,
			&out.Body.CoverKey, &out.Body.Redes, &out.Body.ActualizadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("artista no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el artista", err)
		}
		out.Body.ID = in.ArtistID
		if err := registrarAuditoria(ctx, tx, claims.Subject, "artista.actualizado", "artist", in.ArtistID,
			map[string]any{"artista_id": in.ArtistID}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la actualización", err)
		}
		return out, nil
	}
}

type crearAlbumInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	Body     struct {
		Titulo   string  `json:"titulo" required:"true" minLength:"1" maxLength:"200"`
		Anio     *int    `json:"anio,omitempty" minimum:"1900" maximum:"2100"`
		CoverKey *string `json:"cover_key,omitempty" maxLength:"300"`
		Orden    *int    `json:"orden,omitempty" minimum:"0" maximum:"32000"`
	}
}

type albumOut struct {
	Body struct {
		ID        string    `json:"id"`
		Titulo    string    `json:"titulo"`
		Anio      *int      `json:"anio,omitempty"`
		CoverKey  string    `json:"cover_key,omitempty"`
		Orden     int       `json:"orden"`
		Publicado bool      `json:"publicado"`
		CreadoEn  time.Time `json:"creado_en"`
	}
}

func crearAlbum(db database.DB) func(context.Context, *crearAlbumInput) (*albumOut, error) {
	return func(ctx context.Context, in *crearAlbumInput) (*albumOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		out := &albumOut{}
		orden := 0
		if in.Body.Orden != nil {
			orden = *in.Body.Orden
		}
		err = tx.QueryRow(ctx, `
			insert into albums (artist_id, title, year, cover_key, sort_order, is_published)
			values ($1, $2, $3, $4, $5, false)
			returning id, title, year, coalesce(cover_key, ''), sort_order, is_published, created_at`,
			in.ArtistID, in.Body.Titulo, in.Body.Anio, in.Body.CoverKey, orden,
		).Scan(&out.Body.ID, &out.Body.Titulo, &out.Body.Anio, &out.Body.CoverKey,
			&out.Body.Orden, &out.Body.Publicado, &out.Body.CreadoEn)
		if err != nil {
			return nil, huma.Error500InternalServerError("error creando el álbum", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "album.creado", "album", out.Body.ID,
			map[string]any{"artista_id": in.ArtistID, "titulo": in.Body.Titulo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando el álbum", err)
		}
		return out, nil
	}
}

type actualizarAlbumInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	AlbumID  string `path:"albumId" format:"uuid" doc:"ID del álbum"`
	Body     struct {
		Titulo    *string `json:"titulo,omitempty" minLength:"1" maxLength:"200"`
		Anio      *int    `json:"anio,omitempty" minimum:"1900" maximum:"2100"`
		CoverKey  *string `json:"cover_key,omitempty" maxLength:"300"`
		Orden     *int    `json:"orden,omitempty" minimum:"0" maximum:"32000"`
		Publicado *bool   `json:"publicado,omitempty"`
	}
}

func actualizarAlbum(db database.DB) func(context.Context, *actualizarAlbumInput) (*albumOut, error) {
	return func(ctx context.Context, in *actualizarAlbumInput) (*albumOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		out := &albumOut{}
		err = tx.QueryRow(ctx, `
			update albums set
			  title      = coalesce($3, title),
			  year       = coalesce($4, year),
			  cover_key  = coalesce($5, cover_key),
			  sort_order = coalesce($6, sort_order),
			  is_published = coalesce($7, is_published)
			where id = $2 and artist_id = $1 and deleted_at is null
			returning id, title, year, coalesce(cover_key, ''), sort_order, is_published, created_at`,
			in.ArtistID, in.AlbumID, in.Body.Titulo, in.Body.Anio, in.Body.CoverKey,
			in.Body.Orden, in.Body.Publicado,
		).Scan(&out.Body.ID, &out.Body.Titulo, &out.Body.Anio, &out.Body.CoverKey,
			&out.Body.Orden, &out.Body.Publicado, &out.Body.CreadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("álbum no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el álbum", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "album.actualizado", "album", in.AlbumID,
			map[string]any{"artista_id": in.ArtistID}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando el álbum", err)
		}
		return out, nil
	}
}

type crearCancionInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	Body     struct {
		AlbumID  string  `json:"album_id" format:"uuid" doc:"Álbum del artista"`
		Titulo   string  `json:"titulo" required:"true" minLength:"1" maxLength:"200"`
		Chordpro string  `json:"chordpro" required:"true" minLength:"1"`
		Tono     *string `json:"tono,omitempty" maxLength:"10"`
		Capo     *int    `json:"capo,omitempty" minimum:"0" maximum:"12"`
		BPM      *int    `json:"bpm,omitempty" minimum:"20" maximum:"400"`
		Autor    *string `json:"autor,omitempty" maxLength:"200"`
		Arreglo  *string `json:"arreglista,omitempty" maxLength:"200"`
		Acceso   *string `json:"acceso,omitempty" enum:"free,premium,purchase,creator"`
		Orden    *int    `json:"orden,omitempty" minimum:"0" maximum:"32000"`
	}
}

type cancionOut struct {
	Body struct {
		ID        string    `json:"id"`
		AlbumID   string    `json:"album_id"`
		Titulo    string    `json:"titulo"`
		Tono      string    `json:"tono,omitempty"`
		Capo      *int      `json:"capo,omitempty"`
		BPM       *int      `json:"bpm,omitempty"`
		Autor     string    `json:"autor,omitempty"`
		Arreglo   string    `json:"arreglista,omitempty"`
		Acceso    string    `json:"acceso"`
		Orden     int       `json:"orden"`
		Publicada bool      `json:"publicada"`
		CreadoEn  time.Time `json:"creado_en"`
	}
}

func crearCancion(db database.DB) func(context.Context, *crearCancionInput) (*cancionOut, error) {
	return func(ctx context.Context, in *crearCancionInput) (*cancionOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		acceso := "free"
		if in.Body.Acceso != nil {
			acceso = *in.Body.Acceso
		}
		orden := 0
		if in.Body.Orden != nil {
			orden = *in.Body.Orden
		}
		out := &cancionOut{}
		err = tx.QueryRow(ctx, `
			insert into songs (album_id, title, chordpro, original_key, capo, bpm,
			                   author, arranger, publication_access, sort_order, is_published)
			select $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false
			from albums al
			where al.id = $1 and al.artist_id = $11 and al.deleted_at is null
			returning id, album_id, title, coalesce(original_key, ''), capo, bpm,
			          coalesce(author, ''), coalesce(arranger, ''), publication_access,
			          sort_order, is_published, created_at`,
			in.Body.AlbumID, in.Body.Titulo, in.Body.Chordpro, in.Body.Tono, in.Body.Capo,
			in.Body.BPM, in.Body.Autor, in.Body.Arreglo, acceso, orden, in.ArtistID,
		).Scan(&out.Body.ID, &out.Body.AlbumID, &out.Body.Titulo, &out.Body.Tono, &out.Body.Capo,
			&out.Body.BPM, &out.Body.Autor, &out.Body.Arreglo, &out.Body.Acceso,
			&out.Body.Orden, &out.Body.Publicada, &out.Body.CreadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("álbum no encontrado en este artista")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error creando la canción", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "cancion.creada", "song", out.Body.ID,
			map[string]any{"artista_id": in.ArtistID, "album_id": in.Body.AlbumID, "titulo": in.Body.Titulo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la canción", err)
		}
		return out, nil
	}
}

type actualizarCancionInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	SongID   string `path:"songId" format:"uuid" doc:"ID de la canción"`
	Body     struct {
		Titulo    *string `json:"titulo,omitempty" minLength:"1" maxLength:"200"`
		Chordpro  *string `json:"chordpro,omitempty" minLength:"1"`
		Tono      *string `json:"tono,omitempty" maxLength:"10"`
		Capo      *int    `json:"capo,omitempty" minimum:"0" maximum:"12"`
		BPM       *int    `json:"bpm,omitempty" minimum:"20" maximum:"400"`
		Autor     *string `json:"autor,omitempty" maxLength:"200"`
		Arreglo   *string `json:"arreglista,omitempty" maxLength:"200"`
		Acceso    *string `json:"acceso,omitempty" enum:"free,premium,purchase,creator"`
		Orden     *int    `json:"orden,omitempty" minimum:"0" maximum:"32000"`
		Publicada *bool   `json:"publicada,omitempty"`
	}
}

func actualizarCancion(db database.DB) func(context.Context, *actualizarCancionInput) (*cancionOut, error) {
	return func(ctx context.Context, in *actualizarCancionInput) (*cancionOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		out := &cancionOut{}
		err = tx.QueryRow(ctx, `
			update songs set
			  title               = coalesce($3, songs.title),
			  chordpro            = coalesce($4, songs.chordpro),
			  original_key        = coalesce($5, songs.original_key),
			  capo                = coalesce($6, songs.capo),
			  bpm                 = coalesce($7, songs.bpm),
			  author              = coalesce($8, songs.author),
			  arranger            = coalesce($9, songs.arranger),
			  publication_access  = coalesce($10, songs.publication_access),
			  sort_order          = coalesce($11, songs.sort_order),
			  is_published        = coalesce($12, songs.is_published)
			from albums al
			where songs.id = $2 and songs.album_id = al.id
			  and al.artist_id = $1 and al.deleted_at is null and songs.deleted_at is null
			returning songs.id, songs.album_id, songs.title, coalesce(songs.original_key, ''),
			          songs.capo, songs.bpm, coalesce(songs.author, ''), coalesce(songs.arranger, ''),
			          songs.publication_access, songs.sort_order, songs.is_published, songs.created_at`,
			in.ArtistID, in.SongID, in.Body.Titulo, in.Body.Chordpro, in.Body.Tono, in.Body.Capo,
			in.Body.BPM, in.Body.Autor, in.Body.Arreglo, in.Body.Acceso, in.Body.Orden, in.Body.Publicada,
		).Scan(&out.Body.ID, &out.Body.AlbumID, &out.Body.Titulo, &out.Body.Tono, &out.Body.Capo,
			&out.Body.BPM, &out.Body.Autor, &out.Body.Arreglo, &out.Body.Acceso,
			&out.Body.Orden, &out.Body.Publicada, &out.Body.CreadoEn)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("canción no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error actualizando la canción", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "cancion.actualizada", "song", in.SongID,
			map[string]any{"artista_id": in.ArtistID, "album_id": out.Body.AlbumID}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la canción", err)
		}
		return out, nil
	}
}

// ── Membresías ─────────────────────────────────────────────────────────────

type agregarMiembroInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	Body     struct {
		Email      string `json:"email" format:"email" doc:"Correo del usuario (debe tener perfil)"`
		MemberRole string `json:"member_role" enum:"member,manager" doc:"Rol por artista a asignar"`
	}
}

type miembroOut struct {
	Body struct {
		ArtistID   string    `json:"artist_id"`
		UserID     string    `json:"user_id"`
		Email      string    `json:"email"`
		MemberRole string    `json:"member_role"`
		CreadoEn   time.Time `json:"creado_en"`
	}
}

func agregarMiembro(db database.DB) func(context.Context, *agregarMiembroInput) (*miembroOut, error) {
	return func(ctx context.Context, in *agregarMiembroInput) (*miembroOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var artistID string
		if err := tx.QueryRow(ctx, `select id from artists where id = $1 for update`, in.ArtistID).Scan(&artistID); err != nil {
			return nil, huma.Error404NotFound("artista no encontrado")
		}

		// El perfil debe existir: profiles.id es el UUID de auth.users, que solo
		// se conoce cuando el usuario inicia sesión (la API no lee auth.users).
		var userID, email string
		err = tx.QueryRow(ctx,
			`select id, email from profiles where email = $1`, in.Body.Email,
		).Scan(&userID, &email)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("no existe un perfil con ese correo; el usuario debe iniciar sesión al menos una vez")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el perfil", err)
		}

		out := &miembroOut{}
		err = tx.QueryRow(ctx, `
			insert into artist_members (artist_id, user_id, member_role)
			values ($1, $2, $3)
			returning artist_id, user_id, member_role, created_at`,
			in.ArtistID, userID, in.Body.MemberRole,
		).Scan(&out.Body.ArtistID, &out.Body.UserID, &out.Body.MemberRole, &out.Body.CreadoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("el usuario ya es miembro de este artista")
			}
			return nil, huma.Error500InternalServerError("error agregando el miembro", err)
		}
		out.Body.Email = email
		if err := registrarAuditoria(ctx, tx, claims.Subject, "rol.asignado", "artist_members", in.ArtistID,
			map[string]any{"artista_id": in.ArtistID, "usuario_id": userID, "member_role": in.Body.MemberRole, "source": "api"}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la membresía", err)
		}
		return out, nil
	}
}

type quitarMiembroInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	UserID   string `path:"userId" format:"uuid" doc:"ID del usuario"`
}

type quitarMiembroOutput struct {
	Body struct {
		ArtistID   string    `json:"artist_id"`
		UserID     string    `json:"user_id"`
		Eliminado  bool      `json:"eliminado"`
		RevocadoEn time.Time `json:"revocado_en"`
	}
}

func quitarMiembro(db database.DB) func(context.Context, *quitarMiembroInput) (*quitarMiembroOutput, error) {
	return func(ctx context.Context, in *quitarMiembroInput) (*quitarMiembroOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var artistID string
		if err := tx.QueryRow(ctx, `select id from artists where id = $1 for update`, in.ArtistID).Scan(&artistID); err != nil {
			return nil, huma.Error404NotFound("artista no encontrado")
		}

		var memberRole string
		err = tx.QueryRow(ctx, `
			select member_role from artist_members where artist_id = $1 and user_id = $2`,
			in.ArtistID, in.UserID).Scan(&memberRole)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("membresía no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la membresía", err)
		}
		if memberRole == "manager" {
			var managers int
			if err := tx.QueryRow(ctx, `
				select count(*) from artist_members where artist_id = $1 and member_role = 'manager'`,
				in.ArtistID).Scan(&managers); err != nil {
				return nil, huma.Error500InternalServerError("error contando managers", err)
			}
			if managers <= 1 {
				return nil, huma.Error409Conflict("el artista debe conservar al menos un manager")
			}
		}

		if _, err := tx.Exec(ctx,
			`delete from artist_members where artist_id = $1 and user_id = $2`, in.ArtistID, in.UserID); err != nil {
			return nil, huma.Error500InternalServerError("error quitando el miembro", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "rol.revocado", "artist_members", in.ArtistID,
			map[string]any{"artista_id": in.ArtistID, "usuario_id": in.UserID, "source": "api"}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la revocación", err)
		}

		out := &quitarMiembroOutput{}
		out.Body.ArtistID = in.ArtistID
		out.Body.UserID = in.UserID
		out.Body.Eliminado = true
		out.Body.RevocadoEn = time.Now()
		return out, nil
	}
}

// registrarAuditoria inserta un evento de auditoría de mutación manager.
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}
