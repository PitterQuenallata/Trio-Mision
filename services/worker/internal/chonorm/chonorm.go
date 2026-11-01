// Package chonorm normaliza los .cho del himnario al formato guitarra:
// los acordes viven solo en la primera estrofa y en los coros; las estrofas
// 2+ quedan solo con letra (el guitarrista repite la armonía de la primera).
// 100% determinista: sin azar, sin IA. Ver CURRENT_TASK.md, Sprint 4B.5.
//
// Convención de bloques soportada (las dos sintaxis presentes en
// content/himnario): {sov}…{eov} y {verse N} para estrofas; {soc}(…){eoc} y
// {chorus} para coros. Un bloque termina con su cierre explícito o con la
// apertura de otro bloque. Las líneas fuera de bloques (directivas, intros
// de solo acordes, líneas en blanco) se conservan byte a byte; solo se
// reescriben las líneas de estrofas 2+ que tenían acordes.
package chonorm

import (
	"fmt"
	"regexp"
	"strings"
)

// FileReport resume la normalización de un archivo.
type FileReport struct {
	Path           string
	Changed        bool
	VersesStripped int // estrofas 2+ despojadas de acordes
	ChordsRemoved  int // tokens [acorde] eliminados
	Anomalies      []string
}

// chordTokenRe reconoce un token de acorde ChordPro ([D], [C#º], [A7], [Bb/D]…).
// Exige empezar por A-G para no tocar corchetes literales de la letra.
var chordTokenRe = regexp.MustCompile(`\[[A-G][^\]\[]*\]`)

var (
	multiSpaceRe      = regexp.MustCompile(`[ \t]{2,}`)
	spaceBeforePunct  = regexp.MustCompile(` +([,.;:!?])`)
	directiveRe       = regexp.MustCompile(`^\s*\{([A-Za-z]+)[^}]*\}\s*$`)
	chorusDirectiveRe = regexp.MustCompile(`^(soc|chorus)$`)
	verseDirectiveRe  = regexp.MustCompile(`^(sov|verse)$`)
)

type blockKind int

const (
	blockNone blockKind = iota
	blockVerse
	blockChorus
)

// Normalize devuelve el contenido normalizado y su reporte. Si el archivo ya
// está normalizado (o no tiene nada que despojar), el contenido devuelto es
// idéntico al original y Changed es false (idempotencia).
func Normalize(path, content string) (string, FileReport) {
	rep := FileReport{Path: path}
	lines := strings.Split(content, "\n")

	kind := blockNone
	verseIdx := 0
	verseHasChords := false
	verseStartLine := 0
	chorusHasChords := false
	chorusStartLine := 0
	// El estilo {verse N}/{chorus} no usa cierres explícitos: un bloque
	// "sin cerrar" al final del archivo solo es anomalía si el archivo sí
	// usa {eov}/{eoc}.
	hasClosers := strings.Contains(content, "{eov}") || strings.Contains(content, "{eoc}")

	closeBlock := func() {
		switch kind {
		case blockVerse:
			// Las estrofas 2+ sin acordes son el formato guitarra, no una
			// anomalía; solo la primera estrofa debe tenerlos.
			if verseIdx == 1 && !verseHasChords {
				rep.Anomalies = append(rep.Anomalies,
					fmt.Sprintf("primera estrofa sin acordes (línea %d)", verseStartLine))
			}
		case blockChorus:
			if !chorusHasChords {
				rep.Anomalies = append(rep.Anomalies,
					fmt.Sprintf("coro sin acordes (línea %d)", chorusStartLine))
			}
		}
		kind = blockNone
	}

	for i, line := range lines {
		if m := directiveRe.FindStringSubmatch(line); m != nil {
			name := strings.ToLower(m[1])
			switch {
			case verseDirectiveRe.MatchString(name):
				closeBlock()
				kind = blockVerse
				verseIdx++
				verseHasChords = false
				verseStartLine = i + 1
			case chorusDirectiveRe.MatchString(name):
				closeBlock()
				kind = blockChorus
				chorusHasChords = false
				chorusStartLine = i + 1
			case name == "eov" || name == "eoc":
				if (name == "eov" && kind != blockVerse) || (name == "eoc" && kind != blockChorus) {
					rep.Anomalies = append(rep.Anomalies,
						fmt.Sprintf("cierre {%s} sin bloque abierto (línea %d)", name, i+1))
				}
				closeBlock()
			}
			// El resto de directivas (title, key, comment…) no alteran el bloque.
			continue
		}

		if kind == blockVerse && chordTokenRe.MatchString(line) {
			verseHasChords = true
			if verseIdx >= 2 {
				stripped, removed := StripChords(line)
				if removed > 0 {
					lines[i] = stripped
					rep.ChordsRemoved += removed
				}
			}
		}
		if kind == blockChorus && chordTokenRe.MatchString(line) {
			chorusHasChords = true
		}
	}
	if hasClosers && kind != blockNone {
		que := "estrofa"
		if kind == blockChorus {
			que = "coro"
		}
		rep.Anomalies = append(rep.Anomalies, que+" sin cerrar al final del archivo")
	}
	closeBlock()

	if rep.ChordsRemoved > 0 {
		rep.Changed = true
		rep.VersesStripped = countStrippedVerses(content)
		return strings.Join(lines, "\n"), rep
	}
	return content, rep
}

// countStrippedVerses cuenta las estrofas 2+ del archivo original (las que la
// normalización despoja); solo se reporta cuando hubo cambios.
func countStrippedVerses(content string) int {
	verses := 0
	for _, line := range strings.Split(content, "\n") {
		if m := directiveRe.FindStringSubmatch(line); m != nil {
			if verseDirectiveRe.MatchString(strings.ToLower(m[1])) {
				verses++
			}
		}
	}
	if verses > 0 {
		return verses - 1
	}
	return 0
}

// StripChords elimina los tokens [acorde] de una línea y limpia el espaciado
// resultante: colapsa espacios múltiples, quita el espacio antes de
// puntuación y recorta extremos. Devuelve la línea limpia y cuántos tokens
// eliminó.
func StripChords(line string) (string, int) {
	removed := len(chordTokenRe.FindAllString(line, -1))
	if removed == 0 {
		return line, 0
	}
	s := chordTokenRe.ReplaceAllString(line, "")
	s = multiSpaceRe.ReplaceAllString(s, " ")
	s = spaceBeforePunct.ReplaceAllString(s, "$1")
	s = strings.TrimSpace(s)
	return s, removed
}
