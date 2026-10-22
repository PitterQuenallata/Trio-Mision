# ADR 0001: Monorepo único para el ecosistema Trio Misión

- **Fecha:** 2026-10-22
- **Estado:** Aceptada

## Contexto

El ecosistema Trio Misión (web pública, futura app móvil, panel de administración, API, worker y contenido del himnario) vivía disperso en varios repositorios. Se necesita desarrollo coordinado entre componentes que comparten dominio (himnario, autenticación, contenido del grupo).

## Decisión

1. **Monorepo único** (`trio-mision/`) que agrupa apps, servicios, contenido, infraestructura y documentación.
2. **Historial de la web conservado**: `apps/web` se migró desde `trio-mision-page-web` con `git subtree add`, preservando todos los commits anteriores.
3. **Himnario**: los 1228 archivos `.cho` (texto) se versionan en `content/himnario/`; las fotos escaneadas (445 MB) y el PDF fuente (119 MB) quedan **fuera de git** (`content/himnario/source/`, ignorado) por tamaño; se documenta cómo re-obtenerlos.
4. **`.reference/` excluido**: el clon de terceros presente en el repo web original no se migra.
5. **Repositorios antiguos**: `trio-mision-page-web` y `scrip-orc-himanrio-convert` serán archivados en GitHub una vez validada la migración; no se borran localmente.

## Consecuencias

- Un solo clon para trabajar en todo el ecosistema; CI y tooling se centralizan en `.github/`, `Makefile` y `scripts/`.
- El historial completo de la web sigue disponible en el log del monorepo.
- Clones nuevos no incluyen los ~564 MB del material fuente del himnario; quien lo necesite lo copia manualmente (procedimiento documentado en `content/himnario/README.md`).
