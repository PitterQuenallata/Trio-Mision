# Fase 5 — Tareas: clientes v2 y producción

> Estado al 2026-11-08. Orden de trabajo sugerido. Marcar con [x] al cerrar.
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

- [ ] Login con GoTrue (`VITE_GOTRUE_URL`), guardar sesión, cerrar sesión,
      renovación de token y guard de rutas por rol (`/api/v1/me`).
- [ ] Cliente de API tipado por dominio, con tipos generados desde `/openapi.json`.
- [ ] Dashboard con KPIs reales (pagos, licencias, soporte).
- [ ] Usuarios y staff (roles) conectados a la API.
- [ ] Pagos: listar, ver comprobante privado, aprobar o rechazar (staff).
- [ ] Licencias de audio y configuración comercial (planes, cupones, canjes).
- [ ] Catálogo: artistas, álbumes y canciones (member solo lectura, manager edita).
- [ ] Himnario (lectura) e importación de PDF: subir, revisar, publicar borradores, reintentar.
- [ ] Servicios por encargo: solicitudes, cotización, proyecto y entregas.
- [ ] Soporte y auditoría.
- [ ] Quitar el selector de emojis de la plantilla (las guías de la plantilla lo prohíben).
- [ ] Pruebas: al menos un smoke test por dominio contra la API local.

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
