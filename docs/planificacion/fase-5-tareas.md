# Fase 5 — Tareas: clientes v2 y producción

> Estado al 2026-11-09. Orden de trabajo sugerido. Marcar con [x] al cerrar.
> Ramas pendientes de fusionar a `main` en este orden: `sprint-4c-push-fcm` →
> `api-rate-limit` → `docs-estructura-apps` (incluye las anteriores) y luego
> `apps-admin-scaffold` (sale de `main`).

## 0. Bloqueos que dependen del dueño del proyecto

- [ ] **Configuración web de Firebase** para la página de prueba de push:
      `apiKey`, `messagingSenderId`, `appId`, `projectId` y la clave VAPID
      pública (Cloud Messaging → Configuración web). Sin esto, el envío real a
      un teléfono (criterio de salida de la Fase 4) queda abierto.
- [ ] **Hosting y dominio** cuando se decida el despliegue (VPS, dominio HTTPS).

## 1. Integración y limpieza previa

- [ ] Fusionar las ramas pendientes a `main` (ver orden arriba) y verificar que
      `make api-test`, `make worker-test` y `pnpm build` en `apps/admin` siguen en verde.
- [ ] Repetir la colección Bruno tras reset desde cero (288 requests esperadas).

## 2. Endurecimiento antes de desplegar

- [ ] Cabeceras de seguridad de la API (HSTS, `X-Content-Type-Options`,
      `Referrer-Policy`, `Content-Security-Policy` para las respuestas HTML de Swagger).
- [ ] CORS: lista explícita de orígenes (panel admin, portal `appweb`, sitio web).
- [ ] Confianza en `X-Forwarded-For` solo desde el proxy del VPS (variable de
      configuración con la IP del proxy; por defecto no confiar).
- [ ] Medir lecturas pesadas (sync completo del catálogo, listados grandes) con k6
      y ajustar límites con datos (`loadtest/`).
- [ ] Revisar el límite por usuario/IP con tráfico real después del despliegue.

## 3. Panel admin (`apps/admin`, plantilla blakor-admin-pro)

Estado al 2026-11-09. Orden acordado con el dueño.

### Hecho
- [x] Login con GoTrue, sesión persistente, cierre por inactividad y guard por rol.
- [x] Cliente de API tipado (`openapi-fetch` + `openapi-typescript`, `pnpm api:types`).
- [x] Dashboard con KPIs reales (pagos en revisión, licencias, tickets, solicitudes).
- [x] Usuarios: alta de cuentas staff, roles, vinculación de managers, matriz de permisos en modal.
- [x] Grupos (API 0.17.0 y panel): alta con portada, ficha con pestañas, configuración de venta de pistas con comisión 5–10 %, miembros (vincular como member o manager, cambiar rol, desactivar/reactivar, desvincular).
- [x] Discografía (API 0.19.0 y panel): álbumes, EP y sencillos; canciones con editor ChordPro y vista previa; orden; publicar por lanzamiento y por canción; asistente de nuevo lanzamiento.
- [x] Venta de pistas (API 0.20.0 y panel): canciones solo gratis o Premium; pista vinculada a una canción con precio; solo grupos habilitados; la tienda oculta y rechaza pistas de grupos no habilitados.

### Siguiente, en orden
- [ ] **Mi grupo del manager:** la misma discografía y ficha que el admin, sin la pestaña de configuración de ventas. Hoy sigue la pantalla anterior.
- [ ] **Audio de la pista:** subir el master desde la ficha de la pista (la API ya tiene `POST …/pistas/{trackId}/master`; falta la pantalla).
- [ ] **Prueba de compra de pista de punta a punta:** orden, pago manual, aprobación y descarga, con un grupo habilitado.
- [ ] **Himnario e importación de PDF:** recuperar la experiencia de la v1 (conversión automática con marcas "revisar", revisión y edición por canción antes de publicar, subida real al servidor). Hoy la API ya convierte y publica borradores; falta la pantalla y permitir editar datos por canción antes de publicar.
- [ ] **Servicios por encargo:** detalle de solicitud para staff (referencias, cotización, pago y proyecto), listado de proyectos y comprobantes de pagos de servicio.
- [ ] **Soporte:** tickets por estado y categoría, detalle con mensajes y adjuntos privados, cambio de estado.
- [ ] **Auditoría:** tabla con filtros (acción, actor, fechas) y detalle.
- [ ] **Licencias, cupones y ofertas (staff):** listado de licencias vigentes y revocadas; alta y edición de cupones; ofertas de lanzamiento y tipo Black Friday por fechas, sin código (hoy solo hay lectura pública).
- [ ] **Pagos manuales y suscripciones (casi al final):** registro de pago en persona por staff que concede el acceso igual que un pago aprobado; planes mensual, trimestral y anual; suscripción de usuario.
- [ ] **Reclamación de membresía de grupo:** el usuario reclama desde appweb con evidencia; revisión y concesión de Premium solo para ese grupo. Pendiente de definir quién revisa (manager, admin o ambos) y si caduca.
- [ ] **Pendiente de decisión:** cómo se habilita a un grupo nuevo para vender pistas, si no hay suscripción de grupo (hoy, decisión manual del admin).
- [ ] **Verificación:** recorrido en navegador de login, roles, grupos, discografía y venta; smoke test por dominio contra la API local.

### Después de producción
- [ ] Pasarelas de pago: Google Play y una pasarela internacional.

## 4. Panel de usuario (`apps/appweb`, portal con login para suscriptores)

- [ ] Elegir stack (propuesta: mismo que admin, React + Vite + TypeScript) y crear la base.
- [ ] Login, mis compras, descargas, licencias y biblioteca, cuenta.
- [ ] Mostrar solo lo que el usuario puede usar según su suscripción y accesos.

## 5. APK (`apps/mobile`, Flutter)

- [ ] Configurar Flutter y el proyecto; login con GoTrue.
- [ ] Sync incremental del catálogo y cache local (offline-first).
- [ ] Descargas offline con licencia de 30 días y renovación.
- [ ] Registro de dispositivo y token push FCM (API ya lista).
- [ ] Prueba en teléfono real: push recibido (cierra el criterio de Fase 4).

## 6. Sitio del grupo (`apps/web`)

- [ ] Completar los 6 álbumes faltantes (según planificación).
- [ ] Sección de referencia al sistema que enlace a `apps/appweb`.
- [ ] Decidir cuál copia es la oficial (`apps/web` o `blakor/trio-mision-page-web`).

## 7. Despliegue y operación (criterio de salida de la fase)

- [ ] VPS con HTTPS (proxy), variables de entorno fuera del repo.
- [ ] Backups de PostgreSQL y restauración verificada.
- [ ] Monitoreo y alertas básicas.
- [ ] Runbook de operación.
- [ ] Flujo completo en producción: registro → Premium → catálogo offline → compra de pista.
