# API — Trio Misión

API central del ecosistema (monolito modular en Go). Autoridad para las
operaciones protegidas: valida tokens de GoTrue y concentra la lógica de
negocio. Ver el alcance en `docs/alcance/` y el plan en `docs/planificacion/`.

## Estado

**Sprint 3C.1 completado** (2026-10-27): planes Premium con suscripciones
temporales (extienden el período vigente), productos `premium` vinculados a
plan y paquetes multi-pista con `include_future_tracks`, cupones
fijos/porcentuales calculados en backend (subtotal/descuento/total en la
orden; nunca totales negativos), códigos de canje con vigencia, límites e
idempotencia (sin pago, `grant_source=redemption`), aprobación generalizada
de pagos (período Premium o entitlements del snapshot, sin duplicar),
`/mis-compras` con suscripciones y `premium_activo`, y endpoints staff de
planes/cupones/canjes con auditoría transaccional. Sobre la base 3A/3B:
migraciones hasta 00020 (backfill de `orders.coupon_id`), Bruno **118/118
requests, 63/63 tests, 277/277 aserciones**. API versión **0.7.1**, con la
aprobación basada en los snapshots y el conflicto concurrente de canjes
endurecidos tras revisión. Guía de integración en `docs/development/integracion-api.md`.
Siguiente: Sprint 3C.2 (licencias y permisos adicionales por pista).

## Autenticación y autorización

GoTrue corre en `compose.yaml` (supabase/gotrue:v2.197.0, puerto 9999) con
registro y login reales verificados; su configuración y las particularidades
de la versión están en `infra/gotrue/README.md`. La API solo valida JWT
(HS256, audiencia `GOTRUE_JWT_AUDIENCE`); las credenciales viven en GoTrue.
El flujo completo de prueba está en la colección Bruno: `GoTrue - signup` →
`GoTrue - login` → `Me con token GoTrue`.

La autorización de negocio se decide en PostgreSQL: los endpoints staff
(`/api/v1/staff/*`) exigen un rol en `staff_roles` (admin/vendedor) mediante
`internal/authz.RequireStaff`; los endpoints por artista
(`/api/v1/mis-artistas/*`) exigen membresía en `artist_members` con
`internal/authz.RequireArtistRole` (no miembro → 404, member ante mutación →
403); los claims del token nunca autorizan por sí solos. Roles staff:
`make db-staff EMAIL=… ROLE=…`. Membresías por artista: un manager las asigna
desde la API (auditoría `rol.asignado`), y el primer manager se arranca con
`make db-artist-role EMAIL=… ROLE=… ARTIST=trio-mision`.

## Estructura

```
cmd/api/            Punto de entrada
cmd/seed/           Seed de desarrollo (himnario + catálogo + demo de tienda con upload a S3)
internal/config/    Configuración por variables de entorno
internal/database/  Pool PostgreSQL (pgx) e interfaz Querier (pool y transacciones)
internal/auth/      Validación JWT GoTrue (HS256) + middleware
internal/authz/     Autorización: staff sobre staff_roles y membresía por artista sobre artist_members
internal/storage/   Cliente S3 compatible (MinIO): URLs firmadas y objetos públicos
internal/server/    Router chi + OpenAPI (Huma) + middlewares
internal/modules/   Módulos de negocio (health, me, himnario, catalog, artists, devices, store, staff)
```

## Desarrollo

```bash
# desde la raíz del monorepo
cp .env.example .env   # si no existe (incluye las variables S3 de MinIO)
make up                # PostgreSQL + GoTrue + MinIO en Docker
make db-migrate        # migraciones (goose)
make db-seed           # datos de desarrollo (idempotente; sube la demo de tienda a MinIO)
make api-test          # tests
make api-run           # API en http://localhost:8080
```

Swagger UI: <http://localhost:8080/docs> · Spec: <http://localhost:8080/openapi.json>
Consola MinIO: <http://localhost:9001> (mismas credenciales `S3_*` del `.env`).

## Variables de entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `API_PORT` | no | `8080` | Puerto HTTP |
| `API_ENV` | no | `development` | Entorno |
| `API_DATABASE_URL` | sí | — | Cuenta restringida de la API, sin acceso a `auth` |
| `DB_ADMIN_URL` | migraciones | — | Cuenta administrativa solo para goose/operación |
| `GOTRUE_JWT_SECRET` | sí | — | Secreto HS256 compartido con GoTrue |
| `GOTRUE_JWT_AUDIENCE` | no | `authenticated` | Audiencia esperada del JWT |
| `S3_ENDPOINT` | sí (tienda) | — | Endpoint S3 (MinIO: `http://localhost:9000`) |
| `S3_BUCKET` | sí (tienda) | — | Bucket de objetos |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | sí (tienda) | — | Credenciales del bucket |
| `S3_PUBLIC_BASE_URL` | no | — | Base URL pública de previews (`public/`) |
| `S3_REGION` | no | `us-east-1` | Región de firma |
| `S3_PRESIGN_TTL` | no | `15m` | Vida de URLs firmadas de descarga |

## Endpoints actuales

- `GET /api/v1/health` — liveness (sin auth)
- `GET /api/v1/ready` — readiness, pinge PostgreSQL (devuelve 503 si cae la DB)
- `GET /api/v1/me` — identidad del usuario (requiere Bearer JWT de GoTrue).
  Asegura el perfil: crea la fila en `profiles` en el primer request
  (id = `sub` del token) y devuelve `display_name` (inicial: parte local del
  correo; si el perfil existía con nombre vacío, lo completa).
- `GET /api/v1/himnario/himnos` — himnos publicados (`?coleccion=`, default `himnario-adventista`)
- `GET /api/v1/himnario/himnos/{numero}` — himno con sus versiones publicadas (ChordPro incluido)
- `GET /api/v1/catalogo/artistas` — artistas publicados
- `GET /api/v1/catalogo/artistas/{slug}` — artista con álbumes y canciones publicados (metadatos)
- `GET /api/v1/catalogo/canciones/{id}` — canción con ChordPro solo si `acceso = free`; si no, 403
- `GET /api/v1/tienda/ofertas` — ofertas vigentes (público; importes enteros, moneda ISO, preview público, `pistas_total` y `plan` en ofertas premium)
- `GET /api/v1/tienda/planes` — planes Premium activos con beneficios publicados (público)
- `GET /api/v1/tienda/pistas/{id}` — pista en venta con preview y ofertas vigentes
- `POST /api/v1/tienda/ordenes` — crea orden e ítem atómicamente congelando oferta/producto/contenido; acepta `coupon_code` y calcula subtotal/descuento/total en backend (idempotente por `idempotency_key`, que conserva oferta, cupón y payload)
- `GET /api/v1/tienda/ordenes/{id}` — orden propia con ítems (snapshots congelados) e intentos de pago
- `POST /api/v1/tienda/ordenes/{id}/pagos` — intento QR/transferencia de una orden propia y vigente; el monto debe coincidir con el total (post-descuento)
- `POST /api/v1/tienda/pagos/{pagoId}/comprobante` — multipart autenticado; valida titularidad, contenido real JPEG/PNG/WebP y máximo 5 MiB, guarda en `evidence/` privado → `in_review`
- `POST /api/v1/tienda/canjes` — canjea un código de canje: concede período Premium o entitlements del paquete con `grant_source=redemption`, sin pago; idempotente por clave y por (código, usuario)
- `GET /api/v1/mis-compras` — compras pagadas, accesos y suscripciones del usuario, con `premium_activo` calculado por tiempo
- `GET /api/v1/mis-compras/accesos/{id}/descarga` — URL firmada del master solo con entitlement vigente
- `GET /api/v1/mis-artistas` — mis membresías por artista con mi rol (member|manager)
- `GET /api/v1/mis-artistas/{artistId}` — ficha + álbumes + canciones publicadas de mi artista
- `GET /api/v1/mis-artistas/{artistId}/canciones/{songId}` — canción con ChordPro (la membresía autoriza la lectura)
- `PATCH /api/v1/mis-artistas/{artistId}` — manager: bio/país/redes/portada de su artista
- `POST /api/v1/mis-artistas/{artistId}/albumes` · `PATCH …/albumes/{albumId}` — manager: álbumes
- `POST /api/v1/mis-artistas/{artistId}/canciones` · `PATCH …/canciones/{songId}` — manager: canciones (crear sin publicar; PATCH publica)
- `POST /api/v1/mis-artistas/{artistId}/miembros` · `DELETE …/miembros/{userId}` — manager: membresías (auditoría rol.asignado/rol.revocado)
- `PUT /api/v1/dispositivos` — alta/refresco de instalación (install_id estable del cliente; sin tokens)
- `GET /api/v1/dispositivos` — mis dispositivos con estado (activo|revocado)
- `POST /api/v1/dispositivos/{installId}/heartbeat` — marca actividad (opcional app_version)
- `POST /api/v1/dispositivos/{installId}/revocar` — revocación propia (idempotente; no se deshace)
- `GET /api/v1/staff/pagos?estado=` — bandeja de revisión (rol staff)
- `GET /api/v1/staff/pagos/{id}` — detalle con URL firmada del comprobante (5 min) e ítems congelados
- `POST /api/v1/staff/pagos/{id}/aprobar` — transacción idempotente con locks: confirma pago + orden pagada + efectos del snapshot (período Premium que extiende el vigente, o entitlements de las pistas congeladas; contenido vigente si `include_future_tracks=true`); solo un pago confirmado por orden
- `POST /api/v1/staff/pagos/{id}/rechazar` — rechaza con comentario; la orden queda pendiente
- `GET /api/v1/staff/accesos?usuario=` — entitlements concedidos
- `POST /api/v1/staff/accesos/{id}/revocar` — revoca acceso con motivo (idempotente)
- `GET /api/v1/staff/auditoria?entidad=&accion=&limite=` — pista de auditoría
- `GET /api/v1/staff/dispositivos?usuario=` — dispositivos registrados (admin|vendedor)
- `POST /api/v1/staff/dispositivos/{id}/revocar` — revoca dispositivo con motivo (idempotente, auditoría)
- `GET|POST /api/v1/staff/planes`, `PATCH /api/v1/staff/planes/{id}` — administración de planes Premium (admin+vendedor, auditoría)
- `GET|POST /api/v1/staff/cupones`, `PATCH /api/v1/staff/cupones/{id}` — administración de cupones (el tipo y valor del descuento no se editan; auditoría)
- `GET|POST /api/v1/staff/canjes`, `GET|PATCH /api/v1/staff/canjes/{id}` — administración de códigos de canje con sus redenciones (auditoría)

## Conventions

- Nuevos módulos van en `internal/modules/<dominio>/` con una función `Register(api huma.API, ...)`.
- Endpoints bajo `/api/v1/`.
- Operaciones protegidas: declarar `Security: []map[string][]string{{"bearer": {}}}` en la operación; el middleware de auth solo actúa en operaciones que la declaran.
- Operaciones staff: añadir el middleware `authz.RequireStaff(api, db, "admin", "vendedor")` en `Operation.Middlewares`.
- Operaciones por artista: añadir `authz.RequireArtistRole(api, db, "artistId", "member"|"manager")`; los parámetros de ruta deben declararse como campos de primer nivel del input (Huma no aplana structs embebidos: un `path:` dentro de un struct anidado llega vacío).
- Los nombres de tipo de respuesta deben ser únicos entre módulos: Huma registra los esquemas OpenAPI por nombre de tipo (`cancionResumen` en catalog y artists colisiona).
- Helpers que participan de una transacción reciben `database.Querier` (pool o `pgx.Tx`), no `database.DB`.
- Migraciones en `database/migrations/` con goose; no modificar las ya aplicadas (corregir con migraciones nuevas).
- Endpoints nuevos con su request en `bruno/` y verificación real contra la API y PostgreSQL.
- Decisiones de stack: `docs/decisions/0002-api-go-chi-huma.md`.
