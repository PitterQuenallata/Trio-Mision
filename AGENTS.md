# Trio Misión — guía para agentes

## Antes de trabajar

1. Leer `CURRENT_TASK.md` para conocer la fase y la siguiente tarea.
2. Consultar `docs/alcance/README.md` para el alcance acordado y
   `docs/planificacion/README.md` para el orden de entrega.
3. Para base de datos, usar `docs/architecture/modelo-datos-v2.md` como diseño
   vigente. El alcance comercial ya está acordado; no reabrirlo salvo solicitud.
4. No asumir que una herramienta o servicio no está disponible por notas históricas:
   comprobar el estado actual con comandos.

## Entorno de desarrollo

- Docker está instalado y se usa para la infraestructura.
- PostgreSQL 16 se levanta con Docker Compose; la API Go corre como proceso nativo.
- La configuración vive en el `.env` de la raíz. No leer ni mostrar secretos.
- Puerto de la API: `8080`; PostgreSQL: `5432`.

```bash
make up             # infraestructura Docker
docker compose ps   # comprobar contenedores
make db-migrate     # migraciones goose
make db-seed        # seed idempotente
make api-run        # API en http://localhost:8080
make api-test       # tests de la API
make api-build      # compilación
```

`ECONNREFUSED 127.0.0.1:8080` normalmente indica que falta `make api-run`, no que
Docker o PostgreSQL estén ausentes. Verificar con
`curl http://127.0.0.1:8080/api/v1/health`.

## Estado actual

- Fases 0, 1 y 2 completadas; Sprint 3A de Fase 3 completado (2026-10-27).
- **Sprint 3B de Fase 3 completado** (2026-10-27): API pura 0.6.1, migración
  00015 (`devices`), autorización por artista (member/manager sobre
  `artist_members`, con `authz.RequireArtistRole`), registro de dispositivos,
  seed con segundo artista y canción premium, `make db-artist-role` y guía
  de integración (`docs/development/integracion-api.md`). Bruno 67/67 tras
  reset desde cero. Los clientes (APK, web, paneles) se integran después
  contra estos contratos; no se construyó ni modificó UI.
- **Sprint 3C.1 de Fase 3 completado** (2026-10-27): API pura 0.7.1,
  migraciones 00016-00020 (planes/suscripciones Premium, productos premium
  y `include_future_tracks`, cupones con totales calculados en backend,
  códigos de canje con idempotencia y trazabilidad), aprobación
  generalizada (período Premium o entitlements del snapshot, sin duplicar),
  canjes sin pago, `/mis-compras` con suscripciones y `premium_activo`, y
  endpoints staff de planes/cupones/canjes con auditoría. Seed: Premium 30
  días, paquete de dos pistas, cupón y códigos de canje. Bruno 118/118
  requests, 63/63 tests y 277/277 aserciones tras reset desde cero, en
  verde también en re-ejecución.
- **Sprint 3C.2 de Fase 3 completado** (2026-10-28): API pura 0.8.0,
  migraciones 00021 y 00022 (perfiles y opciones de licencias, términos
  versionados append-only, aceptaciones registradas por orden y grants
  congelados), permisos como complementos de audio en la misma orden con
  snapshot congelado `license_snapshot`, aprobación staff transaccional e
  idempotente (`license_grants_order_item_uidx`), `/mis-compras` con
  `licencias []`, efectos disjuntos garantizados (descargar audio no concede
  licencias; Premium tampoco; una licencia nunca permite descarga de
  master), administración por artista (member lee, manager actualiza perfil,
  opciones por pista y publica términos inmutables), endpoints staff para
  listar y revocar licencias con auditoría (sin alterar descargas de audio),
  51 paths OpenAPI y Bruno 150/150 requests, 75/75 tests y 359/359 aserciones
  en verde tras reset desde cero y en re-ejecución repetible.
- Fase 2 incluye migraciones (6), seed, himnario, catálogo de solo lectura y
  GoTrue en `compose.yaml` con login real de extremo a extremo
  (signup → token → `/api/v1/me`, perfil creado en el primer request).
- Sprint 3A agrega migraciones hasta 00014, tienda/pagos/descargas, módulos
  `store` y `staff`, MinIO y colección Bruno. La idempotencia es por orden y
  una orden admite un solo pago confirmado.
- Seguridad: cuentas PostgreSQL separadas (`DB_ADMIN_URL`, API y GoTrue), API
  sin acceso a `auth`, auditoría append-only para la API, MinIO sin credenciales
  root y comprobantes multipart de máximo 5 MiB con MIME detectado por contenido.
- `member` solo lee contenido de sus artistas en el panel; `manager` administra
  únicamente sus artistas. Cliente PC y APK comparten API/cuenta; el registro
  de dispositivos se adelantó a 3B (alta/heartbeat/revocación, sin tokens) y
  sync offline/FCM quedan en Fase 4.
- Premium nunca concede audio descargable ni licencias: se calcula por
  períodos de suscripción; los paquetes congelan su contenido en el snapshot
  de la orden (`include_future_tracks=false`).
- **Revisión del Sprint 3C.2 completada** (2026-11-01): se corrigieron campos
  duplicados en el contrato staff de licencias (`licencias_creadas` y
  `revocada_en` de la revocación retirados; quedan `licencias_creados` y
  `revocado_en`). API pura 0.8.1; Bruno 150/150, 75/75 y 359/359 en verde.
- **Sprint 3C.3 de Fase 3 completado** (2026-11-01): API pura 0.9.0,
  migraciones 00023 y 00024 (`service_requests`/`service_quotes`/
  `service_projects`/`service_deliverables`/`service_payments` y
  `support_tickets`/`support_messages`), módulos `servicios` y `soporte`, y
  subida de master por manager (`POST /mis-artistas/{artistId}/pistas/{trackId}/master`,
  audio ≤ 100 MiB por contenido). El catálogo de
  `entitlements.grant_source` incluye ahora `'service'` (drop/add del
  constraint en 00023). Flujo de servicios completo (solicitud idempotente →
  cotización staff → aceptación con proyecto congelado → comprobante →
  aprobación sin efectos de acceso → entregas con URL firmada → entrega de
  pista con entitlement `grant_source=service` que se descarga por la vía
  existente) y soporte (tickets por categoría, mensajes con adjuntos privados,
  reclamos YouTube con URL/claim, estados staff). Los servicios jamás crean
  Premium ni licencias. OpenAPI 71 paths; Bruno 213/213 requests, 98/98 tests
  y 484/484 aserciones en verde tras reset desde cero y en re-ejecución.
  Hallazgo corregido en el camino: el seed usaba `ON CONFLICT DO UPDATE`
  sobre `license_terms_versions` (append-only sin UPDATE para la API) y
  exigía privilegio que la cuenta no tiene; ahora `DO NOTHING`. Tras
  `make db-reset`, el orden es migraciones+seed → restart de GoTrue →
  signups de la colección → `make db-staff`/`db-artist-role`.
- API actual: versión 0.9.0.
- **Revisión del Sprint 3C.3 completada** (2026-11-01): correcciones de
  contrato y migración 00025 (`service_payments_in_review_uidx`); verificado
  de forma independiente con Bruno 213/213, 98/98 y 484/484 tras reset.
- Siguiente tarea: Fase 4 en tres sprints (4A sync + descargas offline, 4B
  worker PDF→ChordPro, 4C FCM). Plan detallado de 4A listo en
  `CURRENT_TASK.md` (sección "Siguiente tarea — Fase 4").

## Convenciones

- API: monolito modular Go, chi, Huma, pgx/v5 y golang-jwt/v5.
- Módulos en `services/api/internal/modules/<dominio>/` con registro en el servidor.
- Todo endpoint nuevo o modificado debe documentarse mediante Huma/OpenAPI y tener
  su request actualizado en `bruno/`, incluyendo entorno, autenticación y aserciones
  útiles. Verificar también `/openapi.json` y Swagger UI en `/docs`.
- Migraciones en `database/migrations/`; no modificar migraciones ya aplicadas sin
  acordar una estrategia.
- Actualizar `CURRENT_TASK.md` al cambiar el estado del trabajo y los README
  afectados al cambiar comandos, endpoints o comportamiento.
- Verificar cambios con build/tests, la colección Bruno y el flujo real
  correspondiente contra la API y PostgreSQL.
