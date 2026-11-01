// chonorm normaliza los .cho del himnario al formato guitarra (acordes solo
// en la primera estrofa y en los coros; ver Sprint 4B.5 en CURRENT_TASK.md).
//
//	chonorm [-write] <dir> [dir...]
//
// Sin -write es un dry-run: imprime el reporte completo sin tocar nada.
// Con -write reescribe solo los archivos con cambios (idempotente: una
// segunda corrida reporta 0 cambios). Las anomalías (estrofa 1 o coro sin
// acordes, bloques desbalanceados) se reportan sin detener la corrida.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"triomision/worker/internal/chonorm"
)

func main() {
	write := flag.Bool("write", false, "aplica los cambios (por defecto es dry-run)")
	flag.Parse()
	dirs := flag.Args()
	if len(dirs) == 0 {
		fmt.Fprintln(os.Stderr, "uso: chonorm [-write] <dir> [dir...]")
		os.Exit(2)
	}

	var files []string
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "leer %s: %v\n", dir, err)
			os.Exit(1)
		}
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".cho") {
				files = append(files, filepath.Join(dir, e.Name()))
			}
		}
	}
	sort.Strings(files)

	totalChanged, totalChords, totalAnomalies := 0, 0, 0
	for _, path := range files {
		data, err := os.ReadFile(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "leer %s: %v\n", path, err)
			os.Exit(1)
		}
		normalized, rep := chonorm.Normalize(path, string(data))
		if rep.Changed {
			totalChanged++
			totalChords += rep.ChordsRemoved
			fmt.Printf("%s: %d acordes eliminados de estrofas 2+\n", path, rep.ChordsRemoved)
			if *write {
				if err := os.WriteFile(path, []byte(normalized), 0o644); err != nil {
					fmt.Fprintf(os.Stderr, "escribir %s: %v\n", path, err)
					os.Exit(1)
				}
			}
		}
		for _, a := range rep.Anomalies {
			totalAnomalies++
			fmt.Printf("  anomalía %s: %s\n", path, a)
		}
	}

	modo := "dry-run (sin cambios escritos)"
	if *write {
		modo = "write (aplicado)"
	}
	fmt.Printf("\n%s: %d archivos .cho, %d con cambios, %d acordes eliminados, %d anomalías\n",
		modo, len(files), totalChanged, totalChords, totalAnomalies)
}
