# CURRENT_TASK — Estado del trabajo

> Archivo de estado vivo. Se actualiza al inicio y al final de cada sesión de trabajo.
> Última actualización: 2026-10-27

## Fase 3 / Sprint 3C.1 — Premium, paquetes de audio, cupones y canjes: COMPLETADA ✅

**Cerrado el 2026-10-27.** API pura 0.7.1: planes Premium con suscripciones
temporales, productos premium y paquetes multi-pista con snapshot congelado,
cupones fijos/porcentuales calculados en backend, códigos de canje con
vigencia/límites/idempotencia y endpoints staff mínimos con auditoría
transaccional. **No se construyó ni modificó UI**: los clientes se integran
contra `docs/development/integracion-api.md`.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migraciones 00016-00019 (`plans`/`subscriptions`, `premium` en products + `include_future_tracks`, `coupons`/`coupon_uses` + totales en orders, `redemption_codes`/`redemptions` + grants mínimos) | `database/migrations/` | Hecho |
| Seed: Premium 30 días, paquete de 2 pistas (segunda pista demo), cupones BIENVENIDA10/FIJO500, códigos PREMIUM-DEMO/PAQUETE-DEMO | `cmd/seed/` | Hecho |
| `crearOrden` generalizado: snapshot de todos los ítems (pista/plan/paquetes), `coupon_code` opcional, subtotal/descuento/total calculados en backend, idempotencia conserva oferta+cupón+payload | `internal/modules/store/store.go` | Hecho |
| Concesión centralizada e idempotente: `ConcederPremium` (extiende período vigente), `ConcederPistasSnapshot` (snapshot congelado), `ConcederPistasProducto` (contenido vigente) | `internal/modules/store/grants.go` | Hecho |
| Aprobación de pagos generalizada: en la misma tx y con locks crea período Premium o entitlements de las pistas del snapshot; repetir no duplica | `internal/modules/staff/staff.go` | Hecho |
| Canje de códigos: vigencia, límites, idempotencia por clave y por (código, usuario), congela contenido, sin pago | `internal/modules/store/canjes.go` | Hecho |
| Planes públicos, ofertas con premium/paquetes (`pistas_total`), `/mis-compras` con suscripciones y `premium_activo` por tiempo | `internal/modules/store/` | Hecho |
| Endpoints staff de planes, cupones y canjes (admin+vendedor, editor → 403) con auditoría transaccional | `internal/modules/staff/comercial.go` | Hecho |
| Colección Bruno: 51 requests nuevos (118 total: 63 tests, 277 aserciones) | `bruno/` | Hecho |

### Verificación contra sistema real (2026-10-27, tras `make db-reset` desde cero)

- 20 migraciones goose down+up limpias (00016-00019 reversibles con y sin
  datos premium); `make db-security`, GoTrue healthy y seed aplicado.
- Colección Bruno completa tras reset desde cero: **118/118 requests,
  63/63 tests, 277/277 aserciones** en verde; una segunda corrida sobre los
  mismos datos vuelve a quedar en verde (repetible sin reset).
- Flujo Premium real (curl + Bruno): orden con cupón 10% (5000→4500), pago
  con comprobante, aprobación crea exactamente 1 período (`accesos_creados`
  =0: nada de audio), doble aprobación idempotente, `premium_activo=true` y
  la descarga con el id de la suscripción devuelve 404.
- Flujo paquete real: orden congela las 2 pistas (`include_future_tracks=
  false`); con SQL se agregó una 3.ª pista al producto entre la orden y la
  aprobación y la verificación SQL confirmó 0 entitlements sobre ella —
  solo se entregan las pistas del snapshot. Canje previo + compra: los
  accesos vigentes siguen siendo exactamente 2 (sin duplicar).
- Cupones (Bruno): fijo (500 BOB), porcentual (10%), inexistente → 404,
  vencido → 409, mínimo no alcanzado → 422, límite por usuario → 409,
  reutilizar la clave idempotente con otro cupón → 409.
- Canjes (Bruno): válido (suscripción o accesos con `grant_source=
  redemption`, sin pago), repetido → `ya_canjeado=true` sin consumir otro
  uso, vencido/agotado → 409, clave con otro código → 409 (flujo
  autocontenido con códigos frescos por corrida).
- Regresiones: MIME falso → 422; 5 MiB + 1 byte → 422; doble aprobación
  concurrente → un solo pago confirmado y sin accesos duplicados;
  colección 3A/3B completa en verde (permisos cruzados member/manager/
  editor incluidos).
- SQL verificado con la cuenta `triomision_api`: sin acceso a `auth`, sin
  crear roles/DB, sin borrar `audit_events`/`orders`/`entitlements`/
  `subscriptions`/`coupons`/`redemption_codes`/`redemptions`/
  `payment_attempts`, sin insertar `staff_roles`; sí lee y gestiona lo
  comercial.
- MinIO: la cuenta de servicio conserva solo la política del bucket; la
  operación administrativa (`mc admin user list`) fue denegada.
- Auditoría: `plan.creado/actualizado`, `cupon.creado`, `canje.creado/
  canjeado`, `pago.aprobado` y `acceso.concedido` registrados con actor y
  metadata; la API no puede borrarlos.
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger UI 200,
  spec 0.7.1 con 44 paths.

### Endurecimiento posterior a revisión (API 0.7.1)

- La aprobación interpreta `product_snapshot`/`content_snapshot` y concede la
  duración Premium congelada, sin depender de una edición posterior del plan.
  Reproducción real: editar 30→1 días antes de aprobar sigue extendiendo 30.
- Dos códigos distintos con la misma clave idempotente en paralelo devuelven
  200/409 (antes 200/500), sin consultar una transacción abortada.
- Las nuevas órdenes persisten `coupon_id`; la migración reversible 00020
  reparó el backfill histórico y su down+up dejó 0 referencias pendientes.
- Tras los cambios: build/vet/gofmt/tests en verde, Bruno 118/118 requests,
  63/63 tests y 277/277 aserciones, OpenAPI 0.7.1 con 44 paths y Swagger 200.

### Decisiones y hallazgos del Sprint 3C.1

- **Premium no es un entitlement**: se calcula desde períodos de
  `subscriptions` (`premium_activo` = existe período `active` con
  `period_end > now()`). Jamás crea entitlements de audio ni licencias.
- **Extensión de período**: al comprar/canjar de nuevo, la suscripción
  nueva empieza donde termina el vigente (`max(period_end vigente)`).
  Idempotencia por `order_item_id`/`redemption_id` únicos parciales.
- **`include_future_traces=false` congela el snapshot**: la aprobación
  entrega las pistas del `content_snapshot` (jsonb: `track_id` plano para
  pistas, arreglo `pistas` para paquetes). Con `true`, entrega el contenido
  publicado vigente del producto al aprobar.
- **Cupones jamás producen totales negativos**: descuento calculado en
  backend (entero, `subtotal*pct/100` o monto fijo); un cupón que dejaría
  el total en cero se rechaza con 422 y el check `total = subtotal -
  descuento` queda en base. El tipo/valor del descuento no se edita tras
  crear el cupón (las órdenes congelan lo calculado).
- **Idempotencia del canje por (código, usuario)**: repetir devuelve el
  canje original sin consumir otro uso; la clave de cliente tampoco se
  reutiliza con otro código. El contenido concedido se congela en
  `redemptions.content_snapshot`.
- **Bruno**: los ids no secretos se comparten con `bru.setEnvVar` (igual
  que la colección previa); un request sin bloque `auth:bearer` explícito
  hereda el Bearer de colección — siempre declarar el token.

## Siguiente tarea — Sprint 3C.2: licencias y permisos adicionales por pista

**Estado:** no iniciado. Base verificada: API 0.7.1, 20 migraciones, Bruno
118/118 y 277/277. **Solo API; no construir UI.** Ver alcance en
`docs/planificacion/README.md`: usos concretos elegibles por pista
(`track_license_options`), términos versionados (`license_terms_versions`),
aceptación y `license_grants` con `license_snapshot` en la orden. Después
3C.3 servicios/soporte.

### Criterio de salida 3C.2

- Pistas elegibles ofrecen permisos adicionales con precio y términos; las
  no autorizadas no los ofrecen.
- La compra de un permiso congela términos y usos aceptados
  (`license_snapshot`), crea `license_grants` auditado e idempotente, y no
  se ofrece en pistas no elegibles.
- Regresiones 3A/3B/3C.1 en verde con el mismo rigor (build/tests, Bruno,
  escenario real, privilegios mínimos).

## Fase 3 / Sprint 3B — API pura: contratos, autorización por artista y dispositivos: COMPLETADA ✅

**Cerrado el 2026-10-27.** Contratos estables y documentados para compradores,
staff, member/manager y dispositivos, con autorización backend y pruebas
reales completas. **No se construyó ni modificó UI** (`apps/web`,
`apps/admin`, APK, PC): esos clientes se integrarán después contra esta API
(guía en `docs/development/integracion-api.md`).

| Entregable | Ubicación | Estado |
|---|---|---|
| Migración 00015 (`devices`: instalación, plataforma, actividad, revocación; grants de `artist_members` a la API) | `database/migrations/` | Hecho |
| Middleware de membresía por artista (no miembro → 404, member que muta → 403) | `internal/authz/authz.go` | Hecho |
| Módulo `artists`: member lee (ChordPro incluido), manager administra sus artistas (álbumes, canciones, ficha, membresías) con auditoría | `internal/modules/artists/` | Hecho |
| Módulo `devices`: alta/upsert, lista propia, heartbeat, revocación propia; consulta/revocación staff con auditoría | `internal/modules/devices/` | Hecho |
| Estabilización: API 0.6.1, paginación `limite`/`desde` en himnario, descripciones de estados y convenciones | `internal/server/`, `internal/modules/himnario/` | Hecho |
| Seed: segundo artista (`coro-polifonico`) y canción premium en el álbum demo | `cmd/seed/` | Hecho |
| Bootstrap de membresías por SQL + asignación por API con auditoría | `scripts/grant-artist-role.sh`, `Makefile` (`db-artist-role`) | Hecho |
| Colección Bruno: 33 requests nuevos (67 total: 39 tests, 142 aserciones) | `bruno/` | Hecho |
| Guía de integración para clientes + matriz de permisos + tabla de endpoints | `docs/development/integracion-api.md` | Hecho |

### Verificación contra sistema real (2026-10-27, tras `make db-reset` desde cero)

- 15 migraciones goose down+up limpias; `make db-security`, GoTrue healthy y
  seed aplicado (incluye segundo artista y canción premium).
- Colección Bruno completa: **67/67 requests, 39/39 tests, 142/142
  aserciones** en verde. Flujos 3A y 3B repetidos contra el sistema vivo.
- Autorización por artista verificada: member lee ChordPro premium, member que
  muta → 403; no-miembro/artista ajeno → 404; manager administra solo su artista.
- Endurecimiento posterior a revisión: cada mutación de artista/álbum/canción/
  membresía y su auditoría comparten transacción y rollback; duplicado de
  membresía → 409; eliminar al último manager → 409.
- Dispositivos verificados: alta/upsert, aislamiento, heartbeat, revocación y
  staff. Un heartbeat revocado devuelve 409 y una comprobación SQL confirma que
  `last_seen_at` no cambia; re-registro de revocados → 409.
- SQL verificado: `triomision_api` sin acceso a `auth`, sin crear roles/DB,
  sin borrar auditoría ni insertar `staff_roles`; sí gestiona `artist_members`.
- Regresiones: MIME falso → 422; 5 MiB + 1 byte → 422; doble aprobación
  concurrente sin duplicar pago ni acceso.
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger UI 200,
  spec 0.6.1 con los 36 paths y paginación del himnario.

### Decisiones y hallazgos del Sprint 3B

- **Huma no aplana structs embebidos en inputs**: un `path:` dentro de un
  struct anidado llega vacío al handler (uuid "" en INSERT). Los parámetros
  de ruta se declaran de primer nivel; anotado en `services/api/README.md`.
- **Nombres de tipos de respuesta únicos entre módulos**: Huma registra
  esquemas por nombre de tipo (`cancionResumen` colisionó catalog/artists;
  renombrado a `cancionMia`).
- **LEFT JOIN con columnas NULL**: álbumes sin canciones publicadas exigen
  escanear las columnas de canción en punteros; `UPDATE … FROM albums`
  exige cualificar las columnas de `songs` (`title`/`sort_order` son
  ambiguas).
- **member lee ChordPro de canciones premium/purchase de sus artistas**: la
  membresía es la autorización, no el tipo de acceso del catálogo. Lecturas
  solo de contenido publicado; los borradores se administran por id (la
  visibilidad de borradores llegará con el panel en Fase 5).
- **Dispositivos revocados no se reactivan**: re-registrar el mismo
  `install_id` → 409; una reinstalación real genera install_id nuevo. El
  endpoint propio opera por `install_id`, el staff por UUID interno.

## Siguiente tarea — Sprint 3C.1: Premium, paquetes de audio, cupones y canjes

**Estado:** no iniciado. Base verificada: API 0.6.1, 15 migraciones, Bruno
67/67 y 142/142. **Solo API; no construir ni modificar UI.** La siguiente sesión
debe leer `AGENTS.md`, `docs/alcance/README.md`, `docs/payments/README.md` y
`docs/architecture/modelo-datos-v2.md` antes de diseñar las migraciones.

### Objetivo vertical

Un comprador puede adquirir Premium por tiempo limitado o un paquete de pistas,
pagar por QR/transferencia y recibir acceso tras aprobación staff. Otro usuario
puede canjear un código sin pagar. Premium no regala audio ni permisos de uso.

### 1. Modelo y migraciones nuevas (sin alterar las aplicadas)

- Planes Premium asociados a productos/ofertas: duración y beneficios JSON; la
  tabla `subscriptions` guarda periodos, origen y estado. No booleano permanente.
- Ampliar productos para `premium` además de pista/álbum/catálogo. Los paquetes
  usan todos sus `product_items` y congelan el contenido al crear la orden;
  definir explícitamente si un paquete incluye o no futuras incorporaciones.
- Cupones porcentuales/fijos con moneda, vigencia, límites total/por usuario y
  estado. Órdenes conservan subtotal, descuento, total y referencia al cupón;
  cálculo exclusivamente backend, nunca montos negativos.
- Códigos de canje y redenciones con vigencia/límites, idempotencia y auditoría.
  Conceden subscription o entitlements con `grant_source=redemption`, sin pago.
- Migraciones reversibles desde cero, grants mínimos para `triomision_api` y
  seed de: Premium 30 días, paquete con dos pistas, cupón y código de canje.

### 2. Contratos y lógica de negocio

- Endpoints públicos de ofertas/planes y autenticados para crear orden con cupón,
  consultar orden, canjear código y consultar compras/suscripciones/accesos.
- Endpoints staff mínimos para administrar planes, cupones y canjes con roles
  correctos y auditoría transaccional, reutilizando patrones de 3A/3B.
- Generalizar `crearOrden`: snapshots de todos los ítems, cupón validado y total
  calculado en la misma transacción; idempotencia valida oferta/cupón/payload.
- Generalizar aprobación: en una transacción y con locks, confirmar pago/orden y
  crear **solo uno** de estos efectos por ítem: período Premium o entitlements
  de cada pista/asset del snapshot. Repetir aprobación no duplica nada.
- `/mis-compras` añade suscripciones con `activa`, inicio/fin y `premium_activo`
  calculado por tiempo actual. Premium no crea entitlements de audio ni licencias.
- Canje también transaccional e idempotente; respetar vigencia, límites y revocación.

### 3. Pruebas obligatorias

- Premium aprobado crea un período, no una descarga; doble aprobación no duplica.
- Paquete concede exactamente las pistas del snapshot; si `include_future=false`,
  una pista añadida después no recibe acceso. Doble compra no duplica acceso vigente.
- Cupón fijo/porcentual, expirado, inexistente, límites por usuario/total y montos
  mínimos; nadie elige descuento desde el cliente.
- Canje válido, repetido, expirado y agotado; no crea pago ni duplica efectos.
- Autorización cruzada, auditoría, privilegios SQL/MinIO y regresiones 3A/3B.
- Build/tests/vet/gofmt, Bruno completo y reset desde cero con bootstrap/seed.
  OpenAPI/Swagger y guía de integración actualizados con ejemplos de cada flujo.

### 4. Documentación y salida

- Actualizar `docs/payments/README.md`, modelo de datos, guía de integración,
  `services/api/README.md`, `AGENTS.md` y este archivo con resultados reales.
- Bump de versión apropiado (cambio de contrato) y notas de migración para clientes.
- No implementar licencias adicionales (3C.2), servicios/soporte (3C.3), renovación
  automática, Binance/IAP, sync offline, FCM, worker ni interfaces gráficas.

**Criterio de salida:** compra Premium y paquete verificadas de extremo a extremo;
cupones/canjes idempotentes; acceso correcto sin duplicados ni mezcla Premium/audio;
todo documentado para que los futuros clientes consuman solo la API.

## Fase 3 / Sprint 3A — Flujo vertical de compra y descarga por API: COMPLETADA ✅

**Cerrado el 2026-10-27.** Un usuario se registra en GoTrue, compra la pista demo
con pago QR manual, un vendedor staff aprueba el comprobante y el usuario descarga
el master real desde MinIO con una URL firmada. Todo por API; el panel visual
sigue siendo Fase 5.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migraciones 00007-00014 (negocio, integridad, perfiles con email y privilegios mínimos) | `database/migrations/` | Hecho |
| Autorización staff + auditoría append-only para la API y `rol.asignado` | `internal/authz/`, `internal/modules/staff/` | Hecho |
| Cuentas separadas para API/GoTrue/admin; API sin acceso a `auth` | `scripts/db-security.sh`, `00014` | Hecho |
| Módulos `store` y `staff` (Huma/OpenAPI) | `internal/modules/` | Hecho |
| MinIO con cuenta de servicio no administrativa y bucket privado salvo `public/` | `compose.yaml`, `infra/minio/init.sh` | Hecho |
| Comprobante multipart autenticado, máximo 5 MiB y MIME por contenido | `internal/modules/store/pagos.go` | Hecho |
| Seed: pista demo con master/preview subidos a MinIO + oferta 1500 BOB | `cmd/seed/seed_store.go` | Hecho |
| Colección Bruno: 24 requests del flujo 3A + negativos (34 total) | `bruno/` | Hecho |

### Verificación contra sistema real (2026-10-27, tras `make db-reset` desde cero)

- 14 migraciones goose down+up limpias; `make db-security`, GoTrue healthy y
  seed con la cuenta restringida. El backfill de email tolera que `auth.users`
  aún no exista durante un reset.
- SQL verificado: `triomision_api` no es superuser ni puede crear roles/DB; no
  tiene `USAGE` sobre `auth`, no borra pagos, no edita/borra auditoría y no
  inserta roles. `db-staff` registró `rol.asignado` correctamente.
- MinIO: la cuenta `triomision-api` tiene solo la política del bucket y la
  operación administrativa fue denegada. Root quedó separada para init/admin.
- Flujo completo: orden idempotente y atómica, comprobante multipart real,
  aprobación transaccional, entitlement, descarga, revocación y auditoría.
  La aprobación repetida no duplica pago ni acceso.
- Abuso de subida: archivo que no es imagen → 422; 5 MiB + 1 byte → 422.
- Colección Bruno: **34/34 requests, 18/18 tests, 77/77 aserciones** en verde.
  Tokens y URLs firmadas usan `bru.setVar`; `Local.bru` queda sin credenciales.
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger/OpenAPI 200
  con spec 0.5.0. Acceso ajeno a orden/comprobante/descarga sigue denegado.

### Decisiones y hallazgos del Sprint 3A

- **MinIO vía `bitnamilegacy/minio`**: empaquetado fijado con binario upstream.
- **Comprobantes por API, no POST directo a MinIO**: para archivos de máximo
  5 MiB simplifica clientes y permite límite, titularidad y detección MIME real
  en backend. Bruno usa un fixture multipart binario porque su runner no
  construye correctamente este formulario; curl verificó además el archivo real.
- **Perfiles con email**: la API dejó de consultar `auth.users`; staff lee
  `profiles`. Credenciales y sesiones permanecen solo en GoTrue.
- **`member`/`manager`**: member entra al panel pero solo lee contenido de sus
  artistas; manager administra únicamente sus artistas. Cliente PC y APK usan la
  misma API y cuenta; dispositivos quedan en Fase 4.
- Bruno CLI 4.3.0 persiste variables de entorno aunque estén declaradas
  secretas: tokens y URLs firmadas usan `bru.setVar`, no `bru.setEnvVar`.

## Siguiente tarea — Sprint 3C: alcance comercial restante (API pura)

**Estado:** no iniciado. Base verificada: API 0.6.1, 15 migraciones, Bruno
66/66 y 141/141. **Sin construir UI** (los clientes se integran después contra
`docs/development/integracion-api.md`).

**Objetivo:** completar el alcance comercial acordado en `docs/alcance/`:

1. **Planes Premium:** suscripción temporal con periodos, beneficios
   publicados y concesión/revocación auditada (el entitlement premium no
   concede paquetes de audio ni derechos de composición).
2. **Cupones y códigos de canje:** entitlements explícitos con origen,
   alcance y vencimiento (`grant_source=redemption`), idempotencia por canje.
3. **Audio por álbum/catálogo/pista y permisos adicionales por pista:**
   productos multi-ítem funcionales, usos concretos elegibles con precio y
   términos (`license_snapshot`), sin ofrecerlos en pistas no autorizadas.
4. **Servicios de composición/producción:** solicitud → cotización →
   aceptación/pago acordado → proyecto → entrega.
5. **Soporte:** tickets de pagos, descargas y reclamos (URL, claim ID,
   orden y licencia).
6. S3 para portadas y PDFs editoriales; Binance y otros proveedores después,
   sobre `payment_providers` ya previsto en `docs/payments/`.

**Criterio de salida:** los flujos comerciales restantes están implementados,
probados con el mismo rigor (build/tests, OpenAPI, Bruno, escenario real) y
documentados en la guía de integración, sin duplicar lógica de negocio en
clientes.

## Fase 0 — Documentación: COMPLETADA ✅

| Entregable | Ubicación | Estado |
|---|---|---|
| Alcance y requerimientos del sistema completo | `docs/alcance/README.md` | Hecho |
| Plan general de trabajo (fases, API primero) | `docs/planificacion/README.md` | Hecho |
| ADR 0002: stack de la API (chi + Huma + pgx + golang-jwt) | `docs/decisions/0002-api-go-chi-huma.md` | Hecho |

## Fase 1 — API en Go: Fundamentos: COMPLETADA ✅

| Entregable | Estado |
|---|---|
| Esqueleto Go (main, config, database, auth, server, health, me) | Hecho |
| Build + vet + tests en verde | Hecho |
| Makefile: `api-run`, `api-build`, `api-test`, `api-token` | Hecho |
| Colección Bruno en `bruno/` (3 requests, verificada con @usebruno/cli) | Hecho |
| Script `scripts/mint-dev-token.sh` (JWT de desarrollo) | Hecho |
| `.env.example` con `API_ENV` y `GOTRUE_JWT_AUDIENCE` | Hecho |
| `services/api/README.md` con instrucciones y convenciones | Hecho |

### Verificación contra sistema real (2026-10-26)

- PostgreSQL 16 verificado inicialmente con instalación nativa (entorno histórico; ver estado actual de Docker abajo)
- `GET /api/v1/health` → 200 `{status: ok, version: 0.1.0}`
- `GET /api/v1/ready` → 200 con DB arriba; **503 `{database: down}` con DB detenida**; 200 al restaurar
- `GET /api/v1/me` → 401 sin token; **200 con JWT HS256 real** firmado con `GOTRUE_JWT_SECRET`
- Swagger UI → 200 en `/docs`; spec válido en `/openapi.json`
- Shutdown por SIGTERM limpio ("apagando la API...")

### Nota sobre Docker

La verificación del 2026-10-26 se hizo con PostgreSQL nativo. Actualmente Docker
está instalado y `make up` levanta PostgreSQL 16 correctamente. La API se ejecuta
por separado con `make api-run`, que carga el `.env` de la raíz.

Verificación 2026-10-27: PostgreSQL healthy en Docker y `GET /api/v1/health`
responde 200 con versión 0.2.0.

## Fase 2 — API: modelo de datos y base de negocio: COMPLETADA ✅

- [x] Alcance funcional acordado y modelo consolidado con diagrama ER → `docs/architecture/modelo-datos-v2.md`
- [x] Correcciones de revisión incorporadas: himnos versionados, acceso editorial, roles múltiples, permisos por pista y referencias con integridad
- [x] `devices` fuera de `profiles`: corresponde a sync/descargas (Fase 4); docs actualizados
- [x] Migraciones iniciales con goose en `database/migrations/` (identidad, catálogo, himnario) — verificado con `db-reset` desde cero
- [x] Seed de desarrollo con contenido de `content/himnario/` (`cmd/seed`, idempotente: 614 himnos × 2 versiones + catálogo mínimo)
- [x] Módulos `himnario` y `catalog` (solo lectura) + requests Bruno
- [x] GoTrue en `compose.yaml` (supabase/gotrue:v2.197.0, healthcheck, esquema `auth`)
- [x] Migraciones de soporte a GoTrue: `00004` esquema auth, `00005` rol `postgres`, `00006` search_path con `auth`
- [x] Login real de extremo a extremo: signup → password grant → `/api/v1/me`
- [x] `/api/v1/me` asegura el perfil: crea la fila en `profiles` en el primer
      request (id = sub del JWT; display_name inicial = parte local del correo)
- [x] Colección Bruno: 10 requests (incluye `GoTrue - signup`, `GoTrue - login`,
      `Me con token GoTrue`) con flujo real y repetible

### Verificación contra sistema real (2026-10-27)

- `make db-reset` desde cero + `docker compose restart gotrue`: 6 migraciones
  goose down+up; GoTrue re-migra su esquema y queda healthy; seed re-aplicado
- `POST :9999/signup` → 200 con sesión (autoconfirm, sin SMTP);
  re-signup → 422 `user_already_exists`
- `POST :9999/token?grant_type=password` → JWT HS256 real
  (`aud=authenticated`, `exp=3600`) verificado por decodificación
- `GET /api/v1/me` con token real → 200 con UUID de auth.users y
  `display_name=dev`; 401 sin token y con token inválido; la fila existe en
  `profiles`; segunda llamada devuelve el perfil sin duplicarlo
- Colección Bruno: 10/10 requests, 24/24 aserciones, 2/2 tests en verde,
  también inmediatamente después de un reset de base
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger UI 200,
  spec `0.3.0` con `display_name` en el contrato de `/me`

### Hallazgo operativo importante

Había un PostgreSQL nativo (brew) corriendo en `127.0.0.1:5432` y capturaba
`localhost:5432`: las migraciones/seed/API de la sesión anterior cayeron en
esa base, no en el contenedor. Se detuvo (`brew services stop postgresql@16`,
reversible) y ahora el 5432 local es el contenedor. Ver nota en
`docs/development/README.md`: mantener el nativo detenido mientras se usa Docker.

### Después del Sprint 3A

- **3B — API pura para clientes, staff, artistas y dispositivos:** ✅
  completado 2026-10-27 (ver sección superior). El portal web y el resto de
  UI se construirán en Fase 5 contra la guía de integración.
- **3C — Alcance comercial restante:** Premium, cupones/canjes, permisos adicionales
  por pista, servicios y soporte. Worker, sync offline y FCM quedan en Fase 4.

**Criterio de salida de Fase 3:** un usuario puede registrarse, pagar con QR
manual, ser aprobado por staff y descargar una pista comprada; el portal web
funciona con la misma cuenta que usará la app.

## Decisiones tomadas (2026-10-26)

- Router: **chi** · OpenAPI: **Huma** · DB: **pgx/v5** · JWT: **golang-jwt/v5** (ver ADR 0002)
- Primer sprint: **solo fundamentos** (sin módulos de negocio todavía)
- **Graphify**: pospuesto hasta que haya suficiente código para que aporte valor
- **mcp-go**: NO aplica para la API REST; opción futura para exponer tools MCP a agentes
- Docker: compose solo para infraestructura; la API corre nativa con `go run` en desarrollo

## Decisiones tomadas (2026-10-27, cierre de Fase 2)

- **GoTrue fijado a `supabase/gotrue:v2.197.0`** (última estable a la fecha). Sus
  particularidades quedan documentadas en `infra/gotrue/README.md`.
- **`API_EXTERNAL_URL` sin prefijo** `GOTRUE_`: la v2.197+ la exige así; el resto
  de claves conservan el prefijo.
- **Sin SMTP en desarrollo**: `GOTRUE_MAILER_AUTOCONFIRM=true`; la confirmación
  real de correo y el SMTP se deciden para producción (Fase 5).
- **Perfil creado de forma perezosa por la API** en el primer request
  autenticado a `/me` (INSERT ... ON CONFLICT DO NOTHING), no por trigger en
  `auth.users`: evita el problema de ordenamiento entre migraciones goose y el
  esquema de GoTrue, y es testeable. Las credenciales jamás salen de GoTrue.
- **`/me` ahora devuelve `display_name`** → contrato ampliado, API en 0.3.0.
- **Un solo PostgreSQL lógico**: se detuvo el PostgreSQL nativo de brew (la
  base real del proyecto vive en el contenedor Docker desde esta sesión).
- **`db-reset` deja la base en cero real** para GoTrue: el down de `00004`
  también elimina `public.schema_migrations` (registro de migraciones de
  GoTrue); sin eso GoTrue no re-migraba tras un reset. Tras un reset siempre:
  `docker compose restart gotrue`.
