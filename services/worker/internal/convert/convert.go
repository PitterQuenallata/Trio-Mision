// Package convert implementa la conversión determinista de texto posicionado
// de PDF (acordes sobre letra) a canciones ChordPro. Es un port fiel del
// algoritmo especificado en
// legacy/panelweb-triomision-lyrics/src/lib/pdfToCho.ts: agrupa items por
// renglones, separa líneas de acordes de líneas de letra, fusiona los
// acordes en la columna exacta, convierte la notación latina a anglosajona y
// detecta número/título/tono/capo/autor, con issues por canción
// (status ok | revisar). 100% determinista: sin azar, sin OCR ni IA.
package convert

import (
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

// RawTextItem es un item de texto crudo con posición (equivalente a la salida
// posicionada de pdf.js o de pdftotext -bbox). El origen es inferior
// izquierdo (Y crece hacia arriba) y H es el alto del item ≈ tamaño de fuente.
type RawTextItem struct {
	X, Y, H, W float64
	Str        string
	Page       int
}

// PdfToken es una palabra con posición horizontal absoluta.
type PdfToken struct {
	X     float64
	Str   string
	CharW float64
}

// PdfLine es un renglón reconstruido: tokens ordenados por x.
type PdfLine struct {
	Y        float64
	Page     int
	FontSize float64
	Tokens   []PdfToken
}

// Cancion es una canción convertida, lista para la revisión editorial.
type Cancion struct {
	Indice   int      `json:"indice"`
	Titulo   string   `json:"titulo"`
	Numero   *int     `json:"numero"`
	Tono     *string  `json:"tono"`
	Capo     *int     `json:"capo"`
	Autor    *string  `json:"autor"`
	ChordPro string   `json:"chordpro"`
	Status   string   `json:"status" doc:"ok | revisar"`
	Issues   []string `json:"issues"`
}

// ── Acordes: notación latina → anglosajona ─────────────────────────────────

var latinNotes = map[string]string{
	"do": "C", "re": "D", "mi": "E", "fa": "F", "sol": "G", "la": "A", "si": "B",
}

// latinRe acepta Do, RE, Sol7, lam, DoM, Fa#m7, Sol/Si… (case-insensitive
// como el /i de la especificación; las capturas conservan el caso original).
var latinRe = regexp.MustCompile(`^(?i)(do|re|mi|fa|sol|la|si)([#b]?)([Mm]?)(\d{0,2})(?:/(do|re|mi|fa|sol|la|si)([#b]?))?$`)

var englishRe = regexp.MustCompile(`^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M)?\d{0,2}(?:sus\d?)?(?:/[A-G][#b]?)?$`)

// ConvertChordToken convierte un token de acorde a notación anglosajona, o
// devuelve nil si no es acorde. Latina: mayúscula+M = mayor (DOM→C, SOL7→G7),
// minúscula+m = menor (lam→Am). Palabras españolas sueltas (la, mi, sol…)
// NO cuentan como acorde.
func ConvertChordToken(tok string) *string {
	m := latinRe.FindStringSubmatch(tok)
	if m != nil {
		base, accidental, quality, digits, bass, bassAccidental := m[1], m[2], m[3], m[4], m[5], m[6]
		if base == strings.ToLower(base) && accidental == "" && quality == "" && digits == "" && bass == "" {
			return nil
		}
		note := latinNotes[strings.ToLower(base)] + accidental
		minor := ""
		if quality == "m" {
			minor = "m" // 'M' = mayor → se omite
		}
		bassSuffix := ""
		if bass != "" {
			bassSuffix = "/" + latinNotes[strings.ToLower(bass)] + bassAccidental
		}
		out := note + minor + digits + bassSuffix
		return &out
	}
	if englishRe.MatchString(tok) {
		return &tok
	}
	return nil
}

// fillerRe reconoce rasgueos "////" y separadores (– es el guion largo U+2013).
var fillerRe = regexp.MustCompile(`(?i)^[/\-–|x]+$`)

var wordsRe = regexp.MustCompile(`\S+`)

// runeLen cuenta unidades de código UTF-16 equivalentes (todo el contenido
// relevante está en el BMP: 1 runa == 1 unidad UTF-16, como JS String.length).
func runeLen(s string) int { return utf8.RuneCountInString(s) }

// ItemsToLines agrupa items por renglón (cluster de y, tolerancia 2.5) y
// separa cada item en tokens (palabras) posicionados por ancho de caracter.
func ItemsToLines(items []RawTextItem) []PdfLine {
	byPage := map[int][]RawTextItem{}
	for _, it := range items {
		if strings.TrimSpace(it.Str) == "" {
			continue
		}
		byPage[it.Page] = append(byPage[it.Page], it)
	}
	pages := make([]int, 0, len(byPage))
	for p := range byPage {
		pages = append(pages, p)
	}
	sort.Ints(pages)

	var lines []PdfLine
	for _, page := range pages {
		pageItems := byPage[page]
		sort.SliceStable(pageItems, func(i, j int) bool {
			if pageItems[i].Y != pageItems[j].Y {
				return pageItems[i].Y > pageItems[j].Y // y descendente
			}
			return pageItems[i].X < pageItems[j].X
		})
		var cluster []RawTextItem
		flush := func() {
			if len(cluster) == 0 {
				return
			}
			sort.SliceStable(cluster, func(i, j int) bool { return cluster[i].X < cluster[j].X })
			var tokens []PdfToken
			maxH := 0.0
			for _, it := range cluster {
				if it.H > maxH {
					maxH = it.H
				}
				charW := it.W / math.Max(float64(runeLen(it.Str)), 1)
				base := it.X
				for _, loc := range wordsRe.FindAllStringIndex(it.Str, -1) {
					prefix := it.Str[:loc[0]]
					tokens = append(tokens, PdfToken{
						X:     base + float64(runeLen(prefix))*charW,
						Str:   it.Str[loc[0]:loc[1]],
						CharW: charW,
					})
				}
			}
			lines = append(lines, PdfLine{Y: cluster[0].Y, Page: page, FontSize: maxH, Tokens: tokens})
			cluster = nil
		}
		for _, it := range pageItems {
			if len(cluster) > 0 && math.Abs(cluster[0].Y-it.Y) > 2.5 {
				flush()
			}
			cluster = append(cluster, it)
		}
		flush()
	}
	return lines
}

// ── Utilidades de línea ────────────────────────────────────────────────────

func plainText(line PdfLine) string {
	var sb strings.Builder
	for i, t := range line.Tokens {
		if i > 0 {
			sb.WriteByte(' ')
		}
		sb.WriteString(t.Str)
	}
	return sb.String()
}

// lyricMapper devuelve el texto de la letra y una función que mapea una x del
// PDF a un índice de inserción en ese texto.
func lyricMapper(line PdfLine) (string, func(x float64) int) {
	text := ""
	var offsets []int
	for _, t := range line.Tokens {
		if text != "" {
			text += " "
		}
		offsets = append(offsets, len(text))
		text += t.Str
	}
	indexAt := func(x float64) int {
		idx := 0
		for i, t := range line.Tokens {
			if x < t.X-t.CharW/2 {
				break
			}
			rel := math.Round((x - t.X) / t.CharW)
			clamped := math.Min(math.Max(rel, 0), float64(runeLen(t.Str)))
			idx = offsets[i] + int(clamped)
			// si cae más allá de este token, el próximo ajuste (o queda al final)
			nextOff := len(text)
			if i+1 < len(line.Tokens) {
				nextOff = offsets[i+1]
			}
			if idx > nextOff {
				idx = nextOff
			}
		}
		return int(math.Min(float64(idx), float64(len(text))))
	}
	return text, indexAt
}

type chordAt struct {
	x     float64
	chord string
	raw   string
}

// chordsOf devuelve los acordes convertidos de la línea si todos los tokens
// (salvo rasgueos) son acordes; nil en caso contrario (estricta).
func chordsOf(line PdfLine) []chordAt {
	var chords []chordAt
	convertible := 0
	words := 0
	for _, t := range line.Tokens {
		if fillerRe.MatchString(t.Str) {
			continue
		}
		words++
		if c := ConvertChordToken(t.Str); c != nil {
			convertible++
			chords = append(chords, chordAt{x: t.X, chord: *c, raw: t.Str})
		}
	}
	if convertible == 0 || convertible < words {
		return nil
	}
	return chords
}

// mergeChords fusiona los acordes en la letra insertando [C] en la columna
// exacta (de atrás hacia adelante para no desplazar índices).
func mergeChords(chords []chordAt, lyric PdfLine) string {
	text, indexAt := lyricMapper(lyric)
	type placed struct {
		idx   int
		chord string
	}
	var ps []placed
	for _, c := range chords {
		ps = append(ps, placed{idx: indexAt(c.x), chord: c.chord})
	}
	sort.SliceStable(ps, func(i, j int) bool { return ps[i].idx < ps[j].idx })
	out := text
	for i := len(ps) - 1; i >= 0; i-- {
		out = out[:ps[i].idx] + "[" + ps[i].chord + "]" + out[ps[i].idx:]
	}
	return out
}

// ── Detección de estructura ────────────────────────────────────────────────

var sectionMarkers = map[string]string{
	"coro": "Coro", "estribillo": "Coro", "precoro": "Pre-coro", "pre-coro": "Pre-coro",
}

var authorRe = regexp.MustCompile(`(?i)^(?:autor(?:es)?|letra y m[uú]sica|letra|m[uú]sica)\s*:\s*(.+)$`)

var capoRe = regexp.MustCompile(`(?i)^capo(?:traste)?(?:\s+en)?(?:\s+(?:la\s+)?casilla)?\s*:?\s*(\d{1,2})$`)

var headerRe = regexp.MustCompile(`^(\d{1,3})[.)-]?\s+(.+)$`)

var spacesRe = regexp.MustCompile(`[\s ]+`)

// modalFontSize devuelve el tamaño de fuente del cuerpo: el más frecuente
// ponderado por caracteres. Los empates se resuelven por primera aparición
// (orden de inserción), igual que la especificación — determinista.
func modalFontSize(lines []PdfLine) float64 {
	freq := map[int]float64{}
	var order []int
	for _, l := range lines {
		k := int(math.Round(l.FontSize))
		if _, ok := freq[k]; !ok {
			order = append(order, k)
		}
		var n float64
		for _, t := range l.Tokens {
			n += float64(runeLen(t.Str))
		}
		freq[k] += n
	}
	best, bestN := 11.0, 0.0
	for _, k := range order {
		if freq[k] > bestN {
			best, bestN = float64(k), freq[k]
		}
	}
	return best
}

// pageBodySizes calcula el tamaño de fuente del cuerpo por página (los PDFs
// mezclan cuerpos de 10 y 11 pt).
func pageBodySizes(lines []PdfLine) map[int]float64 {
	byPage := map[int][]PdfLine{}
	for _, l := range lines {
		byPage[l.Page] = append(byPage[l.Page], l)
	}
	sizes := map[int]float64{}
	for page, pageLines := range byPage {
		sizes[page] = modalFontSize(pageLines)
	}
	return sizes
}

func bodySize(sizes map[int]float64, page int) float64 {
	if s, ok := sizes[page]; ok {
		return s
	}
	return 11
}

// SongsFromLines convierte todos los renglones del documento en canciones.
func SongsFromLines(allLines []PdfLine) []Cancion {
	if len(allLines) == 0 {
		return nil
	}
	bodyOf := pageBodySizes(allLines)
	// Descartar texto miniatura (pie de página) y etiquetas de diagramas de
	// acordes: líneas de solo-acordes en fuente menor que el cuerpo de su página.
	var lines []PdfLine
	for _, l := range allLines {
		body := bodySize(bodyOf, l.Page)
		if l.FontSize < body*0.78 {
			continue
		}
		if l.FontSize < body*0.95 && chordsOf(l) != nil {
			continue
		}
		lines = append(lines, l)
	}
	if len(lines) == 0 {
		return nil
	}
	isHeader := func(l PdfLine) bool { return l.FontSize >= bodySize(bodyOf, l.Page)*1.3 }

	// Gap típico entre renglones consecutivos (para detectar líneas en blanco).
	var gaps []float64
	for i := 1; i < len(lines); i++ {
		if lines[i].Page != lines[i-1].Page {
			continue
		}
		if g := lines[i-1].Y - lines[i].Y; g > 0 {
			gaps = append(gaps, g)
		}
	}
	sort.Float64s(gaps)
	medGap := 12.0
	if len(gaps) > 0 {
		medGap = gaps[len(gaps)/2]
	}

	type draft struct {
		number                 *int
		title                  string
		author                 *string
		capo                   *int
		body                   []string
		issues                 []string
		chordCount, lyricCount int
		firstChord             *string
		sectionOpen            bool
	}

	var songs []Cancion
	var d *draft

	pushBlank := func() {
		if d.sectionOpen {
			d.body = append(d.body, "{eoc}")
			d.sectionOpen = false
		}
		if len(d.body) > 0 && d.body[len(d.body)-1] != "" {
			d.body = append(d.body, "")
		}
	}

	finish := func() {
		if d == nil {
			return
		}
		cur := d
		d = nil
		if cur.sectionOpen {
			cur.body = append(cur.body, "{eoc}")
		}
		for len(cur.body) > 0 && cur.body[len(cur.body)-1] == "" {
			cur.body = cur.body[:len(cur.body)-1]
		}
		if cur.title == "" {
			cur.issues = append(cur.issues, "Sin título detectado")
		}
		if cur.chordCount == 0 {
			cur.issues = append(cur.issues, "Sin acordes detectados")
		}
		if cur.lyricCount == 0 {
			cur.issues = append(cur.issues, "Sin letra detectada")
		}
		// Descartar restos vacíos (portadas, páginas de índice).
		if cur.chordCount == 0 && cur.lyricCount < 3 {
			return
		}

		title := cur.title
		if title == "" {
			title = "Sin título"
		}
		meta := []string{"{title: " + title + "}"}
		if cur.number != nil {
			meta = append(meta, "{number: "+strconv.Itoa(*cur.number)+"}")
		}
		if cur.firstChord != nil {
			meta = append(meta, "{key: "+*cur.firstChord+"}")
		}
		if cur.capo != nil {
			meta = append(meta, "{capo: "+strconv.Itoa(*cur.capo)+"}")
		}
		if cur.author != nil {
			meta = append(meta, "{author: "+*cur.author+"}")
		}

		status := "ok"
		if len(cur.issues) > 0 {
			status = "revisar"
		}
		songs = append(songs, Cancion{
			Indice:   len(songs),
			Numero:   cur.number,
			Titulo:   title,
			Tono:     cur.firstChord,
			Capo:     cur.capo,
			Autor:    cur.author,
			ChordPro: strings.Join(append(append([]string{}, meta...), append([]string{""}, cur.body...)...), "\n"),
			Status:   status,
			Issues:   cur.issues,
		})
	}

	newDraft := func() *draft {
		return &draft{issues: []string{}}
	}

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		text := plainText(line)

		if isHeader(line) {
			m := headerRe.FindStringSubmatch(text)
			if d != nil && len(d.body) == 0 && d.chordCount == 0 && m == nil {
				// Título largo partido en dos renglones grandes.
				d.title = strings.TrimSpace(d.title + " " + text)
				continue
			}
			finish()
			d = newDraft()
			if m != nil {
				n, _ := strconv.Atoi(m[1])
				d.number = &n
				d.title = strings.TrimSpace(m[2])
			} else {
				d.title = strings.TrimSpace(text)
			}
			continue
		}

		if d == nil {
			// Contenido antes del primer encabezado.
			d = newDraft()
		}

		// Línea en blanco implícita (salto vertical grande o cambio de página).
		if i > 0 {
			prev := lines[i-1]
			if prev.Page != line.Page || prev.Y-line.Y > medGap*1.7 {
				pushBlank()
			}
		}

		// Autor.
		if am := authorRe.FindStringSubmatch(text); am != nil {
			if d.author == nil {
				a := strings.TrimSpace(am[1])
				d.author = &a
			}
			continue
		}

		// Capo ("Capotraste en casilla 3", "Capo 3").
		if cm := capoRe.FindStringSubmatch(text); cm != nil {
			if d.capo == nil {
				if n, err := strconv.Atoi(cm[1]); err == nil {
					d.capo = &n
				}
			}
			continue
		}

		// Marcador de sección (CORO, ESTRIBILLO…).
		marker := sectionMarkers[spacesRe.ReplaceAllString(strings.ToLower(text), "")]
		if marker != "" {
			if d.sectionOpen {
				d.body = append(d.body, "{eoc}")
			}
			if len(d.body) > 0 && d.body[len(d.body)-1] != "" {
				d.body = append(d.body, "")
			}
			d.body = append(d.body, "{soc: "+marker+"}")
			d.sectionOpen = true
			continue
		}

		// Línea de acordes.
		if chords := chordsOf(line); chords != nil {
			d.chordCount += len(chords)
			if d.firstChord == nil {
				d.firstChord = &chords[0].chord
			}
			var next *PdfLine
			if i+1 < len(lines) {
				next = &lines[i+1]
			}
			var nextIsLyric bool
			if next != nil {
				samePageClose := next.Page == line.Page && line.Y-next.Y <= medGap*1.7
				crossPage := next.Page == line.Page+1 && line.Y < next.Y
				nextText := plainText(*next)
				nextMarker := sectionMarkers[spacesRe.ReplaceAllString(strings.ToLower(nextText), "")]
				nextIsLyric = (samePageClose || crossPage) &&
					!isHeader(*next) && chordsOf(*next) == nil && nextMarker == ""
			}
			if nextIsLyric {
				d.body = append(d.body, mergeChords(chords, *next))
				d.lyricCount++
				i++ // consumir la línea de letra
			} else {
				// Línea de acordes huérfana (intro, interludio…).
				var parts []string
				for _, c := range chords {
					parts = append(parts, "["+c.chord+"]")
				}
				d.body = append(d.body, strings.Join(parts, " "))
				d.issues = append(d.issues, "Acordes sin letra: \""+text+"\"")
			}
			continue
		}

		// Letra sin acordes.
		d.body = append(d.body, text)
		d.lyricCount++
	}
	finish()

	return songs
}
