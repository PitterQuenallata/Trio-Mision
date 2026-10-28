# Infra

Infraestructura del ecosistema Trio Misión.

- `docker/` — definiciones Docker de servicios propios.
- `gotrue/` — configuración del servicio de autenticación (GoTrue); ver
  [`gotrue/README.md`](gotrue/README.md).
- `deploy/` — configuración de despliegue.

- **Estado:** GoTrue corre en `compose.yaml` (supabase/gotrue:v2.197.0) junto
  a PostgreSQL 16, con healthcheck, esquema `auth` migrado y login real
  verificado de extremo a extremo (Fase 2, 2026-10-27). La API y el worker
  siguen corriendo como procesos nativos en desarrollo.
