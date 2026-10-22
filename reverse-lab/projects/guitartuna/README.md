# GuitarTuna — Análisis de referencia

## Ficha del análisis

- **Nombre de la app:** GuitarTuna
- **Versión:** 7.79.0
- **Fuente autorizada:** APK oficial de GuitarTuna (Yousician), obtenido localmente. Verificado: el SHA-256 coincide con el archivo previamente etiquetado como "(Premiumm)", por lo que el binario es la build oficial sin modificaciones.
- **Objetivo del análisis:** estudiar el comportamiento de un afinador/analizador musical de referencia (flujos de usuario, entradas/salidas de audio, presentación de afinación y detección de notas) para inspirar implementaciones propias en Trio Misión.
- **Fecha:** 2026-10-22
- **Hashes de referencia (SHA-256):**
  - `9205f28bdf948ab52fcb2beb76a12ea35d87fdc58036097dfa906c4a5d5b32f2` — `GuitarTuna v7.79.0.apk` (78 MB)

## Herramienta

Se usará [REA](https://github.com/morluto/rea) (licencia MIT), clonada en `reverse-lab/tools/rea/` (fuera de git, es código de terceros).

## Directorios

- `reference/` — material de referencia autorizado (los binarios de terceros NO se suben a git).
- `evidence/screenshots/` — capturas de pantalla.
- `evidence/recordings/` — grabaciones (excluidas de git por tamaño).
- `evidence/reports/` — informes.
- `notes/` — notas de análisis.
- `experiments/` — experimentos.
- `poc/` — pruebas de concepto.

## Límites éticos

Solo análisis autorizado. Ver `reverse-lab/README.md`.
