# Panel administrativo — Trio Misión

Panel para el staff (admin, editor, vendedor) y los managers de artistas del
ecosistema Trio Misión. Consume la API de `services/api` (contrato en
`docs/development/integracion-api.md`).

## Origen

Parte de la plantilla **blakor-admin-pro** (React + Vite + TypeScript + Tailwind,
TanStack Router, Query, Table y Form). Se quitaron los módulos de demostración
(blog, ecommerce, analítica y tablas de muestra) y las acciones sin datos reales.
La plantilla original conserva el historial (commit `bde2d5d`) por si hace falta
recuperar una sección para conectarla a la API.

## Quién entra y qué ve

Entran al panel solo el **staff** (roles `admin`, `editor`, `vendedor`) y los
**managers** de algún artista. Un **member**, un cliente o un usuario de la APK no
entran: ven la pantalla "Sin acceso al panel".

| Sección | Ruta | Quién la ve |
|---|---|---|
| Panel de control | `/dashboard` (y `/`) | staff y managers |
| Grupos | `/grupos`, `/grupos/:id`, `/grupos/:id/albumes/:albumId`, `/grupos/:id/nuevo` | solo admin: alta, datos, configuración de ventas, discografía (álbumes, EP y sencillos con sus canciones), miembros |
| Mi grupo | `/mi-grupo` | managers (lectura de sus artistas) |
| Usuarios | `/usuarios` | solo admin (incluye la matriz de permisos por rol, en un modal) |

Las reglas viven en `src/shared/auth/permissions.ts`. Es solo interfaz: la API
autoriza en cada endpoint (`staff_roles` y `artist_members`).

### Gestión de cuentas (solo admin)

- **Crear cuenta staff:** correo, nombre opcional, contraseña inicial (mínimo 12)
  y rol. La cuenta se crea confirmada; el administrador entrega la contraseña.
- **Roles staff:** conceder o quitar `admin`, `editor` o `vendedor`. No puedes
  quitarte tu propio admin, y el último admin no se puede quitar.
- **Managers:** vincular un usuario como manager de un artista (o quitarlo). Un
  usuario tiene una sola membresía por artista: si era member, pasa a manager.
  Un manager puede añadir y quitar members de su artista, pero no managers.

## Autenticación

- `src/shared/auth/`: `gotrue.ts` (password, refresh, logout contra GoTrue),
  `session.ts` (almacenamiento) y `auth-context.tsx` (`AuthProvider`, `useAuth`).
- **Persistencia:** el access token vive solo en memoria. El **refresh token** se
  guarda en `localStorage` (clave `trio_admin_refresh`) junto con la última
  actividad, y la sesión se restaura al recargar. Es el compromiso de una SPA: un
  XSS podría leer el refresh token. La opción más segura sería una cookie httpOnly
  emitida por un backend (no existe hoy).
- **Sin registro público:** el panel no tiene pantalla de alta. Las cuentas staff
  las crea el admin desde Usuarios. GoTrue sigue aceptando `/signup` para los
  clientes públicos; el panel no lo expone.
- La identidad (`/api/v1/me`) trae `staff_roles` y `artist_memberships`; el guard
  del router y el menú se calculan con esos datos.
- **Inactividad:** 15 minutos sin interacción cierran la sesión (incluida la
  actividad de otras pestañas). Cerrar sesión en una pestaña cierra las demás.
- **Riesgo conocido:** el logout invalida el refresh token en GoTrue, pero el
  access token (JWT) sigue aceptándose en la API hasta que expira (1 h).
- En producción, el panel debe servirse solo por HTTPS.

## Datos y tipos

- `src/shared/api/client.ts`: cliente `openapi-fetch` con los tipos de
  `src/shared/api/generated/openapi.ts`. Añade `Authorization` y emite
  `blakor:unauthorized` ante un 401. `unwrap(...)` devuelve el dato o lanza
  `ApiError` con el `detail` que devuelve la API.
- `src/shared/api/domains/`: funciones por dominio (`staff`, `usuarios`,
  `artistas`).
- Regenerar tipos tras cambiar la API: `pnpm api:types` (la API debe estar
  arriba). `openapi-typescript` y `openapi-fetch` están fijados a versión exacta.

## Dashboard

Indicadores reales para admin y vendedor: pagos en revisión, licencias vigentes,
tickets abiertos y solicitudes sin cotizar. Son tarjetas informativas; las
secciones de detalle llegan en la siguiente etapa.

## Pendiente (Fase 5, sección 3)

- Catálogo: artistas, álbumes y canciones (el manager edita en "Mi grupo").
- Pagos, licencias, servicios, soporte, importaciones y auditoría: se reintroducen
  como secciones conectadas a la API, cada una con su tabla TanStack.
- Pruebas de interfaz en navegador (login, roles, creación de cuentas).
- Smoke test por dominio contra la API local.

## Desarrollo

```bash
cp .env.example .env.local
pnpm install
pnpm dev          # http://localhost:3000 (reenvía /api a services/api:8080)
pnpm build        # verificación de tipos (tsgo) y build de producción
```

Gestor de paquetes: `pnpm`. La API (`make api-run`) y GoTrue (`make up`) deben
estar arriba. En desarrollo no hace falta CORS: el navegador llama a `/api` en el
mismo origen. GoTrue ya permite CORS para el navegador.
