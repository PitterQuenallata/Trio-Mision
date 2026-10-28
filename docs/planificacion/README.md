# Plan general — Trio Misión v2

> **Estado:** plan maestro de trabajo. Define el orden de construcción del
> ecosistema v2. Los requerimientos detallados están en
> [`docs/alcance/`](../alcance/) y las decisiones técnicas en
> [`docs/decisions/`](../decisions/).
>
> Estado de avance por sesión: [`CURRENT_TASK.md`](../../CURRENT_TASK.md).

## 0. Cómo trabajamos

- **Una fase a la vez.** No se abre la siguiente hasta cerrar los criterios de
  salida de la actual.
- **CURRENT_TASK.md** registra la tarea activa, sus criterios de terminado y la
  cola de lo que sigue. Se actualiza cada sesión.
- **Decisiones** que afecten arquitectura o stack se documentan como ADR en
  `docs/decisions/` antes o junto con el código.
- **Desarrollo local**: Docker Compose solo para infraestructura (PostgreSQL,
  luego GoTrue y MinIO). Los servicios Go corren nativos (`go run`) en desarrollo.
- **Verificación**: cada entrega debe compilar, pasar tests y demostrar el
  escenario real (endpoint llamado, flujo ejecutado), no solo "estar escrita".

## 1. Fases

### Fase 0 — Documentación ✅ (completada 2026-10-26)

- [x] Alcance y requerimientos del sistema: `docs/alcance/README.md`
- [x] Plan general: este documento
- [x] ADR 0002: stack de la API (chi + Huma + pgx + golang-jwt)

### Fase 1 — API: fundamentos ✅ (completada 2026-10-26)

Esqueleto del monolito modular en `services/api/`.

- Router chi, OpenAPI con Huma (Swagger UI en `/docs`), versionado `/api/v1`.
- Conexión PostgreSQL con pgx (pool), config por variables de entorno.
- Auth: middleware que valida JWT de GoTrue (HS256, audiencia).
- Endpoints: `GET /api/v1/health`, `GET /api/v1/ready`, `GET /api/v1/me`.
- Tests unitarios + test HTTP del servidor; graceful shutdown; logs JSON.
- **Criterio de salida**: build y tests en verde; health/ready/me funcionando
  contra PostgreSQL real; Swagger UI navegable; ADR 0002 escrito.

### Fase 2 — API: modelo de datos y base de negocio ✅ (completada 2026-10-27)

- Herramienta de migraciones y migraciones iniciales en `database/migrations/`
  (modelo adaptado del `supabase/schema.sql` de la v1: perfiles, roles, catálogo,
  himnario).
- Módulos `profiles` (perfil y roles admin/editor/vendedor) y
  `catalog`/`himnario` de solo lectura. Los dispositivos no viven en `profiles`:
  se registran en Fase 4 junto con la sincronización y las descargas offline.
- Seed de desarrollo con el contenido de `content/himnario/`.
- **Criterio de salida**: la app/panel podrían leer el himnario y el catálogo
  público desde la API; migraciones reproducibles desde cero.

### Fase 3 — API: tienda, pagos, audio y permisos

Alcance total: módulos `store`, `payments`, `tracks`/`media`/`licenses` y
`services`/`support`; almacenamiento S3 y portal web. GoTrue y el login real ya se
adelantaron y cerraron con la Fase 2. Los PDFs personales permanecen en el dispositivo.

Orden de entrega:

1. **3A — Flujo vertical de compra por API** ✅ (completado y endurecido):
   - Tienda, órdenes atómicas, pagos manuales idempotentes, un solo confirmado
     por orden, entitlements, auditoría y descarga firmada.
   - Cuentas PostgreSQL separadas con privilegios mínimos; API sin acceso a
     `auth`; auditoría append-only para la API; MinIO sin credenciales root.
   - Comprobantes multipart autenticados de máximo 5 MiB, con titularidad y
     detección real de MIME. API 0.5.0; Bruno 34/34 y 77/77 tras reset.
2. **3B — API pura para clientes, staff, artistas y dispositivos** ✅
   (completado y endurecido; **sin construir UI**):
   - Contratos estabilizados (0.6.1), autorización por artista y dispositivos.
   - Mutaciones manager y auditoría en la misma transacción; último manager
     protegido; heartbeat revocado sin modificar actividad.
   - Bruno 67/67 requests, 39/39 tests y 142/142 aserciones tras reset.
3. **3C — Comercio, licencias y soporte** (solo API; detalle en
   `CURRENT_TASK.md`):
   - **3C.1 — Premium, paquetes, cupones y canjes** ✅ (completado y
     endurecido; **sin construir UI**):
     - Períodos de suscripción (planes con duración y beneficios) que extienden
       el vigente; `premium_activo` calculado por tiempo; Premium nunca crea
       audio descargable ni licencias.
     - Productos `premium` y paquetes multi-pista con `include_future_tracks`;
       órdenes con snapshot congelado y totales calculados en backend
       (cupones fijos/porcentuales, jamás totales negativos).
     - Códigos de canje con vigencia/límites/idempotencia y trazabilidad, sin
       pago; aprobación de pagos generalizada con efectos únicos por ítem.
       API 0.7.1 (snapshots e idempotencia concurrente endurecidos); Bruno
       118/118, 63/63 tests y 277/277 aserciones tras reset
       (y en re-ejecución).
   - **3C.2 — Licencias adicionales por pista:** perfiles por artista, opciones
     elegibles, versiones de términos, grants y snapshots de usos aceptados.
     No ofrecer permisos sin derechos suficientes ni asumirlos al descargar.
   - **3C.3 — Servicios y soporte:** solicitudes/cotizaciones/proyectos/entregas
     de composición-producción; tickets y mensajes de pagos, descargas, permisos
     y reclamos YouTube, con adjuntos privados y autorización titular/staff.
   - S3 para portadas/PDFs editoriales según necesidad; Binance y otros
     proveedores quedan para después. Cada subfase exige migraciones nuevas,
     OpenAPI/Bruno, pruebas reales, guía de integración y cero UI.

**Criterio de salida**: la API cubre y documenta los flujos acordados, con un
usuario capaz de comprar y descargar tras aprobación staff, permisos por artista
y dispositivos verificados. Cada entrega exige build/tests, OpenAPI, Bruno y
escenario real; las interfaces gráficas se integran posteriormente, sin lógica
de negocio duplicada.

### Fase 4 — Worker, sincronización y notificaciones

- Cola de tareas + `services/worker`: conversión PDF→ChordPro en servidor.
- Sync incremental del catálogo (cursor + tombstones) y licencias de descarga
  offline con vencimiento.
- Registro de `devices` por usuario: un usuario puede tener varios
  dispositivos y su ciclo de vida sigue al sync, no al perfil.
- FCM: tokens de dispositivo, envío desde el backend, limpieza de tokens.
- **Criterio de salida**: importación de un PDF procesada por el worker con
  seguimiento desde la API; sync delta verificado; push recibido en dispositivo
  de prueba.

### Fase 5 — Clientes v2 y producción

- `apps/admin` (panel v2) consumiendo la API.
- `apps/mobile` (app v2 Flutter) con offline-first sobre la API.
- Endurecimiento: rate limiting, auditoría, pruebas de carga y seguridad.
- Despliegue: VPS, proxy HTTPS, backups verificados, monitoreo.
- **Criterio de salida**: flujo completo en producción (registro → premium →
  catálogo offline → compra de pista) y runbook de operación.

## 2. Dependencias y orden

```
Fase 0 (docs)
  └─ Fase 1 (API fundamentos)
       └─ Fase 2 (modelo de datos)  ← desbloquea catálogo/himnario
            └─ Fase 3 (tienda + pistas + portal web)  ← requiere S3 y GoTrue
                 └─ Fase 4 (worker + sync + FCM)
                      └─ Fase 5 (clientes v2 + producción)
```

La web pública (`apps/web`) evoluciona en paralelo: completar los 6 álbumes
faltantes y conectar los CTAs al portal cuando la Fase 3 lo habilite.

## 3. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Migrar el modelo Supabase de v1 sin arrastrar deuda (RLS, hooks, RPCs) | Modelar desde cero en `database/migrations/` usando el schema v1 solo como referencia funcional |
| GoTrue autohospedado es una dependencia operativa seria | Fijar versión, documentar config, probar recuperación antes de producción |
| Venta de pistas exige proteger archivos de audio | URLs firmadas con vencimiento; nunca servir audio sin entitlement verificado por la API |
| Pagos manuales no escalan | Diseñar `payment_providers` para enchufar pasarela sin rehacer el flujo (ver `docs/payments/`) |
