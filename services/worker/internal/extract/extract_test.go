package extract

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"triomision/worker/internal/convert"
)

const sampleBBox = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title></title></head>
<body>
<doc>
  <page width="612.000000" height="792.000000">
    <word xMin="60.000000" yMin="49.076000" xMax="70.008000" yMax="65.726000">1</word>
    <word xMin="75.012000" yMin="78.102000" xMax="85.020000" yMax="88.277000">Sol7</word>
  </page>
  <page width="612.000000" height="792.000000">
    <word xMin="60.000000" yMin="20.000000" xMax="80.000000" yMax="30.175000">Re</word>
  </page>
</doc>
</body>
</html>`

func TestParseBBox(t *testing.T) {
	items, err := parseBBox(strings.NewReader(sampleBBox))
	if err != nil {
		t.Fatalf("parseBBox: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("esperados 3 items, got %d", len(items))
	}
	// El alto de caja de poppler (0.925·s) se convierte en tamaño de fuente.
	if got := items[0].H; got < 17.9 || got > 18.1 {
		t.Errorf("H del item 0: %v (esperado ≈18, tamaño de fuente)", got)
	}
	if got := items[1].H; got < 10.9 || got > 11.1 {
		t.Errorf("H del item 1: %v (esperado ≈11)", got)
	}
	if items[0].Str != "1" || items[0].Page != 1 || items[2].Page != 2 {
		t.Errorf("contenido/página incorrectos: %+v", items)
	}
}

func TestExtractSinTexto(t *testing.T) {
	if _, err := exec.LookPath("pdftotext"); err != nil {
		t.Skip("pdftotext no instalado")
	}
	if _, err := exec.LookPath("go"); err != nil {
		t.Skip("go no disponible")
	}
	// Genera un PDF sin capa de texto con la herramienta de desarrollo.
	dir := t.TempDir()
	vacio := filepath.Join(dir, "vacio.pdf")
	gen := exec.Command("go", "run", "../../cmd/pdfdemo", "-kind", "vacio", "-out", vacio)
	if out, err := gen.CombinedOutput(); err != nil {
		t.Skipf("no se pudo generar el PDF vacío: %v: %s", err, out)
	}
	if _, err := Extract(context.Background(), vacio); !errors.Is(err, ErrSinTexto) {
		t.Fatalf("esperado ErrSinTexto, got %v", err)
	}
}

// TestExtractDemoEndToEnd genera el PDF demo de acordes sobre letra, extrae
// su texto posicionado y lo convierte: la conversión debe detectar canciones
// con título y ChordPro no vacío (misma expectativa del E2E de la API).
func TestExtractDemoEndToEnd(t *testing.T) {
	if _, err := exec.LookPath("pdftotext"); err != nil {
		t.Skip("pdftotext no instalado")
	}
	choDir := filepath.Join("..", "..", "..", "..", "content", "himnario", "acordes-completos")
	if _, err := os.Stat(choDir); err != nil {
		t.Skip("content/himnario/acordes-completos no disponible")
	}
	dir := t.TempDir()
	demo := filepath.Join(dir, "demo.pdf")
	gen := exec.Command("go", "run", "../../cmd/pdfdemo", "-dir", choDir, "-n", "10", "-out", demo)
	if out, err := gen.CombinedOutput(); err != nil {
		t.Fatalf("generar demo: %v: %s", err, out)
	}

	items, err := Extract(context.Background(), demo)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	songs := convert.SongsFromLines(convert.ItemsToLines(items))
	if len(songs) < 5 {
		t.Fatalf("esperadas ≥5 canciones del demo de 10, got %d", len(songs))
	}
	var okCount, withChords int
	for _, s := range songs {
		if s.Titulo != "" && s.Titulo != "Sin título" {
			okCount++
		}
		if strings.Contains(s.ChordPro, "[") {
			withChords++
		}
	}
	if okCount < 5 || withChords < 5 {
		t.Fatalf("detección insuficiente: %d con título, %d con acordes", okCount, withChords)
	}
	t.Logf("%d canciones; primera: %q (%s)", len(songs), songs[0].Titulo, songs[0].Status)
}
