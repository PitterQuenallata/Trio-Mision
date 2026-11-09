# Panel administrativo — reglas para agentes

## UI: usar siempre los componentes de la plantilla

El panel viene de la plantilla blakor-admin-pro. Para cualquier interfaz nueva:

- **Modales** (crear, editar, gestionar): `src/shared/components/ui/modal.tsx`
  (`Modal`). No crear diálogos propios ni usar `window.confirm`/`alert`.
- **Confirmaciones de acciones destructivas o que quitan acceso** (quitar un rol,
  quitar un manager, revocar): `src/shared/components/ui/alert-dialog.tsx`
  (`AlertDialog`, variante `danger`).
- **Avisos de resultado** (creado, guardado, error de la API): `pillToast` de
  `src/shared/components/ui/pill-toast.tsx` (`pillToast.success / error / info`).
  No usar mensajes en línea para resultados de una acción; sí para errores de
  validación de un campo.
- **Botones**: `src/shared/components/ui/button.tsx` (`Button`, variantes `default`,
  `outline`, `ghost`, …). **Campos**: `input.tsx` (`Input`). **Interruptores** de
  rol o manager: `switch.tsx` (`Switch`). **Tablas**: `data-table` (`DataTable`).
- **Cargas**: `src/components/ui/ios-spinner.tsx` (`Spinner`).
- Antes de escribir un componente de UI, buscar primero en `src/components/ui/` y
  `src/shared/components/ui/`. Si la plantilla tiene uno, usarlo; si falta, sacarlo
  de la plantilla original (historial del commit `bde2d5d`) en vez de inventarlo.
- Sin enlaces ni acciones que no lleven a algo real: no dejar botones de muestra.

## Datos y permisos

- Los datos vienen de la API con el cliente tipado (`src/shared/api/`). Regenerar
  tipos con `pnpm api:types` tras cambiar la API.
- El control por rol del panel está en `src/shared/auth/permissions.ts`; es solo
  interfaz, la API autoriza en cada endpoint.
- Las listas y formularios usan TanStack Query (`useQuery`/`useMutation`), TanStack
  Table (`DataTable`) y TanStack Form; no duplicar estado de servidor en `useState`.

## Verificación

- `pnpm build` (incluye `tsgo --noEmit`) debe pasar antes de dar un cambio por hecho.
- Un cambio de interfaz no está verificado hasta probarlo en el navegador; decirlo
  explícitamente si no se pudo.
