# Himnario — Contenido

Archivos de acordes del Himnario Adventista en formato ChordPro (`.cho`).

- `acordes-completos/` — 614 archivos `.cho` (versión con acordes completos).
- `fiel-pdf/` — 614 archivos `.cho` (transcripción fiel al PDF impreso).
- `source/` — material fuente original: `fotos/` (166 PNG) y el PDF `Acordes_para_el_himnario_adventista_2020_3.pdf`.

**Importante:** `source/` está ignorado por git por su tamaño (~564 MB) y **no se versiona**. Para re-obtenerlo, copiar desde el repositorio local `scrip-orc-himanrio-convert`:

```bash
cp -R "../scrip-orc-himanrio-convert/himnario adventista/fotos" content/himnario/source/fotos
cp "../scrip-orc-himanrio-convert/himnario adventista/Acordes_para_el_himnario_adventista_2020_3.pdf" content/himnario/source/
```
