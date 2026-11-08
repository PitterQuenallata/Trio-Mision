# Blakor Admin Pro - Especificaciones Técnicas y Arquitectura

Starter Kit y Plantilla Comercial para Panel Administrativo Moderno (Dashboard).

---

## 1. Stack Tecnológico Base

- **Runtime & Bundler**: React 18/19 + Vite (esbuild en Go).
- **Gestor de Paquetes**: `pnpm` (estrictamente requerido, no usar `npm` ni `yarn`).
- **Compilador TypeScript en Go (`tsgo`)**:
  - Dependencia: `@typescript/native-preview` en `devDependencies`.
  - Script en `package.json`: `"check-types": "tsgo --noEmit"`.
  - Integración IDE: `.vscode/settings.json` con `"js/ts.experimental.useTsgo": true`.
- **Diseño & UI**:
  - **Tailwind CSS**: Con soporte nativo Dark/Light mode y tokens de color de la marca **Blakor**.
  - **shadcn/ui**: Primitivas Radix UI desacopladas que residen directamente en el repositorio (`src/shared/components/ui/`), moldeadas para la identidad visual de la plantilla.
  - **Iconografía**: `lucide-react`.

---

## 2. Ecosistema TanStack Completo

La arquitectura de datos, rutas, tablas y formularios está impulsada 100% por la suite oficial de **TanStack**:

1. **TanStack Router**:
   - Enrutamiento 100% type-safe.
   - Búsqueda y parámetros de URL validados con Zod (`validateSearch`).
   - Loaders para prefetching de datos en transiciones de ruta.
   - Protección de rutas y layouts anidados mediante `__root.tsx` y guards de autenticación.
2. **TanStack Query (React Query v5)**:
   - Caching, deduplicación de peticiones y sincronización en segundo plano.
   - Mutaciones con rollback optimista e invalidación declarativa de queries.
3. **TanStack Table (v8)**:
   - Paginación del lado del cliente y servidor.
   - Multi-sorting y ordenamiento personalizado.
   - Filtros globales (search bar) y facetados por columna.
   - Selección de filas (checkboxes) y visibilidad dinámica de columnas.
4. **TanStack Form + Zod**:
   - Formularios reactivos headless de alto rendimiento.
   - Validación estricta en tiempo real con `@tanstack/zod-form-adapter`.
   - Control de estados de formulario (dirty, touched, submitting, field errors).

---

## 3. Sistema de Navegación Dinámico ("Blakor Dynamic Shell")

La plantilla incluye un **Theme & Layout Customizer** interactivo accesible desde un botón de configuración flotante o en la cabecera. Permite alternar en tiempo real entre los 6 modos de navegación mostrados en el diseño, persistiendo la selección en `localStorage`:

| Preset de Navegación | Descripción & Comportamiento Visual |
| :--- | :--- |
| **1. Bottom Dock (Dock Inferior)** | Barra de navegación flotante inferior tipo dock de celular / iOS con efecto cristal (`backdrop-blur-md`), bordes redondeados y barra indicadora naranja en la pestaña activa. Ideal para vista táctil y escritorios modernos. |
| **2. Top Navbar (Barra Superior)** | Navegación horizontal en la cabecera con enlaces y dropdowns. Despeja el 100% del ancho de la pantalla para tablas y analíticas densas. |
| **3. Left Sidebar Clásico** | Sidebar vertical a la izquierda con enlaces categorizados (Principal, Gestión, Seguridad, Configuración) y opción de colapso. |
| **4. Left Mini Sidebar** | Sidebar contraído a una franja delgada que muestra solo iconos con tooltips emergentes al pasar el cursor. |
| **5. Floating Drawer (Sidebar Oculto)** | Menú lateral oculto que se despliega como un modal flotante con esquinas redondeadas al pulsar el botón superior izquierdo (hamburguesa). |
| **6. Floating Action Menu (FAB)** | Botón circular naranja en la esquina inferior derecha con micro-interacción (`+` a `x`) que abre un popover flotante con acciones rápidas. |

### Controles adicionales del Customizer:
- **Modo de Color**: Dark Mode Blakor (predeterminado), Light Mode Elegante, o Sincronización con el Sistema.
- **Color de Acento**: Naranja Blakor (`#F97316`), Esmeralda (`#10B981`), Violeta (`#8B5CF6`), Azul Real (`#3B82F6`).
- **Ancho del Contenedor**: Full-width fluido (100%) vs En caja centrado (Boxed 1440px).

---

## 4. Arquitectura de Carpetas: Feature / Domain-Driven (FDD)

```text
blakor-admin/
├── .vscode/
│   └── settings.json                  # Habilita el compilador tsgo nativo en VS Code
├── public/
│   └── favicon.ico
├── src/
│   ├── app/                           # Bootstrap de la aplicación
│   │   ├── providers/                 # QueryClientProvider, RouterProvider, ThemeProvider
│   │   │   ├── index.tsx
│   │   │   ├── query-provider.tsx
│   │   │   ├── router-provider.tsx
│   │   │   └── theme-provider.tsx
│   │   ├── routes/                    # Rutas de TanStack Router
│   │   │   ├── __root.tsx             # Layout raíz con el shell de navegación y devtools
│   │   │   ├── index.tsx              # Redirección a /dashboard
│   │   │   ├── auth.login.tsx
│   │   │   ├── auth.register.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── usuarios.tsx
│   │   │   ├── staff.tsx
│   │   │   ├── pagos.tsx
│   │   │   ├── licencias.tsx
│   │   │   ├── reportes.tsx
│   │   │   └── auditoria.tsx
│   │   └── main.tsx                   # Punto de entrada Vite
│   │
│   ├── shared/                        # Módulos transversales y componentes compartidos
│   │   ├── api/
│   │   │   ├── client.ts              # Cliente HTTP fetch con interceptor Bearer token y auto-refresh
│   │   │   └── types.ts               # Tipos API estándar (PaginatedResponse, ApiError, QueryParams)
│   │   ├── components/
│   │   │   ├── ui/                    # Primitivas shadcn/ui (Button, Dialog, Input, Sheet, etc.)
│   │   │   ├── data-table/            # Tabla de datos reutilizable con TanStack Table
│   │   │   │   ├── data-table.tsx
│   │   │   │   ├── data-table-pagination.tsx
│   │   │   │   ├── data-table-toolbar.tsx
│   │   │   │   ├── data-table-column-header.tsx
│   │   │   │   ├── data-table-view-options.tsx
│   │   │   │   └── data-table-skeleton.tsx
│   │   │   ├── feedback/              # Skeletons, Empty states y Error boundaries
│   │   │   └── layout/                # Orquestador del Shell de navegación Blakor
│   │   │       ├── blakor-shell.tsx   # Contenedor dinámico según el modo seleccionado
│   │   │       ├── top-navbar.tsx     # Cabecera con Cmd+K search y perfil de usuario
│   │   │       ├── left-sidebar.tsx   # Sidebar clásico expandido
│   │   │       ├── mini-sidebar.tsx   # Sidebar colapsado en iconos
│   │   │       ├── bottom-dock.tsx    # Dock flotante inferior
│   │   │       ├── floating-drawer.tsx# Drawer flotante modal superior izquierdo
│   │   │       ├── action-fab.tsx     # Botón flotante naranja inferior derecho
│   │   │       └── layout-customizer.tsx # Panel lateral para cambiar layouts en vivo
│   │   ├── hooks/                     # useDebounce, useDisclosure, useMediaQuery, useLocalStorage
│   │   └── lib/                       # utils.ts (cn helper), env.ts (validación Zod de variables)
│   │
│   └── modules/                       # Módulos de dominio encapsulados
│       ├── auth/                      # Login, Register, Forgot Password, Reset Password, 2FA
│       ├── dashboard/                 # Métricas KPI, Analítica, Gráficas interactivas
│       ├── usuarios/                  # Directorio de clientes/usuarios con filtros avanzados
│       ├── staff/                     # Equipo interno, Roles y Matriz de Permisos (RBAC)
│       ├── pagos/                     # Facturación, Transacciones, Métodos de pago, Drawer de nuevo pago
│       ├── licencias/                 # Planes SaaS, Claves de licencia y Suscripciones
│       ├── reportes/                  # Generación y exportación a CSV/Excel/PDF
│       ├── auditoria/                 # Registro de logs de actividad e IP con visor de detalle JSON
│       │
│       │   ─── Módulos de Catálogo (UI Kit & Showcases para plantilla comercial) ───
│       │
│       ├── tables/                    # Showcase de Data Tables (básica, selección masiva, filtros)
│       ├── forms/                     # Showcase de Formularios TanStack Form (wizard, inputs, validación Zod)
│       ├── components/                # Showcase del UI Kit completo (botones, badges, cards, modales)
│       └── extra-pages/               # 404 Not Found, 403 Forbidden, 500 Error, Mantenimiento
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 5. Anatomía Estricta por Módulo (`src/modules/<dominio>/`)

Cada módulo es completamente autocontenido y respeta esta separación interna de responsabilidades:

```text
src/modules/<modulo>/
├── api/                               # Hooks de TanStack Query
│   ├── use-<modulo>-query.ts          # Consulta de datos con paginación y caching
│   └── use-crear-<modulo>-mutation.ts # Mutación con invalidación de queries
├── components/                        # Componentes de presentación específicos
│   ├── <modulo>-columns.tsx           # Definición de columnas para TanStack Table
│   ├── <modulo>-table.tsx             # Tabla conectada al query
│   ├── <modulo>-table-toolbar.tsx     # Buscador y filtros de fecha/estado
│   └── <modulo>-drawer-form.tsx       # Formulario Drawer con TanStack Form + Zod
├── schemas/
│   └── <modulo>.schema.ts             # Esquemas de validación Zod
├── types/
│   └── <modulo>.types.ts              # Tipos TypeScript inferidos del esquema
└── pages/
    └── <modulo>-page.tsx              # Vista consumida por TanStack Router
```

---

## 6. Configuración de Compilación Go (`tsgo`) y VS Code

### `package.json` (Fragmento relevante):
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsgo --noEmit && vite build",
    "check-types": "tsgo --noEmit"
  },
  "devDependencies": {
    "@typescript/native-preview": "^7.0.0-preview.20250212.1"
  }
}
```

### `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/@typescript/native-preview/lib",
  "js/ts.experimental.useTsgo": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

## 7. Cliente HTTP Base (`src/shared/api/client.ts`)

- Implementado con la API nativa `fetch`.
- Inyección automática del header `Authorization: Bearer <token>`.
- Interceptor de respuesta para capturar respuestas `401 Unauthorized` y disparar el cierre de sesión / redirección a login.
- Manejo tipado de errores con la clase `ApiError`.
- Métodos helpers: `http.get`, `http.post`, `http.put`, `http.patch`, `http.delete`.

---

## 8. Identidad Visual Blakor

- **Fondo Global (Dark)**: `#0B0E14` (Carbón profundo).
- **Tarjetas / Contenedores (Dark)**: `#11161F` con borde sutil `#1E2633` o `border-white/10`.
- **Acento Primario**: Naranja Eléctrico / Ámbar (`#F97316` / `#FB923C`).
- **Modo Claro (Light)**: Blanco marfil (`#F8FAFC`), bordes `#E2E8F0`, texto `#0F172A`.
- **Micro-interacciones**: Bordes con blur de cristal (`backdrop-blur-xl`), animaciones de entrada suaves y estados activos identificados por barras o badges fluorescentes.
