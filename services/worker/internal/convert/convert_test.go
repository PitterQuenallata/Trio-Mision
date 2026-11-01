package convert

import (
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestConvertChordTokenLatin(t *testing.T) {
	cases := []struct {
		in   string
		want *string
	}{
		{"DOM", ptr("C")},
		{"Sol7", ptr("G7")},
		{"lam", ptr("Am")},
		{"DoM", ptr("C")},
		{"Fa#m7", ptr("F#m7")},
		{"Sol/Si", ptr("G/B")},
		{"Re/Fa#", ptr("D/F#")},
		{"la", nil},         // palabra, no acorde
		{"mi", nil},         // palabra, no acorde
		{"sol", nil},        // palabra, no acorde
		{"do", nil},         // palabra, no acorde
		{"casa", nil},       // no es token latino ni anglosajón
		{"C", ptr("C")},     // anglosajón sin bajo (ENGLISH_RE con bajo opcional, como el spec)
		{"F#m", ptr("F#m")}, // idem con accidental y calidad
		{"G7", ptr("G7")},   // idem con séptima
		{"G/B", ptr("G/B")}, // con bajo
		{"////", nil},       // filler, no lo decide esta función
	}
	for _, c := range cases {
		got := ConvertChordToken(c.in)
		if c.want == nil {
			if got != nil {
				t.Errorf("%q: esperado nil, got %q", c.in, *got)
			}
			continue
		}
		if got == nil || *got != *c.want {
			t.Errorf("%q: esperado %q, got %v", c.in, *c.want, got)
		}
	}
}

func item(x, y, h, w float64, str string, page int) RawTextItem {
	return RawTextItem{X: x, Y: y, H: h, W: w, Str: str, Page: page}
}

func TestItemsToLinesClustersByY(t *testing.T) {
	items := []RawTextItem{
		item(100, 700, 11, 20, "al", 1),
		item(10, 700.5, 11, 40, "Cantad", 1), // misma línea (tolerancia 2.5)
		item(10, 680, 11, 10, "Sol7", 1),     // otra línea
		item(10, 500, 11, 10, "Re", 2),       // otra página
	}
	lines := ItemsToLines(items)
	if len(lines) != 3 {
		t.Fatalf("esperadas 3 líneas, got %d", len(lines))
	}
	if len(lines[0].Tokens) != 2 || lines[0].Tokens[0].Str != "Cantad" || lines[0].Tokens[1].Str != "al" {
		t.Fatalf("tokens de la primera línea mal ordenados: %+v", lines[0].Tokens)
	}
	if lines[1].Tokens[0].Str != "Sol7" || lines[2].Page != 2 {
		t.Fatalf("líneas 2/3 incorrectas: %+v", lines)
	}
}

func TestItemsToLinesSplitsWordsByWidth(t *testing.T) {
	// Un item de 44u de ancho, 7 caracteres: charW = 44/7 por carácter.
	items := []RawTextItem{item(100, 700, 11, 44, "Sol7 Re", 1)}
	lines := ItemsToLines(items)
	if len(lines) != 1 || len(lines[0].Tokens) != 2 {
		t.Fatalf("esperados 2 tokens, got %+v", lines)
	}
	charW := 44.0 / 7
	if lines[0].Tokens[0].X != 100 {
		t.Fatalf("x del primer token: %v", lines[0].Tokens[0].X)
	}
	if got := lines[0].Tokens[1].X; got < 100+5*charW-0.01 || got > 100+5*charW+0.01 {
		t.Fatalf("x del segundo token: %v (esperado %v)", got, 100+5*charW)
	}
}

// cancionDePrueba construye una página con dos canciones: la primera con
// número, título partido, autor, capo, coro y un acorde huérfano; la segunda
// mínima. Debe producir exactamente los metadatos e issues esperados.
func cancionDePrueba() []PdfLine {
	l := func(y float64, size float64, words ...PdfToken) PdfLine {
		return PdfLine{Y: y, Page: 1, FontSize: size, Tokens: words}
	}
	tok := func(x float64, s string) PdfToken { return PdfToken{X: x, Str: s, CharW: 6} }
	return []PdfLine{
		l(760, 18, tok(60, "1"), tok(80, "Dios"), tok(120, "es")),      // cabecera con número
		l(744, 18, tok(60, "bueno")),                                   // continuación de título
		l(720, 11, tok(60, "Autor:"), tok(110, "Juan")),                // autor
		l(700, 11, tok(60, "Capo"), tok(90, "3")),                      // capo
		l(680, 11, tok(60, "Sol7"), tok(90, "Do")),                     // intro huérfano (gap grande a la siguiente)
		l(640, 11, tok(60, "Sol7"), tok(90, "Re")),                     // acordes
		l(625, 11, tok(60, "Al"), tok(80, "gran")),                     // letra
		l(595, 11, tok(60, "CORO")),                                    // marcador de sección
		l(580, 11, tok(60, "Sol7"), tok(90, "Re")),                     // acordes del coro
		l(565, 11, tok(60, "Al"), tok(80, "coro")),                     // letra del coro
		l(500, 18, tok(60, "2"), tok(80, "Otra"), tok(130, "canción")), // segunda canción
		l(480, 11, tok(60, "Do"), tok(90, "Re")),                       // acordes
		l(465, 11, tok(60, "Canta"), tok(100, "ya")),                   // letra
	}
}

func TestSongsFromLines(t *testing.T) {
	songs := SongsFromLines(cancionDePrueba())
	if len(songs) != 2 {
		t.Fatalf("esperadas 2 canciones, got %d: %+v", len(songs), songs)
	}
	s0 := songs[0]
	if s0.Titulo != "Dios es bueno" {
		t.Errorf("título: %q", s0.Titulo)
	}
	if s0.Numero == nil || *s0.Numero != 1 {
		t.Errorf("número: %v", s0.Numero)
	}
	if s0.Tono == nil || *s0.Tono != "G7" {
		t.Errorf("tono: %v (es el primer acorde, el del intro)", s0.Tono)
	}
	if s0.Capo == nil || *s0.Capo != 3 {
		t.Errorf("capo: %v", s0.Capo)
	}
	if s0.Autor == nil || *s0.Autor != "Juan" {
		t.Errorf("autor: %v", s0.Autor)
	}
	if s0.Status != "revisar" {
		t.Errorf("status: %q (esperaba revisar por el intro huérfano)", s0.Status)
	}
	var hasOrphan bool
	for _, is := range s0.Issues {
		if strings.HasPrefix(is, "Acordes sin letra") {
			hasOrphan = true
		}
	}
	if !hasOrphan {
		t.Errorf("issues sin acordes huérfanos: %v", s0.Issues)
	}
	for _, want := range []string{"{title: Dios es bueno}", "{number: 1}", "{key: G7}", "{capo: 3}", "{author: Juan}", "{soc: Coro}", "{eoc}", "[G7]Al"} {
		if !strings.Contains(s0.ChordPro, want) {
			t.Errorf("chordpro sin %q:\n%s", want, s0.ChordPro)
		}
	}

	s1 := songs[1]
	if s1.Titulo != "Otra canción" || s1.Status != "ok" || len(s1.Issues) != 0 {
		t.Errorf("segunda canción: %+v", s1)
	}
}

func TestSongsFromLinesDeterminista(t *testing.T) {
	a := SongsFromLines(cancionDePrueba())
	b := SongsFromLines(cancionDePrueba())
	if len(a) != len(b) {
		t.Fatalf("resultados de longitud distinta")
	}
	for i := range a {
		if a[i].ChordPro != b[i].ChordPro || a[i].Titulo != b[i].Titulo || len(a[i].Issues) != len(b[i].Issues) {
			t.Fatalf("canción %d no determinista", i)
		}
	}
}

func TestSongsFromLinesDescartaRestosVacios(t *testing.T) {
	// Contenido sin acordes y con menos de 3 líneas de letra: se descarta.
	l := func(y float64, size float64, words ...PdfToken) PdfLine {
		return PdfLine{Y: y, Page: 1, FontSize: size, Tokens: words}
	}
	tok := func(x float64, s string) PdfToken { return PdfToken{X: x, Str: s, CharW: 6} }
	lines := []PdfLine{
		l(700, 18, tok(60, "Índice")),
		l(680, 11, tok(60, "de")),
		l(665, 11, tok(60, "contenido")),
	}
	if songs := SongsFromLines(lines); len(songs) != 0 {
		t.Fatalf("esperado 0 songs, got %+v", songs)
	}
}
