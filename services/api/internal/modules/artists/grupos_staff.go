package artists

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/apierr"
	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// Administración de grupos (solo admin): alta, búsqueda, ficha, venta de pistas
// y portadas. Álbumes y canciones de cualquier grupo se administran con los
// endpoints de /mis-artistas, a los que el admin accede con control total.

const (
	prefijoImagenes = "public/imagenes/"
	maxBytesImagen  = 2 << 20
	ttlSubidaImagen = 10 * time.Minute
	comisionMinima  = 5.0
	comisionMaxima  = 10.0
)

var (
	slugRe          = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	redesPermitidas = map[string]bool{
		"instagram": true, "youtube": true, "spotify": true, "facebook": true,
		"tiktok": true, "x": true, "web": true,
	}
	reemplazoAcentos = strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n",
		"Á", "a", "É", "e", "Í", "i", "Ó", "o", "Ú", "u", "Ü", "u", "Ñ", "n",
	)
	tiposImagen = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
)

// slugify convierte un nombre en un slug de URL: minúsculas, sin acentos,
// guiones entre palabras.
func slugify(nombre string) string {
	base := reemplazoAcentos.Replace(strings.ToLower(strings.TrimSpace(nombre)))
	var b strings.Builder
	guion := false
	for _, r := range base {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			guion = false
		} else if b.Len() > 0 && !guion {
			b.WriteRune('-')
			guion = true
		}
	}
	return strings.TrimSuffix(b.String(), "-")
}

// validarSlug exige un slug de URL válido entre 2 y 80 caracteres.
func validarSlug(s string) error {
	if len(s) < 2 || len(s) > 80 || !slugRe.MatchString(s) {
		return errors.New("el slug solo admite minúsculas, números y guiones (2 a 80 caracteres)")
	}
	return nil
}

// validarRedes acepta solo redes conocidas con enlaces http(s).
func validarRedes(redes map[string]string) error {
	for red, enlace := range redes {
		if !redesPermitidas[red] {
			return fmt.Errorf("red no admitida: %s", red)
		}
		u, err := url.Parse(enlace)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || len(enlace) > 200 {
			return fmt.Errorf("enlace inválido para %s", red)
		}
	}
	return nil
}

// validarComision aplica la regla de venta: si el grupo vende pistas, la
// comisión debe estar entre 5 y 10 %. Sin venta, la comisión es opcional.
func validarComision(vendePistas bool, comision *float64) error {
	if comision != nil && (*comision < comisionMinima || *comision > comisionMaxima) {
		return errors.New("la comisión debe estar entre 5 y 10 %")
	}
	if vendePistas && comision == nil {
		return errors.New("para vender pistas hay que indicar la comisión (5 a 10 %)")
	}
	return nil
}

// verificarPortada comprueba que la imagen subida existe, es JPEG/PNG/WebP y
// no supera el tamaño permitido. Se llama al guardar la clave, no antes.
func verificarPortada(ctx context.Context, objects storage.Client, key string) error {
	if err := validarPrefijoPortada(key); err != nil {
		return err
	}
	size, contentType, err := objects.Head(ctx, key)
	if err != nil {
		return errors.New("la portada no existe; sube la imagen con POST /api/v1/staff/imagenes")
	}
	if _, ok := tiposImagen[contentType]; !ok {
		return errors.New("la portada debe ser JPEG, PNG o WebP")
	}
	if size > maxBytesImagen {
		return errors.New("la portada supera 2 MiB")
	}
	return nil
}

// validarPrefijoPortada exige que la clave esté bajo el prefijo público de imágenes.
func validarPrefijoPortada(key string) error {
	if !strings.HasPrefix(key, prefijoImagenes) || strings.Contains(key, "..") {
		return errors.New("la portada debe subirse con POST /api/v1/staff/imagenes")
	}
	return nil
}

// RegisterStaffGrupos registra la administración de grupos y la subida de imágenes.
func RegisterStaffGrupos(api huma.API, db database.DB, objects storage.Client) {
	admin := authz.RequireStaff(api, db, "admin")
	seguridad := []map[string][]string{{"bearer": {}}}

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-grupos",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/grupos",
		Summary:     "Buscar grupos (admin)",
		Description: "Grupos por nombre o slug, por orden de nombre. Límite de 1 a 200 (por defecto 50). Solo admin.",
		Tags:        []string{"staff", "grupos"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, listarGrupos(db))

	huma.Register(api, huma.Operation{
		OperationID:   "staff-crear-grupo",
		Method:        http.MethodPost,
		Path:          "/api/v1/staff/grupos",
		Summary:       "Crear un grupo (admin)",
		Description:   "Alta de un grupo. El slug se genera del nombre si no se indica. Para vender pistas hay que indicar la comisión (5 a 10 %). Solo admin.",
		Tags:          []string{"staff", "grupos"},
		Security:      seguridad,
		Middlewares:   []func(huma.Context, func(huma.Context)){admin},
		DefaultStatus: http.StatusCreated,
	}, crearGrupo(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "staff-obtener-grupo",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/grupos/{id}",
		Summary:     "Ficha de un grupo (admin)",
		Description: "Datos del grupo, configuración de venta de pistas, managers vinculados y conteo de álbumes. Solo admin.",
		Tags:        []string{"staff", "grupos"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, obtenerGrupo(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "staff-actualizar-grupo",
		Method:      http.MethodPatch,
		Path:        "/api/v1/staff/grupos/{id}",
		Summary:     "Actualizar un grupo (admin)",
		Description: "Actualiza solo los campos enviados: datos, publicación, portada y venta de pistas con su comisión. Solo admin.",
		Tags:        []string{"staff", "grupos"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, actualizarGrupo(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "staff-subir-imagen",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/imagenes",
		Summary:     "Preparar la subida de una imagen pública (admin)",
		Description: "Devuelve una subida firmada (POST a MinIO/S3) para una portada o logo: JPEG, PNG o WebP, máximo 2 MiB. " +
			"Tras subirla, usa la `key` como `cover_key` del grupo. Solo admin.",
		Tags:          []string{"staff", "imagenes"},
		Security:      seguridad,
		Middlewares:   []func(huma.Context, func(huma.Context)){admin},
		DefaultStatus: http.StatusCreated,
	}, subirImagen(objects))
}

// ── Listado y búsqueda ────────────────────────────────────────────────────

type listarGruposInput struct {
	Q      string `query:"q" required:"false" maxLength:"100" doc:"Texto a buscar en nombre o slug"`
	Limite int    `query:"limite" required:"false" minimum:"1" maximum:"200" default:"50" doc:"Máximo de resultados (1 a 200)"`
}

type grupoItem struct {
	ID          string   `json:"id"`
	Slug        string   `json:"slug"`
	Nombre      string   `json:"nombre"`
	Pais        string   `json:"pais,omitempty"`
	Publicado   bool     `json:"publicado"`
	VendePistas bool     `json:"vende_pistas"`
	Comision    *float64 `json:"comision_pct,omitempty" doc:"Comisión de la plataforma (5 a 10 %)"`
	Managers    int      `json:"managers"`
	Albumes     int      `json:"albumes"`
}

type listarGruposOutput struct {
	Body struct {
		Grupos []grupoItem `json:"grupos"`
	}
}

// filaGrupo es la forma común de escaneo de un grupo.
const filaGrupoSQL = `
	a.id::text, a.slug, a.name, coalesce(a.country, ''), a.is_published, a.can_sell_tracks,
	a.commission_pct::float8,
	(select count(*) from artist_members am where am.artist_id = a.id and am.member_role = 'manager'),
	(select count(*) from albums al where al.artist_id = a.id)`

func escanearItem(row pgx.Row) (grupoItem, error) {
	var g grupoItem
	err := row.Scan(&g.ID, &g.Slug, &g.Nombre, &g.Pais, &g.Publicado, &g.VendePistas, &g.Comision, &g.Managers, &g.Albumes)
	return g, err
}

func listarGrupos(db database.DB) func(context.Context, *listarGruposInput) (*listarGruposOutput, error) {
	return func(ctx context.Context, in *listarGruposInput) (*listarGruposOutput, error) {
		q := strings.TrimSpace(in.Q)
		limite := in.Limite
		if limite < 1 {
			limite = 50
		}
		rows, err := db.Query(ctx, `
			select `+filaGrupoSQL+`
			from artists a
			where ($1 = '' or a.name ilike $2 or a.slug ilike $2)
			order by a.name
			limit $3`, q, "%"+escaparLike(q)+"%", limite)
		if err != nil {
			return nil, apierr.Internal("error buscando grupos", err)
		}
		defer rows.Close()

		out := &listarGruposOutput{}
		out.Body.Grupos = []grupoItem{}
		for rows.Next() {
			g, err := escanearItem(rows)
			if err != nil {
				return nil, apierr.Internal("error leyendo los grupos", err)
			}
			out.Body.Grupos = append(out.Body.Grupos, g)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo los grupos", err)
		}
		return out, nil
	}
}

// escaparLike escapa los comodines de LIKE (misma regla que el listado de usuarios).
func escaparLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// ── Ficha (detalle) ───────────────────────────────────────────────────────

type idGrupoInput struct {
	ID string `path:"id" format:"uuid" doc:"ID del grupo"`
}

type gestorGrupo struct {
	UserID      string `json:"user_id"`
	Email       string `json:"email,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	Rol         string `json:"rol" doc:"member | manager"`
	Activo      bool   `json:"activo" doc:"false si la membresía está desactivada"`
}

// grupoDetalle es la ficha completa. Campos explícitos (sin embeber grupoItem)
// para que el contrato OpenAPI y la respuesta JSON coincidan.
type grupoDetalle struct {
	ID          string            `json:"id"`
	Slug        string            `json:"slug"`
	Nombre      string            `json:"nombre"`
	Pais        string            `json:"pais,omitempty"`
	Publicado   bool              `json:"publicado"`
	VendePistas bool              `json:"vende_pistas"`
	Comision    *float64          `json:"comision_pct,omitempty" doc:"Comisión de la plataforma (5 a 10 %)"`
	Managers    int               `json:"managers"`
	Albumes     int               `json:"albumes"`
	Bio         string            `json:"bio,omitempty"`
	Redes       map[string]string `json:"redes"`
	CoverKey    string            `json:"cover_key,omitempty"`
	CoverURL    string            `json:"cover_url,omitempty"`
	Gestores    []gestorGrupo     `json:"gestores" doc:"Managers vinculados"`
	Miembros    []gestorGrupo     `json:"miembros" doc:"Todos los vinculados (managers y members) con su estado"`
}

type grupoOutput struct {
	Body grupoDetalle
}

// cargarGrupo lee la ficha completa de un grupo.
func cargarGrupo(ctx context.Context, q database.Querier, objects storage.Client, id string) (*grupoDetalle, error) {
	var d grupoDetalle
	var redesJSON []byte
	var coverKey *string
	err := q.QueryRow(ctx, `
		select `+filaGrupoSQL+`, coalesce(a.bio, ''), a.social_links::text, a.cover_key
		from artists a where a.id = $1`, id).Scan(
		&d.ID, &d.Slug, &d.Nombre, &d.Pais, &d.Publicado, &d.VendePistas, &d.Comision, &d.Managers, &d.Albumes,
		&d.Bio, &redesJSON, &coverKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("grupo no encontrado")
	}
	if err != nil {
		return nil, err
	}
	d.Redes = map[string]string{}
	if err := json.Unmarshal(redesJSON, &d.Redes); err != nil {
		return nil, err
	}
	if coverKey != nil && *coverKey != "" {
		d.CoverKey = *coverKey
		d.CoverURL = objects.PublicURL(*coverKey)
	}

	rows, err := q.Query(ctx, `
		select p.id::text, coalesce(p.email, ''), coalesce(p.display_name, ''), am.member_role, am.activo
		from artist_members am join profiles p on p.id = am.user_id
		where am.artist_id = $1
		order by am.member_role desc, p.email`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	d.Miembros = []gestorGrupo{}
	d.Gestores = []gestorGrupo{}
	for rows.Next() {
		var g gestorGrupo
		if err := rows.Scan(&g.UserID, &g.Email, &g.DisplayName, &g.Rol, &g.Activo); err != nil {
			return nil, err
		}
		d.Miembros = append(d.Miembros, g)
		if g.Rol == "manager" {
			d.Gestores = append(d.Gestores, g)
		}
	}
	return &d, rows.Err()
}

func obtenerGrupo(db database.DB, objects storage.Client) func(context.Context, *idGrupoInput) (*grupoOutput, error) {
	return func(ctx context.Context, in *idGrupoInput) (*grupoOutput, error) {
		d, err := cargarGrupo(ctx, db, objects, in.ID)
		if err != nil {
			return nil, mapErrGrupo(err)
		}
		return &grupoOutput{Body: *d}, nil
	}
}

// ── Alta ──────────────────────────────────────────────────────────────────

type grupoDatosInput struct {
	Nombre      string            `json:"nombre" minLength:"2" maxLength:"120" doc:"Nombre del grupo"`
	Slug        string            `json:"slug,omitempty" maxLength:"80" doc:"Slug de URL; si se omite se genera del nombre"`
	Pais        string            `json:"pais,omitempty" maxLength:"80"`
	Bio         string            `json:"bio,omitempty" maxLength:"2000"`
	Redes       map[string]string `json:"redes,omitempty" doc:"Enlaces: instagram, youtube, spotify, facebook, tiktok, x, web"`
	CoverKey    string            `json:"cover_key,omitempty" maxLength:"300" doc:"Clave devuelta por POST /api/v1/staff/imagenes"`
	Publicado   bool              `json:"publicado,omitempty" doc:"Visible en el catálogo público (por defecto no)"`
	VendePistas bool              `json:"vende_pistas,omitempty" doc:"El grupo puede vender pistas (decisión del admin)"`
	Comision    *float64          `json:"comision_pct,omitempty" doc:"Comisión de la plataforma, 5 a 10 %"`
}

type crearGrupoInput struct {
	Body grupoDatosInput
}

func crearGrupo(db database.DB, objects storage.Client) func(context.Context, *crearGrupoInput) (*grupoOutput, error) {
	return func(ctx context.Context, in *crearGrupoInput) (*grupoOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		b := in.Body
		slug := strings.TrimSpace(b.Slug)
		if slug == "" {
			slug = slugify(b.Nombre)
		}
		if err := validarSlug(slug); err != nil {
			return nil, huma.Error422UnprocessableEntity(err.Error())
		}
		if err := validarRedes(b.Redes); err != nil {
			return nil, huma.Error422UnprocessableEntity(err.Error())
		}
		if err := validarComision(b.VendePistas, b.Comision); err != nil {
			return nil, huma.Error422UnprocessableEntity(err.Error())
		}
		if b.CoverKey != "" {
			if err := verificarPortada(ctx, objects, b.CoverKey); err != nil {
				return nil, huma.Error422UnprocessableEntity(err.Error())
			}
		}
		redesJSON, err := json.Marshal(b.Redes)
		if err != nil {
			return nil, apierr.Internal("error serializando redes", err)
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var id string
		err = tx.QueryRow(ctx, `
			insert into artists (slug, name, country, bio, social_links, cover_key, is_published, can_sell_tracks, commission_pct)
			values ($1, $2, nullif($3, ''), nullif($4, ''), $5::jsonb, nullif($6, ''), $7, $8, $9)
			returning id::text`,
			slug, strings.TrimSpace(b.Nombre), strings.TrimSpace(b.Pais), strings.TrimSpace(b.Bio),
			string(redesJSON), b.CoverKey, b.Publicado, b.VendePistas, b.Comision,
		).Scan(&id)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("ya existe un grupo con ese slug")
			}
			return nil, apierr.Internal("error creando el grupo", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "grupo.creado", "artists", id,
			map[string]any{"slug": slug, "vende_pistas": b.VendePistas}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando el grupo", err)
		}

		d, err := cargarGrupo(ctx, db, objects, id)
		if err != nil {
			return nil, apierr.Internal("error leyendo el grupo", err)
		}
		return &grupoOutput{Body: *d}, nil
	}
}

// ── Actualización parcial ─────────────────────────────────────────────────

type actualizarGrupoInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID del grupo"`
	Body struct {
		Nombre      *string            `json:"nombre,omitempty" minLength:"2" maxLength:"120"`
		Pais        *string            `json:"pais,omitempty" maxLength:"80"`
		Bio         *string            `json:"bio,omitempty" maxLength:"2000"`
		Redes       *map[string]string `json:"redes,omitempty"`
		CoverKey    *string            `json:"cover_key,omitempty" maxLength:"300"`
		Publicado   *bool              `json:"publicado,omitempty"`
		VendePistas *bool              `json:"vende_pistas,omitempty"`
		Comision    *float64           `json:"comision_pct,omitempty"`
	}
}

func actualizarGrupo(db database.DB, objects storage.Client) func(context.Context, *actualizarGrupoInput) (*grupoOutput, error) {
	return func(ctx context.Context, in *actualizarGrupoInput) (*grupoOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		b := in.Body

		if b.Redes != nil {
			if err := validarRedes(*b.Redes); err != nil {
				return nil, huma.Error422UnprocessableEntity(err.Error())
			}
		}
		if b.CoverKey != nil && *b.CoverKey != "" {
			if err := verificarPortada(ctx, objects, *b.CoverKey); err != nil {
				return nil, huma.Error422UnprocessableEntity(err.Error())
			}
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// Bloquea el grupo y lee el estado actual para validar el resultado final.
		var vende bool
		var comisionActual *float64
		err = tx.QueryRow(ctx, `
			select can_sell_tracks, commission_pct::float8 from artists where id = $1 for update`, in.ID).
			Scan(&vende, &comisionActual)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("grupo no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el grupo", err)
		}

		finalVende := vende
		if b.VendePistas != nil {
			finalVende = *b.VendePistas
		}
		finalComision := comisionActual
		if b.Comision != nil {
			finalComision = b.Comision
		}
		if err := validarComision(finalVende, finalComision); err != nil {
			return nil, huma.Error422UnprocessableEntity(err.Error())
		}

		var redesJSON *string
		if b.Redes != nil {
			j, err := json.Marshal(*b.Redes)
			if err != nil {
				return nil, apierr.Internal("error serializando redes", err)
			}
			s := string(j)
			redesJSON = &s
		}

		_, err = tx.Exec(ctx, `
			update artists set
			  name = coalesce($2, name),
			  country = case when $3::text is null then country else nullif($3, '') end,
			  bio = case when $4::text is null then bio else nullif($4, '') end,
			  social_links = coalesce($5::jsonb, social_links),
			  cover_key = case when $6::text is null then cover_key else nullif($6, '') end,
			  is_published = coalesce($7, is_published),
			  can_sell_tracks = $8,
			  commission_pct = $9
			where id = $1`,
			in.ID, trimOrNil(b.Nombre), trimOrNil(b.Pais), trimOrNil(b.Bio), redesJSON,
			b.CoverKey, b.Publicado, finalVende, finalComision,
		)
		if err != nil {
			return nil, apierr.Internal("error actualizando el grupo", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "grupo.actualizado", "artists", in.ID,
			map[string]any{"vende_pistas": finalVende}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando los cambios", err)
		}

		d, err := cargarGrupo(ctx, db, objects, in.ID)
		if err != nil {
			return nil, apierr.Internal("error leyendo el grupo", err)
		}
		return &grupoOutput{Body: *d}, nil
	}
}

// trimOrNil devuelve el texto sin espacios, o nil si no se envió.
func trimOrNil(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	return &t
}

// ── Imágenes ──────────────────────────────────────────────────────────────

type subirImagenInput struct {
	Body struct {
		Tipo        string `json:"tipo" enum:"grupo,album" doc:"Para qué es la imagen"`
		ContentType string `json:"content_type" enum:"image/jpeg,image/png,image/webp" doc:"Tipo MIME de la imagen"`
	}
}

type subirImagenOutput struct {
	Body struct {
		Key       string            `json:"key" doc:"Clave a guardar como cover_key"`
		UploadURL string            `json:"upload_url" doc:"POST multipart a esta URL con los campos devueltos"`
		Fields    map[string]string `json:"fields"`
		PublicURL string            `json:"public_url"`
		ExpiraEn  int               `json:"expira_en_segundos"`
	}
}

func subirImagen(objects storage.Client) func(context.Context, *subirImagenInput) (*subirImagenOutput, error) {
	return func(ctx context.Context, in *subirImagenInput) (*subirImagenOutput, error) {
		id, err := randomHex(16)
		if err != nil {
			return nil, apierr.Internal("error generando la clave", err)
		}
		key := fmt.Sprintf("%s%s/%s.%s", prefijoImagenes, in.Body.Tipo, id, tiposImagen[in.Body.ContentType])
		post, err := objects.PresignPost(ctx, key, in.Body.ContentType, maxBytesImagen, ttlSubidaImagen)
		if err != nil {
			return nil, apierr.Internal("error preparando la subida", err)
		}
		out := &subirImagenOutput{}
		out.Body.Key = key
		out.Body.UploadURL = post.URL
		out.Body.Fields = post.Fields
		out.Body.PublicURL = objects.PublicURL(key)
		out.Body.ExpiraEn = int(ttlSubidaImagen.Seconds())
		return out, nil
	}
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// mapErrGrupo traduce errores de lectura de un grupo; el resto no filtra detalle.
func mapErrGrupo(err error) error {
	var se huma.StatusError
	if errors.As(err, &se) {
		return err
	}
	return apierr.Internal("error leyendo el grupo", err)
}
