// Package extract obtiene items de texto posicionado (x/y por palabra) de un
// PDF vía `pdftotext -bbox` (poppler): la alineación acorde-sobre-letra de la
// conversión la exige. Prerequisito: el binario pdftotext en el PATH
// (`brew install poppler`); CheckTool falla con un error claro si falta.
// Un PDF sin capa de texto (escaneado) se reporta como ErrSinTexto
// (error_code sin_texto_extraible en el job); OCR queda fuera del alcance.
package extract

import (
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"triomision/worker/internal/convert"
)

// ErrToolMissing indica que pdftotext no está en el PATH.
var ErrToolMissing = errors.New("no se encuentra el binario pdftotext (poppler)")

// ErrSinTexto indica que el PDF no tiene capa de texto extraíble
// (PDF escaneado; OCR no soportado, igual que la herramienta legacy).
var ErrSinTexto = errors.New("el PDF no tiene capa de texto extraíble (escaneado); OCR no soportado")

// minChars es el mínimo de caracteres extraídos para considerar que el PDF
// tiene capa de texto (igual que la especificación legacy).
const minChars = 40

// CheckTool verifica que pdftotext esté disponible.
func CheckTool() error {
	if _, err := exec.LookPath("pdftotext"); err != nil {
		return fmt.Errorf("%w: instala poppler (brew install poppler)", ErrToolMissing)
	}
	return nil
}

// Extract ejecuta pdftotext -bbox sobre pdfPath y devuelve los items de texto
// posicionados (una palabra por item, en orden de documento).
func Extract(ctx context.Context, pdfPath string) ([]convert.RawTextItem, error) {
	outPath := pdfPath + ".bbox.html"
	defer os.Remove(outPath)

	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, "pdftotext", "-bbox", pdfPath, outPath)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("pdftotext falló (%s); el archivo no es un PDF válido o está dañado", msg)
	}

	f, err := os.Open(outPath)
	if err != nil {
		return nil, fmt.Errorf("leer salida de pdftotext: %w", err)
	}
	defer f.Close()

	items, err := parseBBox(f)
	if err != nil {
		return nil, err
	}
	var chars int
	for _, it := range items {
		chars += len(strings.TrimSpace(it.Str))
	}
	if chars < minChars {
		return nil, ErrSinTexto
	}
	return items, nil
}

// bboxWord es un elemento <word> de la salida XHTML de pdftotext -bbox.
// El documento se decodifica en streaming (tokens), no con un struct raíz:
// encoding/xml no admite rutas con ">" y los PDF editoriales pueden producir
// HTML de decenas de MB.
type bboxWord struct {
	XMin float64 `xml:"xMin,attr"`
	YMin float64 `xml:"yMin,attr"`
	XMax float64 `xml:"xMax,attr"`
	YMax float64 `xml:"yMax,attr"`
	Text string  `xml:",chardata"`
}

// parseBBox convierte la salida XHTML de pdftotext -bbox en items
// posicionados (una palabra por item, en orden de documento).
func parseBBox(r io.Reader) ([]convert.RawTextItem, error) {
	dec := xml.NewDecoder(r)
	var items []convert.RawTextItem
	page := 0
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("parsear salida de pdftotext: %w", err)
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		switch se.Name.Local {
		case "page":
			page++
		case "word":
			var w bboxWord
			if err := dec.DecodeElement(&w, &se); err != nil {
				return nil, fmt.Errorf("parsear palabra de pdftotext: %w", err)
			}
			// Convención de poppler: la caja de cada palabra va de
			// (baseline − 0.207·s) a (baseline + 0.718·s) con s = tamaño de
			// fuente (ascent/descent a nivel de fuente, no de glifo). Así el
			// alto de la caja es exactamente 0.925·s y se recupera el tamaño
			// real de fuente — lo que el algoritmo (afinado con pdf.js, cuyo
			// item.height ES el tamaño de fuente) necesita. El resto de fuentes
			// desplazan todas las estimaciones de un mismo factor, y el cuerpo
			// modal se calcula por página: las razones se preservan.
			// Además el eje Y de -bbox tiene origen arriba-izquierda (crece
			// hacia abajo), contrario al PDF y a pdf.js: se niega para que el
			// orden de lectura y los gaps coincidan con la especificación.
			fontSize := (w.YMax - w.YMin) / 0.925
			items = append(items, convert.RawTextItem{
				X: w.XMin, Y: -w.YMin,
				H: fontSize, W: w.XMax - w.XMin,
				Str: w.Text, Page: page,
			})
		}
	}
	return items, nil
}
