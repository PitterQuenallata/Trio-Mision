# ADR 0002 — Stack de la API en Go

- **Fecha:** 2026-10-26
- **Estado:** Aceptada

## Contexto

La Fase 1 del plan general construye el esqueleto de la API central
(`services/api/`), un monolito modular en Go según la arquitectura v2. Había que
elegir router, estrategia de documentación OpenAPI, driver de PostgreSQL y
validación de tokens GoTrue.

## Decisión

- **Router:** [chi](https://github.com/go-chi/chi) v5 — liviano, idiomático,
  compone con `net/http` y sus middlewares estándar.
- **OpenAPI/Swagger:** [Huma](https://github.com/danielgtaylor/huma) v2 — los
  handlers tipados generan el spec automáticamente; la documentación no puede
  desactualizarse del código. Swagger UI en `/docs`, spec en `/openapi.json`.
- **PostgreSQL:** [pgx](https://github.com/jackc/pgx) v5 con `pgxpool`.
- **JWT (GoTrue):** [golang-jwt](https://github.com/golang-jwt/jwt) v5,
  validación HS256 + audiencia (`authenticated` por defecto).
- **Config:** variables de entorno, sin librería adicional; los secretos viven
  en el `.env` de la raíz (cargado por el Makefile, no por la app).
- **Logs:** `log/slog` con handler JSON.

## Alternativas consideradas

| Opción | Por qué se descartó |
|---|---|
| Gin | Contexto propio fuera de `net/http`, más acoplamiento al framework |
| net/http stdlib puro (Go 1.22+) | Válido, pero más código manual de routing/middleware sin ganancia real |
| swaggo/swag | El spec se genera de comentarios: se desactualiza con facilidad |
| oapi-codegen (spec-first) | Contrato como fuente de verdad, atractivo; se eligió Huma por menor fricción inicial. Re-evaluable si el spec necesita ser artefacto contractual |
| **mcp-go** (mark3labs) | **No aplica**: es un SDK para servidores MCP (herramientas para LLMs), no para APIs REST. Qeda como opción futura para exponer tools a agentes (p. ej. consulta del himnario), encima de la API, no en lugar de ella |

## Consecuencias

- Todo endpoint se define con tipos de entrada/salida; validación y OpenAPI
  salen del mismo código.
- La seguridad se declara por operación (`Security: bearer`); el middleware de
  auth solo actúa en operaciones protegidas.
- Graphify (grafo de contexto del repo) queda **pospuesto** hasta que exista
  suficiente código Go para que aporte valor; no es dependencia del producto.
