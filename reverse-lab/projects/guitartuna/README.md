# GuitarTuna — Análisis de referencia

## Ficha del análisis

- **Nombre de la app:** GuitarTuna
- **Versión:** 7.79.0
- **Fuente:** APK local (`reference/`, 78 MB). ⚠️ **Pendiente de validar:** el nombre del archivo sugiere una build modificada ("Premiumm"). Antes de analizar, reemplazar por el APK oficial obtenido de una fuente autorizada (Google Play / sitio del desarrollador, Yousician). Ver nota abajo.
- **Objetivo del análisis:** estudiar el comportamiento de un afinador/analizador musical de referencia (flujos de usuario, entradas/salidas de audio, presentación de afinación y detección de notas) para inspirar implementaciones propias en Trio Misión.
- **Fecha:** 2026-10-22
- **Hashes de referencia (SHA-256):**
  - `9205f28bdf948ab52fcb2beb76a12ea35d87fdc58036097dfa906c4a5d5b32f2` — `GuitarTuna v7.79.0 (Premiumm).apk`

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

Solo análisis autorizado. Prohibido robar credenciales, extraer secretos, eludir pagos o acceder a datos privados. Ver `reverse-lab/README.md`. En particular: aunque el APK actual sea una build "Premium", **no** se analizará el mecanismo de desbloqueo de pagos; si el objetivo es estudiar el afinador, se hará sobre una build oficial.
