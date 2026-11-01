# Himnario — Contenido

Archivos de acordes del Himnario Adventista en formato ChordPro (`.cho`).

- `acordes-completos/` — 614 archivos `.cho` (versión con acordes completos:
  todos los cambios de acorde, incluidos los de paso).
- `fiel-pdf/` — 614 archivos `.cho` (transcripción fiel al PDF impreso, con
  guiones de sílabas).
- `source/` — material fuente original: `fotos/` (166 PNG) y el PDF `Acordes_para_el_himnario_adventista_2020_3.pdf`.

## Convención de formato guitarra (Sprint 4B.5)

En **ambas** versiones los acordes viven solo en la **primera estrofa** y en
los **coros** (`{soc}…{eoc}` / `{chorus}`); las estrofas 2+ van solo con
letra — el guitarrista repite la armonía de la primera estrofa. Las dos
versiones se distinguen por la densidad de acordes y la silabeo, no por la
posición de los acordes. Se reconocen las dos sintaxis de bloques presentes:
`{sov}…{eov}` y `{verse N}` (estrofas), `{soc}` y `{chorus}` (coros).

La normalización se hace con la herramienta determinista `chonorm`
(`services/worker/cmd/chonorm`, tests en `internal/chonorm`):

```bash
make himnario-normalize              # dry-run con reporte
make himnario-normalize WRITE=1      # aplica (idempotente)
```

El seed (`make db-seed`) carga `acordes-completos/` como versión
`chords_full`/`full_song` y `fiel-pdf/` como `verse_chorus`/`verse_chorus`.

**Importante:** `source/` está ignorado por git por su tamaño (~564 MB) y **no se versiona**. Para re-obtenerlo, copiar desde el repositorio local `scrip-orc-himanrio-convert`:

```bash
cp -R "../scrip-orc-himanrio-convert/himnario adventista/fotos" content/himnario/source/fotos
cp "../scrip-orc-himanrio-convert/himnario adventista/Acordes_para_el_himnario_adventista_2020_3.pdf" content/himnario/source/
```
