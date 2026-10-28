// Command seed carga los datos de desarrollo en la base: el himnario completo
// desde content/himnario/ (ambas versiones de contenido) y un catálogo mínimo
// (estilos + Trío Misión). Es idempotente: se puede re-ejecutar sin duplicar.
//
// Uso:
//
//	API_DATABASE_URL=postgres://... go run ./cmd/seed [-content ruta/a/content/himnario]
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

// versionSource mapea un directorio de .cho a una versión del himno.
type versionSource struct {
	dir   string
	code  string // version_code
	scope string // chord_scope
	label string // arrangement_label
}

var hymnSources = []versionSource{
	{"acordes-completos", "chords_full", "full_song", "Acordes completos"},
	{"fiel-pdf", "verse_chorus", "verse_chorus", "Fiel al PDF impreso"},
}

var (
	fileRe       = regexp.MustCompile(`^(\d+)\.cho$`)
	titleRe      = regexp.MustCompile(`(?m)^\{title:\s*(.*?)\s*\}`)
	keyRe        = regexp.MustCompile(`(?m)^\{key:\s*(.*?)\s*\}`)
	capoRe       = regexp.MustCompile(`(?m)^\{capo:\s*(\d+)\s*\}`)
	titleNumPref = regexp.MustCompile(`^\d+\s+`)
)

func main() {
	dsn := flag.String("dsn", os.Getenv("API_DATABASE_URL"), "cadena de conexión PostgreSQL")
	content := flag.String("content", "", "ruta a content/himnario (auto-detectada si se omite)")
	flag.Parse()

	if *dsn == "" {
		log.Fatal("API_DATABASE_URL es requerida (o usar -dsn)")
	}
	root := *content
	if root == "" {
		root = detectContentDir()
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, *dsn)
	if err != nil {
		log.Fatalf("conectar a PostgreSQL: %v", err)
	}
	defer conn.Close(ctx)

	tx, err := conn.Begin(ctx)
	if err != nil {
		log.Fatalf("iniciar transacción: %v", err)
	}
	defer tx.Rollback(ctx)

	if err := seedCatalog(ctx, tx); err != nil {
		log.Fatalf("seed de catálogo: %v", err)
	}
	if err := seedHimnario(ctx, tx, root); err != nil {
		log.Fatalf("seed de himnario: %v", err)
	}
	if err := seedStore(ctx, tx); err != nil {
		log.Fatalf("seed de tienda: %v", err)
	}
	if err := seedComercial(ctx, tx); err != nil {
		log.Fatalf("seed comercial: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("confirmar transacción: %v", err)
	}
	log.Println("seed de desarrollo aplicado")
}

// detectContentDir ubica content/himnario tanto si se corre desde la raíz del
// monorepo como desde services/api.
func detectContentDir() string {
	for _, candidate := range []string{
		"content/himnario",
		filepath.Join("..", "..", "content", "himnario"),
	} {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	log.Fatal("no se encontró content/himnario; usar -content")
	return ""
}

// seedCatalog inserta los estilos y el artista principal con datos mínimos,
// para que los módulos de lectura tengan catálogo público en desarrollo.
func seedCatalog(ctx context.Context, tx pgx.Tx) error {
	type style struct {
		slug, name string
		order      int
	}
	styles := []style{
		{"trio", "Trío", 1},
		{"cuarteto", "Cuarteto", 2},
		{"duo", "Dúo", 3},
		{"solista", "Solista", 4},
		{"grupo-vocal", "Grupo Vocal", 5},
		{"coro-coral", "Coro / Coral", 6},
		{"conjunto", "Conjunto", 7},
		{"vientos", "Vientos", 8},
		{"otro", "Otro", 9},
	}
	for _, s := range styles {
		if _, err := tx.Exec(ctx, `
			insert into styles (slug, name, sort_order) values ($1, $2, $3)
			on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order`,
			s.slug, s.name, s.order); err != nil {
			return fmt.Errorf("estilo %s: %w", s.slug, err)
		}
	}

	// UUID fijo heredado del seed de la v1: reproducible entre entornos.
	tag, err := tx.Exec(ctx, `
		insert into artists (id, slug, name, style_id, country, bio, social_links, is_published)
		values (
			'00000000-0000-4000-8000-000000000001',
			'trio-mision', 'Trio Misión',
			(select id from styles where slug = 'trio'),
			'Bolivia',
			'Trío vocal de música cristiana adventista.',
			'{"youtube": "https://www.youtube.com/@TrioMision", "facebook": "https://www.facebook.com/profile.php?id=100082466843092", "spotify": "https://open.spotify.com/intl-es/artist/3IJqAzw3YMvGBZ0MvXfVOC"}',
			true
		)
		on conflict (slug) do nothing`)
	if err != nil {
		return fmt.Errorf("artista trio-mision: %w", err)
	}

	// Segundo artista publicado: referencia para pruebas de aislamiento por
	// artista (member/manager de otro artista → 404) en el Sprint 3B.
	if _, err := tx.Exec(ctx, `
		insert into artists (id, slug, name, style_id, country, bio, is_published)
		values (
			'00000000-0000-4000-8000-000000000301',
			'coro-polifonico', 'Coro Polifónico',
			(select id from styles where slug = 'coro-coral'),
			'Bolivia', 'Coro polifónico de la iglesia local.', true
		)
		on conflict (slug) do nothing`); err != nil {
		return fmt.Errorf("artista coro-polifonico: %w", err)
	}
	log.Printf("catálogo: %d estilos, artista trio-mision (%s)", len(styles), map[bool]string{true: "insertado", false: "ya existía"}[tag.RowsAffected() == 1])
	return nil
}

// seedHimnario carga la colección completa desde los .cho de ambas versiones.
func seedHimnario(ctx context.Context, tx pgx.Tx, root string) error {
	var collectionID string
	err := tx.QueryRow(ctx, `
		insert into hymn_collections (slug, name, edition_label, language_code)
		values ('himnario-adventista', 'Himnario Adventista', '2020', 'es')
		on conflict (slug) do update set edition_label = excluded.edition_label
		returning id`).Scan(&collectionID)
	if err != nil {
		return fmt.Errorf("colección: %w", err)
	}

	// Himnos indexados por número: el título se toma de la primera fuente
	// disponible y cada fuente aporta su versión de contenido.
	type hymnData struct {
		title string
	}
	hymns := map[int]*hymnData{}
	versionCount := 0

	for _, src := range hymnSources {
		files, err := choFiles(filepath.Join(root, src.dir))
		if err != nil {
			return err
		}
		for _, f := range files {
			hymn, ok := hymns[f.number]
			if !ok {
				hymn = &hymnData{title: f.title}
				hymns[f.number] = hymn
			}
			hymnID, err := upsertHymn(ctx, tx, collectionID, f.number, hymn.title)
			if err != nil {
				return err
			}
			if err := upsertVersion(ctx, tx, hymnID, src, f); err != nil {
				return err
			}
			versionCount++
		}
		log.Printf("himnario: %s → %d archivos (%s)", src.dir, len(files), src.code)
	}
	log.Printf("himnario: %d himnos, %d versiones", len(hymns), versionCount)
	return nil
}

type choFile struct {
	number int
	title  string
	key    *string
	capo   *int
	body   string
}

// choFiles lista y parsea los NNN.cho de un directorio (ignora copias y
// cualquier archivo que no siga la nomenclatura numérica).
func choFiles(dir string) ([]choFile, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("leer %s: %w", dir, err)
	}
	var out []choFile
	for _, e := range entries {
		m := fileRe.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		number, _ := strconv.Atoi(m[1])
		raw, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return nil, fmt.Errorf("leer %s: %w", e.Name(), err)
		}
		body := string(raw)
		f := choFile{number: number, body: body}

		if t := titleRe.FindStringSubmatch(body); t != nil {
			f.title = titleNumPref.ReplaceAllString(t[1], "")
		}
		if f.title == "" {
			return nil, fmt.Errorf("%s: sin directiva {title:}", e.Name())
		}
		if k := keyRe.FindStringSubmatch(body); k != nil && k[1] != "" {
			key := k[1]
			f.key = &key
		}
		if c := capoRe.FindStringSubmatch(body); c != nil {
			if n, err := strconv.Atoi(strings.TrimSpace(c[1])); err == nil {
				f.capo = &n
			}
		}
		out = append(out, f)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].number < out[j].number })
	return out, nil
}

func upsertHymn(ctx context.Context, tx pgx.Tx, collectionID string, number int, title string) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		insert into hymns (collection_id, hymn_number, title)
		values ($1, $2, $3)
		on conflict (collection_id, hymn_number) do update
		set title = excluded.title, deleted_at = null
		returning id`, collectionID, number, title).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("himno %d: %w", number, err)
	}
	return id, nil
}

func upsertVersion(ctx context.Context, tx pgx.Tx, hymnID string, src versionSource, f choFile) error {
	_, err := tx.Exec(ctx, `
		insert into hymn_versions
			(hymn_id, version_code, chord_scope, arrangement_label, chordpro, original_key, capo, is_published)
		values ($1, $2, $3, $4, $5, $6, $7, true)
		on conflict (hymn_id, version_code) do update
		set chord_scope       = excluded.chord_scope,
		    arrangement_label = excluded.arrangement_label,
		    chordpro          = excluded.chordpro,
		    original_key      = excluded.original_key,
		    capo              = excluded.capo,
		    is_published      = true,
		    deleted_at        = null`,
		hymnID, src.code, src.scope, src.label, f.body, f.key, f.capo)
	if err != nil {
		return fmt.Errorf("himno %d versión %s: %w", f.number, src.code, err)
	}
	return nil
}
