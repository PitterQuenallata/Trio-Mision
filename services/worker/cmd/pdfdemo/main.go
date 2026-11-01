// pdfdemo genera un PDF editorial de demostración con texto posicionado
// (acordes sobre letra, notación latina) a partir de los primeros N archivos
// .cho del himnario. Es la herramienta de desarrollo que produce el fixture
// del E2E de importación (ver scripts/gen-import-fixtures.sh y el README del
// worker): 100% determinista (stdlib puro, métricas AFM de Helvetica) y sin
// contenido protegible: solo títulos y letras de dominio público ya
// versionados en content/himnario.
//
//	go run ./cmd/pdfdemo -dir <carpeta .cho> -n 10 -out demo.pdf
//	go run ./cmd/pdfdemo -kind vacio -out vacio.pdf   # PDF válido sin texto
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// ── Métricas AFM de Helvetica (base-14, dominio público) ───────────────────

var helveticaWidths = map[rune]int{
	' ': 278, '!': 278, '"': 355, '(': 333, ')': 333, ',': 278, '-': 333,
	'.': 278, '/': 278, ':': 278, ';': 278, '?': 556, '¡': 333, '¿': 556,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556,
	'5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
	'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778,
	'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722,
	'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722,
	'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611,
	'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556,
	'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556,
	'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556,
	'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
	'á': 556, 'é': 556, 'í': 278, 'ó': 556, 'ú': 556, 'ñ': 556,
	'Á': 667, 'É': 667, 'Í': 278, 'Ó': 778, 'Ú': 722, 'Ñ': 722,
	'ü': 556, 'Ü': 722, 'º': 370, 'ª': 370, '&': 667, '\'': 191,
}

func textWidth(s string, size float64) float64 {
	w := 0
	for _, r := range s {
		aw, ok := helveticaWidths[r]
		if !ok {
			aw = 556
		}
		w += aw
	}
	return float64(w) * size / 1000
}

// ── Parsing mínimo de ChordPro (.cho) ──────────────────────────────────────

type choChord struct {
	name      string // ya en notación latina
	wordIndex int    // palabra de la línea a la que se adhiere
}

type choLine struct {
	chords []choChord
	lyric  string
}

type choSong struct {
	number   int
	title    string
	lyricist string
	blocks   [][]choLine
}

var (
	titleRe      = regexp.MustCompile(`^\{title:\s*(.+?)\s*\}$`)
	lyricistRe   = regexp.MustCompile(`^\{lyricist:\s*(.+?)\s*\}`)
	chordRe      = regexp.MustCompile(`\[([^\]]+)\]`)
	leadingNumRe = regexp.MustCompile(`^\d+\s+(.+)$`)
)

var latinRoot = map[byte]string{'C': "Do", 'D': "Re", 'E': "Mi", 'F': "Fa", 'G': "Sol", 'A': "La", 'B': "Si"}

// toLatin convierte un acorde ChordPro a notación latina (los .cho del
// himnario usan notación anglosajona; el PDF demo ejercita la conversión
// latina→anglosajona del conversor). Los acordes no representables (º) se
// simplifican a su fundamental: es un fixture sintético de demostración.
func toLatin(ch string) string {
	if ch == "" {
		return ""
	}
	bass := ""
	if i := strings.IndexByte(ch, '/'); i >= 0 {
		bass = "/" + toLatinRoot(ch[i+1:])
		ch = ch[:i]
	}
	ch = strings.ReplaceAll(ch, "º", "")
	ch = strings.ReplaceAll(ch, "°", "")
	return toLatinRoot(ch) + bass
}

func toLatinRoot(root string) string {
	if root == "" {
		return root
	}
	latin, ok := latinRoot[root[0]]
	if !ok {
		return root
	}
	return latin + root[1:]
}

// parseCho extrae número, título, autor y los bloques {sov} con sus líneas
// de letra y los acordes adheridos a cada palabra.
func parseCho(number int, content string) choSong {
	song := choSong{number: number}
	inBlock := false
	var block []choLine
	for _, raw := range strings.Split(content, "\n") {
		line := strings.TrimSpace(strings.TrimSuffix(raw, "\r"))
		if line == "" {
			continue
		}
		switch {
		case strings.HasPrefix(line, "{sov}") || strings.HasPrefix(line, "{soc}"):
			inBlock = true
			block = nil
			continue
		case strings.HasPrefix(line, "{eov}") || strings.HasPrefix(line, "{eoc}"):
			inBlock = false
			if len(block) > 0 {
				song.blocks = append(song.blocks, block)
			}
			continue
		}
		if m := titleRe.FindStringSubmatch(line); m != nil {
			song.title = m[1]
			continue
		}
		if m := lyricistRe.FindStringSubmatch(line); m != nil {
			song.lyricist = m[1]
			continue
		}
		if !inBlock || strings.HasPrefix(line, "{") {
			continue
		}
		// Cada marcador [acorde] se adhiere a la palabra en curso de la línea:
		// wordAt(pos) cuenta palabras (secuencias de no-espacios) antes del
		// byte pos de la línea original.
		var chords []choChord
		lyric := strings.TrimSpace(chordRe.ReplaceAllString(line, ""))
		wordAt := func(bytePos int) int {
			n, seenSpace := 0, true
			for _, c := range line[:bytePos] {
				if c == ' ' || c == '\t' {
					seenSpace = true
				} else if seenSpace {
					n++
					seenSpace = false
				}
			}
			return n
		}
		for _, m := range chordRe.FindAllStringIndex(line, -1) {
			chords = append(chords, choChord{
				name:      toLatin(line[m[0]+1 : m[1]-1]),
				wordIndex: wordAt(m[0]),
			})
		}
		if lyric != "" {
			block = append(block, choLine{chords: chords, lyric: lyric})
		}
	}
	return song
}

// ── Layout: páginas de líneas posicionadas ─────────────────────────────────

type placedWord struct {
	x    float64
	text string
}

type placedLine struct {
	y     float64
	size  float64
	words []placedWord
}

type page struct {
	lines []placedLine
}

const (
	pageW      = 612.0
	pageH      = 792.0
	marginX    = 60.0
	yTop       = 730.0
	yBottom    = 80.0
	sizeBody   = 11.0
	sizeHeader = 18.0
	leading    = 15.0 // acorde→letra y letra→acorde siguiente
	blockGap   = 30.0 // última lírica del bloque→primer acorde del siguiente
	songGap    = 24.0 // última línea de la canción→cabecera siguiente
)

// lineFromWords coloca palabras en secuencia desde x inicial.
func lineFromWords(y, size, startX float64, words []string) placedLine {
	ln := placedLine{y: y, size: size}
	x := startX
	for _, w := range words {
		if w == "" {
			continue
		}
		ln.words = append(ln.words, placedWord{x: x, text: w})
		x += textWidth(w, size) + textWidth(" ", size)
	}
	return ln
}

// chordLine coloca cada acorde en la x exacta de su palabra (o al final de la
// línea cuando no hay palabra asociada). Los acordes que colisionarían con el
// anterior se omiten: la superposición corrompería la extracción de palabras.
func chordLine(y, size, startX float64, words []string, chords []choChord) placedLine {
	ln := placedLine{y: y, size: size}
	xs := wordXs(words, startX, size)
	byWord := map[int][]string{}
	for _, ch := range chords {
		if ch.wordIndex < len(words) {
			byWord[ch.wordIndex] = append(byWord[ch.wordIndex], ch.name)
		}
	}
	prevEnd := -1.0
	minGap := 0.4 * size // separación mínima entre acordes (evita fusiones)
	for wi := 0; wi < len(words); wi++ {
		for _, name := range byWord[wi] {
			w := textWidth(name, size)
			if xs[wi] < prevEnd+minGap {
				continue // colisión con el acorde anterior: se omite
			}
			ln.words = append(ln.words, placedWord{x: xs[wi], text: name})
			prevEnd = xs[wi] + w
		}
	}
	return ln
}

// wordXs calcula la x de inicio de cada palabra (1 ancho de espacio entre
// palabras), con la métrica del tamaño de fuente dado.
func wordXs(words []string, start, size float64) []float64 {
	xs := make([]float64, len(words))
	x := start
	for i, w := range words {
		xs[i] = x
		x += textWidth(w, size) + textWidth(" ", size)
	}
	return xs
}

func layoutSongs(songs []choSong) []page {
	var pages []page
	cur := &page{}
	y := yTop

	breakPage := func() {
		pages = append(pages, *cur)
		cur = &page{}
		y = yTop
	}

	for si, song := range songs {
		if y < yBottom+130 {
			breakPage()
		}
		// Cabecera "N Título" (18pt): el conversor la detecta con HEADER_RE.
		// El título .cho ya trae el número ("01 Cantad…"): se quita para no
		// duplicarlo en la cabecera.
		title := song.title
		if title == "" {
			title = "Sin título"
		} else if m := leadingNumRe.FindStringSubmatch(title); m != nil {
			title = strings.TrimSpace(m[1])
		}
		cur.lines = append(cur.lines, lineFromWords(y, sizeHeader, marginX,
			strings.Split(fmt.Sprintf("%d %s", song.number, title), " ")))
		y -= 24
		if song.lyricist != "" {
			cur.lines = append(cur.lines, lineFromWords(y, sizeBody, marginX,
				strings.Split("Autor: "+song.lyricist, " ")))
			y -= leading
		}
		if si == 2 { // una canción con cejilla para ejercitar CAPO_RE
			cur.lines = append(cur.lines, lineFromWords(y, sizeBody, marginX, []string{"Capo 3"}))
			y -= leading
		}
		if si == 4 { // intro de acordes huérfanos (issue "Acordes sin letra")
			cur.lines = append(cur.lines, lineFromWords(y, sizeBody, marginX, []string{"Sol7", "Do"}))
			y -= blockGap
		}
		y -= 4
		for bi, block := range song.blocks {
			if bi == 1 && si%3 == 0 { // algunos coros marcados (sección {soc})
				if y < yBottom+60 {
					breakPage()
				}
				cur.lines = append(cur.lines, lineFromWords(y, sizeBody, marginX, []string{"CORO"}))
				y -= leading
			}
			for _, ln := range block {
				if y < yBottom+40 {
					breakPage()
				}
				words := strings.Split(ln.lyric, " ")
				cur.lines = append(cur.lines, chordLine(y, sizeBody, marginX, words, ln.chords))
				y -= leading
				cur.lines = append(cur.lines, lineFromWords(y, sizeBody, marginX, words))
				y -= leading
			}
			y -= blockGap - leading
		}
		y -= songGap
	}
	if len(cur.lines) > 0 || len(pages) == 0 {
		pages = append(pages, *cur)
	}
	return pages
}

// ── Escritura del PDF (WinAnsi, Helvetica base-14) ─────────────────────────

var winansiMap = map[rune]byte{
	'á': 0xE1, 'é': 0xE9, 'í': 0xED, 'ó': 0xF3, 'ú': 0xFA, 'ñ': 0xF1,
	'Á': 0xC1, 'É': 0xC9, 'Í': 0xCD, 'Ó': 0xD3, 'Ú': 0xDA, 'Ñ': 0xD1,
	'ü': 0xFC, 'Ü': 0xDC, 'º': 0xBA, 'ª': 0xAA, '¡': 0xA1, '¿': 0xBF,
}

func winansi(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r < 128:
			b.WriteByte(byte(r))
		default:
			if v, ok := winansiMap[r]; ok {
				b.WriteByte(v)
			} else {
				b.WriteByte('?')
			}
		}
	}
	return b.String()
}

func pdfEscape(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `(`, `\(`)
	s = strings.ReplaceAll(s, `)`, `\)`)
	return s
}

// emitText escribe cada palabra como operación Tj independiente con matriz de
// texto propia: pdftotext -bbox devuelve entonces una <word> por palabra con
// su x exacta (los acordes quedan sobre la palabra correspondiente).
func emitText(c *strings.Builder, ln placedLine) {
	for _, w := range ln.words {
		c.WriteString(fmt.Sprintf("BT /F1 %g Tf 1 0 0 1 %g %g Tm (%s) Tj ET\n",
			ln.size, w.x, ln.y, pdfEscape(winansi(w.text))))
	}
}

// buildPDF genera el documento con las páginas dadas (contenido por líneas).
func buildPDF(pages []page) []byte {
	raw := make([]pageWithRawContent, len(pages))
	for i, pg := range pages {
		var c strings.Builder
		for _, ln := range pg.lines {
			emitText(&c, ln)
		}
		raw[i] = pageWithRawContent{content: fmt.Sprintf(
			"<< /Length %d >>\nstream\n%s\nendstream", len(c.String()), c.String())}
	}
	return buildPDFDocument(raw)
}

type pageWithRawContent struct {
	content string
}

// buildPDFDocument escribe el PDF con xref correcto. Los objetos 1 (catálogo),
// 2 (páginas) y 3 (fuente Helvetica) son fijos; cada página i usa los objetos
// 4+2i (página) y 5+2i (contenido).
func buildPDFDocument(pages []pageWithRawContent) []byte {
	var buf strings.Builder
	objOffsets := make([]int, len(pages)*2+4) // 1-based
	w := func(s string) { buf.WriteString(s) }
	markObj := func(n int, content string) {
		objOffsets[n] = buf.Len()
		w(strconv.Itoa(n) + " 0 obj\n" + content + "\nendobj\n")
	}

	numObjs := 3 + len(pages)*2
	kids := make([]string, len(pages))
	for i := range pages {
		kids[i] = strconv.Itoa(4+i*2) + " 0 R"
	}

	w("%PDF-1.4\n")
	markObj(1, "<< /Type /Catalog /Pages 2 0 R >>")
	markObj(2, fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(kids, " "), len(pages)))
	markObj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	for i, p := range pages {
		contentID := 5 + i*2
		markObj(4+i*2, fmt.Sprintf(
			"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %g %g] /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>",
			pageW, pageH, contentID))
		markObj(contentID, p.content)
	}

	startxref := buf.Len()
	w("xref\n0 " + strconv.Itoa(numObjs+1) + "\n")
	w("0000000000 65535 f \n")
	for n := 1; n <= numObjs; n++ {
		w(fmt.Sprintf("%010d 00000 n \n", objOffsets[n]))
	}
	w("trailer\n<< /Size " + strconv.Itoa(numObjs+1) + " /Root 1 0 R >>\nstartxref\n")
	w(strconv.Itoa(startxref) + "\n%%EOF\n")
	return []byte(buf.String())
}

func main() {
	dir := flag.String("dir", "", "carpeta con archivos .cho del himnario")
	n := flag.Int("n", 10, "cantidad de cantos a incluir (los primeros N)")
	kind := flag.String("kind", "demo", "demo | vacio (PDF válido sin capa de texto)")
	out := flag.String("out", "", "ruta del PDF de salida")
	flag.Parse()

	if *out == "" {
		fmt.Fprintln(os.Stderr, "-out es requerido")
		os.Exit(1)
	}

	var data []byte
	switch *kind {
	case "vacio":
		// Página con un rectángulo vectorial: PDF válido, sin capa de texto.
		content := "<< /Length 27 >>\nstream\n0.9 g 100 100 412 592 re f\n\nendstream"
		data = buildPDFDocument([]pageWithRawContent{{content: content}})
	case "demo":
		if *dir == "" {
			fmt.Fprintln(os.Stderr, "-dir es requerido para kind=demo")
			os.Exit(1)
		}
		songs, err := loadSongs(*dir, *n)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		data = buildPDF(layoutSongs(songs))
	default:
		fmt.Fprintln(os.Stderr, "-kind debe ser demo o vacio")
		os.Exit(1)
	}
	if err := os.WriteFile(*out, data, 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("%s: %d bytes\n", *out, len(data))
}

// loadSongs carga los primeros N .cho de la carpeta, ordenados por número.
func loadSongs(dir string, n int) ([]choSong, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	type numbered struct {
		num  int
		path string
	}
	var files []numbered
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".cho") {
			continue
		}
		base := strings.TrimSuffix(e.Name(), ".cho")
		base = strings.SplitN(base, " ", 2)[0]
		if num, err := strconv.Atoi(base); err == nil {
			files = append(files, numbered{num: num, path: filepath.Join(dir, e.Name())})
		}
	}
	sort.Slice(files, func(i, j int) bool { return files[i].num < files[j].num })
	if len(files) > n {
		files = files[:n]
	}
	var songs []choSong
	for _, f := range files {
		data, err := os.ReadFile(f.path)
		if err != nil {
			return nil, err
		}
		songs = append(songs, parseCho(f.num, string(data)))
	}
	return songs, nil
}
