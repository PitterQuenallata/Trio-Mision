# Panel administrativo — Trio Misión

Panel para staff, managers y members del ecosistema Trio Misión. Consume la API
de `services/api` (ver `docs/development/integracion-api.md`).

## Origen

Parte de la plantilla **blakor-admin-pro** (React + Vite + TypeScript + Tailwind +
TanStack). Se quitaron los módulos de demostración que no son del negocio (blog,
ecommerce, charts, tablas y formularios de muestra, etc.). La plantilla original
conserva el historial y sirve de referencia para nuevos componentes.

## Estructura por dominio

Cada dominio vive en `src/modules/<dominio>/` (pages, components, data, hooks,
types). Dominios actuales:

| Módulo | Estado |
|---|---|
| `auth` | Login de GoTrue pendiente de conexión |
| `dashboard`, `usuarios`, `staff`, `pagos`, `licencias`, `reportes`, `auditoria`, `soporte`, `configuracion` | Heredados de la plantilla, con datos de muestra; se conectan uno a uno a la API |
| `catalogo`, `himnario`, `importaciones`, `servicios` | Nuevos; marcadores de posición con sus endpoints |

El cliente HTTP está en `src/shared/api/client.ts` (Bearer, manejo de 401).

## Desarrollo

```bash
cp .env.example .env.local
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # verificación de tipos y build de producción
```

Gestor de paquetes: `pnpm`. La API debe estar arriba (`make api-run`).
