# Guía de integración — API Trio Misión

> **Versión de contrato:** 0.8.0 (Sprint 3C.2). Esta guía es el contrato de
> integración para los clientes del ecosistema (APK, PC, `apps/web`, panel
> admin y panel usuario). Cualquier cambio que rompa compatibilidad exige bump
> de versión y nota de migración. La especificación viva y ejecutable es
> OpenAPI: `GET /openapi.json` y Swagger UI en `/docs`.

## 1. Principios

- Un solo backend (`services/api`) es la autoridad de negocio; los clientes
  **nunca** acceden a PostgreSQL ni a MinIO directamente.
- Autenticación con JWT de GoTrue; autorización de negocio exclusivamente en
  el backend (roles staff en `staff_roles`, membresías en `artist_members`).
- Importes enteros en unidades menores (centavos) con moneda ISO 4217.
- Los archivos privados (masters, comprobantes) solo se entregan con URLs
  firmadas breves emitidas por la API tras verificar acceso.
- Sin secretos en clientes: credenciales GoTrue en el servidor del cliente
  (o en el propio GoTrue con flujos de usuario); la API no expone secretos.

## 2. Autenticación (GoTrue)

GoTrue corre en `:9999` (desarrollo). Todos los endpoints de la API protegidos
exigen `Authorization: Bearer <access_token>`.

### 2.1 Registro y login

```bash
# Registro (desarrollo: autoconfirmado, sin SMTP)
curl -X POST $GOTRUE/signup -H 'Content-Type: application/json' \
  -d '{"email":"usuario@correo.com","password":"..."}'

# Login (password grant) → access_token (JWT HS256, exp 3600) + refresh_token
curl -X POST "$GOTRUE/token?grant_type=password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"usuario@correo.com","password":"..."}'
```

El `access_token` identifica al usuario en la API (`sub` = UUID del usuario,
`aud=authenticated`). El primer request autenticado crea la fila en `profiles`
(aseguramiento perezoso); `GET /api/v1/me` devuelve la identidad y asegura el
perfil en la misma llamada.

### 2.2 Refresh y logout

```bash
# Renovar access_token (el refresh_token es de un solo uso rotativo)
curl -X POST "$GOTRUE/token?grant_type=refresh_token" \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"..."}'

# Logout (revoca el refresh_token en GoTrue; el access_token expira solo)
curl -X POST "$GOTRUE/logout" -H "Authorization: Bearer <access_token>"
```

Los clientes deben guardar el `refresh_token` en almacenamiento seguro del
dispositivo y renovar ante un 401. La API **nunca** ve ni guarda refresh
tokens.

## 3. Convenciones de la API

- Base: `/api/v1`. Respuestas JSON con `$schema` (Huma). Errores consistentes:

```json
{"title":"Not Found","status":404,"detail":"orden no encontrada","errors":[...]}
```

| Código | Cuándo |
|---|---|
| 401 | Sin token, token inválido o expirado |
| 403 | Autenticado pero sin permiso (rol/alcance insuficiente, contenido no autorizado, acceso revocado) |
| 404 | Recurso inexistente **o ajeno** (la API no revela existencia de recursos privados de terceros) |
| 409 | Conflicto de estado/negocio (orden pagada, pago ya confirmado, clave idempotente reutilizada con otros datos, dispositivo revocado) |
| 422 | Validación de entrada (schema, montos que no coinciden, MIME falso, archivo > 5 MiB) |

- **Idempotencia:** las operaciones de dinero aceptan `idempotency_key` única
  por usuario/orden. Reintentar con la misma clave y el mismo payload devuelve
  el resultado original; con otro payload devuelve 409.
- **Listas:** paginadas con `limite`/`desde` (offset) donde aplica; las
  respuestas vacías devuelven arrays `[]`, nunca 404.
- **Multipart:** comprobantes de pago se suben por API
  (`POST /api/v1/tienda/pagos/{pagoId}/comprobante`, campo `file`), máximo
  5 MiB, con detección real de contenido (JPEG/PNG/WebP). Nunca se suben a
  MinIO directamente desde el cliente.

## 4. Flujo de compra y descarga (QR/transferencia manual)

Estados de la máquina de estados (los strings exactos viajan en los JSON):

- **Orden:** `pending` → `paid` | `cancelled` | `expired` (vence a las 48 h).
- **Pago:** `awaiting_evidence` → `in_review` → `confirmed` | `rejected`.
  Un segundo intento sobre la misma orden es posible si el primero se
  rechazó; **una sola confirmación por orden** (garantía de base de datos).
- **Entitlement (acceso):** `vigente` | `revocado` | `vencido`. Solo el
  backend lo concede (la aprobación del pago lo crea, idempotente); subir un
  archivo nunca activa acceso.

```bash
GET  /api/v1/tienda/ofertas                     # catálogo de ofertas vigentes
GET  /api/v1/tienda/planes                      # planes Premium activos (beneficios publicados)
POST /api/v1/tienda/ordenes                     # {oferta_id, idempotency_key, coupon_code?}
GET  /api/v1/tienda/ordenes/{id}                # orden propia + intentos de pago
POST /api/v1/tienda/ordenes/{id}/pagos          # {proveedor: qr|transfer, monto_minor, idempotency_key}
POST /api/v1/tienda/pagos/{pagoId}/comprobante  # multipart file (≤5 MiB, imagen real)
POST /api/v1/tienda/canjes                      # {codigo, idempotency_key} → canje sin pago
GET  /api/v1/mis-compras                        # compras + accesos + suscripciones + premium_activo
GET  /api/v1/mis-compras/accesos/{id}/descarga  # URL firmada breve del master
```

La descarga exige entitlement vigente y pertenecer al usuario; devuelve
`url` + `expira_en` (`S3_PRESIGN_TTL`, default 15 min). Al expirar, se pide
otra. La revocación staff (`POST /api/v1/staff/accesos/{id}/revocar`) corta
el acceso de inmediato (la siguiente descarga da 403).

### 4.1 Cupones

El cliente solo envía el `coupon_code` al crear la orden. El backend valida
vigencia, límites total/por usuario, moneda y monto mínimo, y calcula
`subtotal_minor`, `descuento_minor` y `total_minor`. Nunca se persisten
totales cero o negativos: un cupón que dejaría el total en cero se rechaza
con 422. El `idempotency_key` conserva oferta y cupón: reutilizarlo con otro
cupón devuelve 409.

- Cupón inexistente → 404; vencido/inactivo/agotado/límite por usuario → 409;
  mínimo no alcanzado o moneda distinta → 422.

### 4.2 Premium (períodos, no descargas)

`POST /tienda/ordenes` sobre una oferta premium congela el plan en el
snapshot; tras el pago y la aprobación staff, el backend crea la
**suscripción** (`grant_source=purchase`) con la duración congelada, aunque
el plan se edite después, y extiende el período vigente si existe. `GET /mis-compras` devuelve `suscripciones` (inicio/fin, estado
`activa|vencida|revocada`, origen) y `premium_activo` calculado por tiempo
actual. **Premium jamás crea entitlements de audio ni licencias**: la
descarga con el id de una suscripción devuelve 404.

### 4.3 Paquetes de audio (snapshot congelado)

Un producto `album`/`catalog` entrega sus `product_items` publicados. El
snapshot de la orden congela las pistas y sus archivos
(`content_snapshot.pistas` + `include_future_tracks`). Con
`include_future_tracks=false` (sembrado por defecto) la aprobación entrega
**exactamente** las pistas congeladas: una pista agregada al producto
después de crear la orden no recibe acceso. Con `true`, la aprobación
entrega el contenido publicado vigente del producto. Doble compra o compra
+ canje del mismo paquete no duplican accesos vigentes.

### 4.4 Códigos de canje

`POST /tienda/canjes` con `{codigo, idempotency_key}`: sin crear pago, el
código vigente concede un período Premium (suscripción con
`grant_source=redemption`) o los entitlements del paquete, y congela lo
entregado en la respuesta (`contenido`). El mismo usuario no canjea dos
veces el mismo código: el reintento devuelve `ya_canjeado=true` sin consumir
otro uso ni duplicar efectos; la clave de cliente tampoco se reutiliza con
otro código (409). Código inexistente → 404; vencido/inactivo/agotado → 409.

### 4.5 Licencias y permisos adicionales por pista (Sprint 3C.2)

Los permisos de uso (`practica`, `interpretacion`, `grabacion_vocal`,
`publicacion`, `monetizacion`) se adquieren exclusivamente como complementos
del audio base dentro de la misma orden. No existen licencias independientes
ni compra de licencias sin el audio de la pista correspondiente.

- **Consulta pública:** `GET /api/v1/tienda/pistas/{id}/licencias` informa si la
  pista es elegible (`elegible: true/false`), las opciones habilitadas con su
  precio y moneda, y los términos vigentes versionados del artista. Pista no
  publicada → 404; pista sin opciones habilitadas → `elegible: false` y
  `opciones: []`.
- **Creación de orden:** `POST /api/v1/tienda/ordenes` admite
  `licencias: ["<track_license_option_id>", ...]` y `acepta_terminos: true`.
  - La pista de cada opción debe pertenecer al contenido de la oferta (422 si
    está fuera de contenido).
  - Opciones duplicadas en la orden o sin aceptar términos → 422.
  - Las ofertas Premium no admiten licencias complementarias → 422.
  - Cada licencia se registra como un `order_item` independiente con su propio
    `license_snapshot` congelado (`track_id`, `use_code`, `add_on_amount_minor`,
    `currency`, `terms_version_id`, `terms_label`, `terms_text`).
  - Se registra una sola fila en `license_acceptances` por orden y versión de
    términos.
  - La clave de idempotencia (`idempotency_key`) protege la orden completa,
    incluyendo la oferta, el cupón y el set de opciones de licencias.
- **Aprobación del pago:** La aprobación staff (`POST /staff/pagos/{id}/aprobar`)
  ejecuta `ConcederLicencia` de forma transaccional e idempotente para cada
  ítem de licencia de la orden. La restricción única parcial
  (`license_grants_order_item_uidx`) garantiza que dobles aprobaciones no
  dupliquen grants.
- **Efectos estrictamente disjuntos:**
  - Descargar o poseer audio jamás concede licencias de uso.
  - Poseer una suscripción Premium jamás concede licencias ni audio.
  - Una licencia **jamás** otorga descarga de audio master:
    `GET /mis-compras/accesos/{id}/descarga` solo admite identificadores de
    entitlements de audio (usar un id de licencia responde 404).
- **Consulta de compras:** `GET /api/v1/mis-compras` devuelve la sección
  `licencias: []` con los grants del usuario, informando pista, uso, términos
  aceptados, fecha de otorgamiento y estado (`vigente` o `revocado`).
- **Gestión staff:**
  - `GET /api/v1/staff/licencias?usuario=&pista=`: lista los grants con filtros.
  - `POST /api/v1/staff/licencias/{id}/revocar`: revoca la licencia con motivo
    auditado (`licencia.revocada`). La revocación es idempotente y no altera el
    acceso de descarga de audio del usuario.

## 5. Autorización por artista (member / manager)

Los roles por artista viven en `artist_members` y **son independientes** de
los roles staff. Un usuario puede ser member de varios artistas y staff a la
vez; la API valida el alcance por `artist_id` en cada query y mutación.

| Rol | Lectura | Mutación | Alcance |
|---|---|---|---|
| `member` | canciones y contenido (ChordPro incluido) de **sus** artistas, con independencia del nivel de acceso del catálogo (`free`/`premium`/`purchase`) | **ninguna** (403) | solo artistas donde es miembro |
| `manager` | idéntica a member | ficha del artista, álbumes, canciones, publicación y membresías (member/manager) de **sus** artistas | solo artistas donde es manager |

Reglas de códigos: quien no es miembro del artista recibe **404** (no se
revela la existencia del artista); quien es member pero intenta mutar recibe
**403**. Los managers asignan roles desde la API (auditoría `rol.asignado` /
`rol.revocado` con `source=api`); el arranque del primer manager es operación
SQL (`make db-artist-role`).

```bash
GET    /api/v1/mis-artistas                                  # mis membresías + rol
GET    /api/v1/mis-artistas/{artistId}                       # ficha + álbumes + canciones
GET    /api/v1/mis-artistas/{artistId}/canciones/{songId}    # canción con ChordPro
PATCH  /api/v1/mis-artistas/{artistId}                       # manager: bio/país/redes/portada
POST   /api/v1/mis-artistas/{artistId}/albumes               # manager: crear álbum
PATCH  /api/v1/mis-artistas/{artistId}/albumes/{albumId}     # manager: actualizar álbum
POST   /api/v1/mis-artistas/{artistId}/canciones             # manager: crear canción
PATCH  /api/v1/mis-artistas/{artistId}/canciones/{songId}    # manager: actualizar/publicar
POST   /api/v1/mis-artistas/{artistId}/miembros              # manager: {email, member_role}
DELETE /api/v1/mis-artistas/{artistId}/miembros/{userId}     # manager: quitar membresía
GET    /api/v1/mis-artistas/{artistId}/licencias             # member/manager: perfil, opciones y términos
PUT    /api/v1/mis-artistas/{artistId}/licencias/perfil      # manager: actualizar perfil predeterminado
PUT    /api/v1/mis-artistas/{artistId}/pistas/{trackId}/licencias/{useCode} # manager: configurar opción por pista y uso
POST   /api/v1/mis-artistas/{artistId}/terminos-licencia     # manager: publicar nueva versión de términos (append-only)
```

Decisiones documentadas: las lecturas devuelven solo contenido **publicado**
(las mutaciones sobre borradores se hacen por id; la visibilidad de borradores
llegará con el panel); el detalle de canción entrega el ChordPro porque la
membresía es la autorización, no el tipo de acceso público. La pista en la
configuración de licencias debe pertenecer al artista de la ruta (o 404). Los
términos son inmutables (publicar crea una nueva versión sin sobreescribir la
anterior).

## 6. Dispositivos

Registro de instalaciones por API (un usuario puede tener varios). **No se
guardan refresh tokens ni secretos**; la relación queda lista para atar en
Fase 4 las licencias offline y los tokens push.

```bash
PUT  /api/v1/dispositivos                        # alta/refresco: {install_id, platform, app_version, device_name}
GET  /api/v1/dispositivos                        # mis dispositivos con estado
POST /api/v1/dispositivos/{installId}/heartbeat  # marca actividad (puede refrescar app_version)
POST /api/v1/dispositivos/{installId}/revocar    # revocación propia (idempotente)
GET  /api/v1/staff/dispositivos?usuario=         # staff (admin|vendedor)
POST /api/v1/staff/dispositivos/{id}/revocar     # staff: {motivo} + auditoría
```

- `install_id`: identificador estable **generado por el cliente** por
  instalación (8–128 chars, único por usuario). Una reinstalación real genera
  uno nuevo.
- `platform`: `android | ios | windows | macos | linux | web`.
- Estados: `activo | revocado`. Un dispositivo revocado no acepta heartbeat
  ni re-registro (409): la revocación no se deshace desde el cliente.
- El endpoint propio opera por `install_id`; el staff opera por UUID interno.

## 7. Matriz de permisos por rol

| Recurso | anónimo | usuario autenticado | member | manager | editor | vendedor | admin |
|---|---|---|---|---|---|---|---|
| health/ready, himnario, catálogo, tienda ofertas/planes/pistas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| tienda licencias por pista (`GET /tienda/pistas/{id}/licencias`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| me, órdenes/pagos/mis-compras/canjes propios | — | ✓ (solo propios) | ✓ | ✓ | ✓ | ✓ | ✓ |
| descarga firmada de audio | — | ✓ (con entitlement vigente) | ✓ | ✓ | ✓ | ✓ | ✓ |
| mis-artistas lectura (catálogo y licencias) | — | — (solo sus artistas) | ✓ | ✓ | — | — | — |
| mis-artistas mutación (catálogo y licencias) | — | — | — (403) | ✓ (sus artistas) | — | — | — |
| staff pagos/accesos | — | — | — | — | — (403) | ✓ | ✓ |
| staff licencias (listar y revocar) | — | — | — | — | — (403) | ✓ | ✓ |
| staff dispositivos | — | — | — | — | — (403) | ✓ | ✓ |
| staff auditoría | — | — | — | — | — (403) | ✓ | ✓ |
| staff planes/cupones/canjes | — | — | — | — | — (403) | ✓ | ✓ |

Los roles staff se asignan solo por SQL (`make db-staff`) y los por-artista
desde la API por un manager (o `make db-artist-role` de arranque). Los claims
del token **nunca** autorizan por sí solos.

## 8. Tabla de endpoints por titularidad

| Área | Endpoints | Titular |
|---|---|---|
| Sistema | `GET /health`, `GET /ready` | público |
| Contenido | `GET /himnario/*`, `GET /catalogo/*`, `GET /tienda/ofertas`, `GET /tienda/planes`, `GET /tienda/pistas/{id}`, `GET /tienda/pistas/{id}/licencias` | público |
| Cuenta | `GET /me` | autenticado |
| Tienda | `POST /tienda/ordenes`, `GET /tienda/ordenes/{id}`, `POST /tienda/ordenes/{id}/pagos`, `POST /tienda/pagos/{id}/comprobante`, `POST /tienda/canjes`, `GET /mis-compras`, `GET /mis-compras/accesos/{id}/descarga` | autenticado (solo propios; 404 ajeno) |
| Por artista | `GET|PATCH /mis-artistas…`, `GET|PUT /mis-artistas/{id}/licencias…`, `POST /mis-artistas/{id}/terminos-licencia` | member/manager del artista (mutación: manager) |
| Dispositivos | `PUT|GET /dispositivos`, `POST …/{installId}/heartbeat|revocar` | autenticado (solo propios) |
| Staff | `GET /staff/pagos`, `GET /staff/pagos/{id}`, `POST …/aprobar|rechazar`, `GET|POST /staff/accesos…`, `GET|POST /staff/licencias…`, `GET /staff/auditoria`, `GET /staff/dispositivos`, `POST /staff/dispositivos/{id}/revocar`, `GET|POST /staff/planes`, `PATCH /staff/planes/{id}`, `GET|POST /staff/cupones`, `PATCH /staff/cupones/{id}`, `GET|POST /staff/canjes`, `GET|PATCH /staff/canjes/{id}` | staff (admin+vendedor) |

## 9. Verificación y pruebas

La colección Bruno (`bruno/`) ejecuta el contrato completo contra el sistema
real: 150 requests, 75 tests y 359 aserciones en verde tras reset desde cero
(y en re-ejecución repetible), cubriendo los flujos 3A, 3B, 3C.1 y 3C.2:
compra de audio con licencias adicionales y cupón, aprobación transaccional
e idempotente que concede entitlements y license grants sin duplicar,
inmutabilidad de términos con snapshot congelado, consulta en `/mis-compras`,
aislamiento de descarga (404 al intentar descargar licencias), revocación
independiente staff con auditoría, y administración por artista con roles
member y manager. Las mutaciones manager/staff y su auditoría comparten
transacción; el último manager no puede eliminarse y el heartbeat revocado
no modifica actividad. Ver `docs/development/` para el entorno y
`services/api/README.md` para el código.
