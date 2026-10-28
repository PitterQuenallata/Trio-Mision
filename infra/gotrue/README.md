# GoTrue — autenticación

GoTrue (hoy `supabase/auth`) es el servicio de registro y autenticación. Corre
en Docker Compose junto a PostgreSQL; la API Go valida los JWT que emite y es
la única que habla con el resto del modelo (perfiles, roles, negocio).

- **Imagen fijada:** `supabase/gotrue:v2.197.0` (ver `compose.yaml`). Antes de
  cambiarla, revisar notas de versión: supabase renombra variables y claves con
  frecuencia.
- **Puerto:** `9999` → `http://localhost:9999` (`GOTRUE_API_HOST=0.0.0.0`,
  `PORT=9999`).
- **Healthcheck:** `GET /health` (verifica con `wget` dentro del contenedor).
- **Base de datos:** mismo PostgreSQL, esquema `auth`, pero con el login dedicado
  `triomision_gotrue` y `GOTRUE_DB_PASSWORD`. La API usa otra cuenta sin acceso
  a `auth`; las migraciones administrativas usan `DB_ADMIN_URL`.

## Configuración (desarrollo)

Toda la configuración vive en `compose.yaml` (valores) y `.env` (secretos y
variables compartidas con la API). Nada de SMTP: con
`GOTRUE_MAILER_AUTOCONFIRM=true` el correo queda confirmado al instante y el
registro no envía email. En producción habrá que configurar SMTP (o dejar la
confirmación activa si se decide así).

| Variable | Dónde | Descripción |
|---|---|---|
| `GOTRUE_JWT_SECRET` | `.env` (compartida) | Secreto HS256 de los JWT. La API exige el mismo valor. |
| `GOTRUE_JWT_AUDIENCE` | `.env` (compartida) | Audiencia (`authenticated`). Compose la pasa a GoTrue como `GOTRUE_JWT_AUD`. |
| `GOTRUE_JWT_EXP` | `.env` / compose | Segundos de validez del access token (default 3600). |
| `API_EXTERNAL_URL` | `.env` / compose | URL pública de GoTrue. **Sin prefijo `GOTRUE_`**: v2.197+ la exige así. |
| `GOTRUE_SITE_URL` | `.env` / compose | Redirección tras flujos de email (dev: `http://localhost:3000`). |
| `GOTRUE_MAILER_AUTOCONFIRM` | compose | `true` en desarrollo: sin correo de confirmación. |
| `GOTRUE_JWT_DEFAULT_GROUP_NAME` | compose | Marca `role=authenticated` en el JWT (deprecada por supabase; se mantiene hasta fijar el reemplazo). |

## Particularidades de esta versión (verificadas, 2026-10-27)

1. **`API_EXTERNAL_URL` sin prefijo.** La v2.197+ carga la clave
   `API_EXTERNAL_URL` desde la variable de entorno homónima; con
   `GOTRUE_API_EXTERNAL_URL` falla el arranque con
   `required key API_EXTERNAL_URL missing value`. El resto de claves siguen
   usando prefijo `GOTRUE_`.
2. **El esquema `auth` no lo crea GoTrue.** Sus migraciones asumen que existe
   (en Supabase lo crea la plataforma). Se crea en la migración goose
   `00004_auth_schema.sql`.
3. **Las migraciones de GoTrue requieren el rol `postgres`.** Una migración
   hace `GRANT ... TO postgres`; se crea en `00005_postgres_role.sql`.
4. **El rol de conexión necesita `auth` en el `search_path`.** GoTrue consulta
   sus tablas sin calificar el esquema; se configura en
   `00006_search_path_auth.sql` (`"$user", public, auth`).

## Flujo de desarrollo

```bash
make up                 # PostgreSQL + GoTrue healthy
curl http://localhost:9999/health
```

Registro y login reales (igual que usa la colección Bruno):

```bash
curl -X POST http://localhost:9999/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@triomision.local","password":"DevPass123!"}'

curl -X POST 'http://localhost:9999/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@triomision.local","password":"DevPass123!"}'
```

Devuelve `access_token` (JWT `aud=authenticated`, `exp=GOTRUE_JWT_EXP`) y
`refresh_token`. Ese token sirve para `GET /api/v1/me`, que además crea el
perfil en `profiles` en el primer request (ver `services/api/README.md`).

## Reset de la base

`make db-reset` elimina también el esquema `auth` (down de `00004`). GoTrue no
re-migra hasta reiniciarse:

```bash
make db-reset && docker compose restart gotrue
```

## Notas para producción (pendiente, Fase 5)

- Rol dedicado para GoTrue (hoy usa el superusuario `POSTGRES_USER`).
- SMTP real y confirmación de correo activada.
- HTTPS en `API_EXTERNAL_URL`; revisar `GOTRUE_URI_ALLOW_LIST`.
- Backups que incluyan el esquema `auth` (las sesiones viven ahí).
