package chonorm

import (
	"strings"
	"testing"
)

func TestNormalizeSovBasic(t *testing.T) {
	in := `{title: 01 Cantad}
{key: D}

{sov}
[D]Cantad alegres[C#º] al[D] Se[E]ñor[A],
[D]mortales[G] to[D]dos[Em] por[D] doquier[A];
{eov}

{sov}
[D]Con gratitud can[C#º]ción[D] al[E]zad[A]
[D]al Hace[G]dor[D] que el[Em] ser[D] os dio[A];
{eov}
`
	want := `{title: 01 Cantad}
{key: D}

{sov}
[D]Cantad alegres[C#º] al[D] Se[E]ñor[A],
[D]mortales[G] to[D]dos[Em] por[D] doquier[A];
{eov}

{sov}
Con gratitud canción alzad
al Hacedor que el ser os dio;
{eov}
`
	got, rep := Normalize("01.cho", in)
	if got != want {
		t.Errorf("contenido:\n---got---\n%s\n---want---\n%s", got, want)
	}
	if !rep.Changed || rep.ChordsRemoved != 11 || rep.VersesStripped != 1 {
		t.Errorf("reporte: %+v", rep)
	}
	if len(rep.Anomalies) != 0 {
		t.Errorf("anomalías inesperadas: %v", rep.Anomalies)
	}
}

func TestNormalizeChorusKeepsChords(t *testing.T) {
	in := `{sov}
[D]estrofa uno[A]
{eov}

{soc}
[G]coro con[D] acordes
{eoc}

{sov}
[D]estrofa[G] dos
{eov}
`
	got, _ := Normalize("x.cho", in)
	if !strings.Contains(got, "[G]coro con[D] acordes") {
		t.Errorf("el coro perdió sus acordes:\n%s", got)
	}
	if strings.Contains(got, "[D]estrofa[G] dos") {
		t.Errorf("la estrofa 2 conservó acordes:\n%s", got)
	}
	if !strings.Contains(got, "estrofa dos") {
		t.Errorf("la estrofa 2 perdió la letra:\n%s", got)
	}
}

func TestNormalizeVerseChorusDirectives(t *testing.T) {
	in := `{verse 1}
[D]Cuando venga[G] Jesucristo
{chorus}
[D]Como estrellas que [G]brillan
{verse 2}
[D]Quiere Cristo[G] en su corona
{verse 3}
[A7]Él escoge[D] por tesoros
`
	got, rep := Normalize("600.cho", in)
	if !strings.Contains(got, "[D]Cuando venga[G] Jesucristo") {
		t.Errorf("verse 1 perdió acordes:\n%s", got)
	}
	if !strings.Contains(got, "[D]Como estrellas que [G]brillan") {
		t.Errorf("chorus perdió acordes:\n%s", got)
	}
	if strings.Contains(got, "[D]Quiere") || strings.Contains(got, "[A7]Él") {
		t.Errorf("verses 2/3 conservaron acordes:\n%s", got)
	}
	if rep.ChordsRemoved != 4 {
		t.Errorf("acordes eliminados: %d (esperados 4)", rep.ChordsRemoved)
	}
}

func TestNormalizeGluedChordsAndPunctuation(t *testing.T) {
	line := "[G][D]todo niño redimido[A] ,"
	got, n := StripChords(line)
	if n != 3 || got != "todo niño redimido," {
		t.Errorf("got %q (%d tokens)", got, n)
	}
	line2 := "o[D]be[A]de[D]ced[Em]le[D]   con[A] placer[D]."
	got2, _ := StripChords(line2)
	if got2 != "obedecedle con placer." {
		t.Errorf("got %q", got2)
	}
}

func TestNormalizeIdempotent(t *testing.T) {
	in := `{sov}
[D]primera[A]
{eov}

{sov}
segunda sin acordes
{eov}
`
	got, rep := Normalize("ya.cho", in)
	if got != in || rep.Changed {
		t.Errorf("archivo ya normalizado fue modificado (changed=%v)", rep.Changed)
	}
	// Y la salida de una normalización no cambia en una segunda pasada.
	in2 := "{sov}\n[D]uno[A]\n{eov}\n\n{sov}\n[D]dos[G]\n{eov}\n"
	once, _ := Normalize("a.cho", in2)
	twice, rep2 := Normalize("a.cho", once)
	if once != twice || rep2.Changed {
		t.Errorf("segunda pasada no idempotente")
	}
}

func TestNormalizeChordOnlyLinesOutsideBlocksPreserved(t *testing.T) {
	in := `[D] [A] [G]

{sov}
[D]primera[A]
{eov}

{sov}
[D]segunda[A]
{eov}
`
	got, _ := Normalize("intro.cho", in)
	if !strings.Contains(got, "[D] [A] [G]") {
		t.Errorf("la línea de intro de solo acordes se tocó:\n%s", got)
	}
}

func TestNormalizeAnomalies(t *testing.T) {
	in := `{sov}
primera sin acordes
{eov}

{soc}
coro sin acordes
{eoc}
`
	_, rep := Normalize("raro.cho", in)
	if len(rep.Anomalies) != 2 {
		t.Fatalf("esperadas 2 anomalías, got %v", rep.Anomalies)
	}
	if !strings.Contains(rep.Anomalies[0], "primera estrofa sin acordes") ||
		!strings.Contains(rep.Anomalies[1], "coro sin acordes") {
		t.Errorf("anomalías: %v", rep.Anomalies)
	}
}

func TestStripChordsKeepsLiteralBrackets(t *testing.T) {
	line := "[D]canta [n.] con ganas"
	got, n := StripChords(line)
	if n != 1 || got != "canta [n.] con ganas" {
		t.Errorf("got %q (%d)", got, n)
	}
}
