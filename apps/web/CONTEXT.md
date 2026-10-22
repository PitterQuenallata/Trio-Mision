# CONTEXT — Sitio web Trio Misión Bolivia

> Documento de contexto para el desarrollo del sitio web de **Trio Misión Bolivia**.
> Fuente compilada desde: repos privados de GitHub (`trio-mision-app`,
> `panelweb-triomision-lyrics`), assets locales y referencias públicas.
> **No hay código todavía** — este archivo define el contexto antes de diseñar.

---

## 1. Quién es Trio Misión

- Trío vocal/instrumental de **música cristiana adventista de Bolivia** (Santa Cruz).
- **~30 años de trayectoria** y una discografía extensa (muchos álbumes).
- Presencia en plataformas: Apple Music, YouTube, Facebook, Spotify.
- Generaciones del grupo:
  - **Trio Misión** (formación actual): Alex, Gabriel, Pitter.
  - **Misión Nueva Generación** (2da generación): Arturo, César, Josué.
  - **Antiguos integrantes**: Abraam, Alcides, Efraím, Freddy, José Luis, Juancho,
    Abdías, Edgar Romero, Erick, Gerson, Hernán, Justiniano, Miqui.
  - **Rama femenina**: esposas de integrantes (foto grupal `femenino.png`).

## 2. Ecosistema existente (ya construido)

### 2.1 App móvil — `trio-mision-app` (Flutter)

- Package: `com.blakor.triomision`. Android primero (Google Play).
- Stack: Flutter + Riverpod + go_router + Drift (SQLite local).
- Backend: **Supabase** (Postgres + Auth email/Google + Storage + Edge Functions + Realtime).
- Qué hace: Himnario Adventista con acordes (gratis), catálogo premium de grupos
  (Trio Misión y otros), repertorios, modo escenario, transposición, afinador,
  importación PDF/ChordPro.
- **Pagos: NO hay pasarela dentro de la app** (decisión cerrada 2026-07-10 por
  política/comisión de Google Play). Modelo tipo Spotify/Netflix: **todo el pago
  ocurre en el portal web** y la app se desbloquea por sync.

### 2.2 Panel admin — `panelweb-triomision-lyrics` (React)

- React 19 + Vite + TS + TanStack Router/Query + shadcn/ui + Tailwind v4 + Supabase.
- Gestiona: catálogo (grupos, álbumes, canciones ChordPro, himnario), tienda
  (productos, ventas, cupones, códigos de canje), **aprobación de pagos manuales**
  (QR/transferencia/Binance con comprobante), usuarios, staff (admin/editor/vendedor),
  notificaciones, auditoría.

### 2.3 Base de datos Supabase (compartida — fuente de verdad)

Entidades clave ya existentes que el sitio puede consumir con la **anon key** y las
mismas RLS de la app:

- Catálogo: `styles`, `artists`, `albums`, `songs`, `hymns`, `themes`.
- Tienda: `subscription_plans`, `products`, `coupons`, `payment_requests`,
  `receipts` (bucket), `payment_providers` (manual_qr activo; libelula/pagosnet/
  banipay/qr_nacional/stripe preparados pero inactivos), `sales`, `redeem_codes`.
- Cuenta: `profiles`, `subscriptions`, `devices`, `purchases`.
- Config pública: `app_config` (claves `payment_*`, `about_*_url`).

### 2.4 Spec de contenido ya redactada

El repo de la app tiene `docs/07-sitio-web.md`: **spec completa del portal de
compra de la app** (hero, características, Free vs Premium, flujo de compra QR +
comprobante, FAQ, términos y privacidad ya redactados — borrador 2026-07-11).
Contenido reutilizable casi verbatim para la parte "app/portal" del sitio.

## 3. Arquitectura del ecosistema (4 piezas, un solo backend)

Decisión tomada (2026-08-08): el ecosistema son **4 piezas** sobre el mismo Supabase:

| # | Pieza | Stack | Estado |
|---|---|---|---|
| 1 | App móvil | Flutter | ✅ Existe (`trio-mision-app`) |
| 2 | Panel admin | React | ✅ Existe (`panelweb-triomision-lyrics`) |
| 3 | **Sitio oficial (este repo)** | Astro estático | 🔨 En construcción |
| 4 | Portal del usuario (login, compras, pagos) | React (stack del panel), repo/deploy aparte | 📋 Fase 2 |

Reglas: un solo backend Supabase (RLS como seguridad real); la app no vende
(política Play) → la venta ocurre solo en el portal (4), se aprueba en el panel
(2) y se desbloquea en la app (1); el sitio (3) solo lee catálogo público en
build time y enlaza al portal. Dominio portal: subdominio (ej. `tienda.`).

### Estructura de este repo (por dominios)

- `src/pages/` — solo rutas delgadas: `index`, `app`, `privacidad`, `terminos`.
- `src/domains/grupo/` — secciones del sitio (Hero, Historia, Integrantes,
  Discografía, AppTeaser, Contacto) + `data.ts` (hitos y discografía BORRADOR).
- `src/domains/app/` — secciones de la landing de la app (contenido: spec 07).
- `src/domains/legal/` — textos legales en Markdown (pendiente trasladar spec 07 §9).
- `src/shared/` — `config.ts` (marca, WhatsApp, redes, nav — única fuente),
  components (ui/layout), layouts, styles, lib.
- El portal (pieza 4) NO vive en este repo — va aparte (React, subdominio).

Estado de secciones: Hero e Integrantes completos; Historia, Discografía,
AppTeaser y Contacto construidas con datos borrador (ver TODOs en `data.ts`
y `config.ts`); `/app`, `/privacidad`, `/terminos` son placeholders.

### Patrón "Ver más" (decidido 2026-08-08)

Cada sección de la principal es un **resumen** con botón "Ver más" a su página
propia: `/historia` (timeline completo — en la home solo 3 hitos),
`/discografia` (los **27 álbumes, 300+ canciones** — dato confirmado por el
grupo), `/integrantes` (detalle con bios/roles). Componentes reutilizables en
`domains/grupo/components/`: `Timeline.astro`, `AlbumGrid.astro`; botón
`shared/components/ui/VerMas.astro`.

### Plan pendiente (prioridad: datos → luego animaciones)

1. **Datos reales primero**: ✅ discografía cargada desde Apple Music (21 de 27
   álbumes con portadas 600×600, años y enlaces — los 6 restantes no están en
   streaming, completar desde Supabase). Pendiente: hitos reales con años (los
   actuales son inventados pero anclados en años reales de álbumes), redes
   reales, roles de integrantes, screenshots de la app, URL de Play Store,
   precios (subscription_plans).
2. **Después, efectos**: modal con zoom por integrante (clic → agrandar foto +
   bio/rol) — animación POR DEFINIR con el usuario, NO construir todavía.
   Evaluar: página de detalle por álbum `/discografia/[album]` con canciones.
3. og:image, dominio y deploy.

### Estado de páginas (2026-08-08)

- `/` — completa con todas las secciones + ver-más + menú móvil hamburguesa.
- `/historia`, `/discografia`, `/integrantes` — páginas detalle base (datos
  reales de discografía; hitos borrador).
- `/app` — completa: hero, 8 características, Free vs Premium + cómo comprar,
  8 FAQs, bloque "para grupos" (contenido de la spec 07).
- `/privacidad`, `/terminos` — texto completo desde spec 07 §9 (Markdown en
  `domains/legal/content/`).

## 4. Decisión técnica: Astro vs React

**Recomendación: Astro con islas de React.**

| Criterio | Astro (+ islas React) | React puro (Vite SPA) |
|---|---|---|
| Landing del grupo (contenido, SEO) | ✅ HTML estático, SEO perfecto, carga mínima | ⚠️ SPA, SEO más débil sin SSR |
| Checkout / login / mis-compras | ✅ Isla React hidratada solo donde se necesita | ✅ Natural |
| Reuso de stack del panel (React 19 + shadcn + TanStack) | ✅ Las islas pueden reusar componentes/hooks | ✅ Total |
| Velocidad percibida (público Bolivia, móviles) | ✅ Mejor (poco JS) | ⚠️ Más JS |
| Curva/simplicidad | ✅ Un solo proyecto | ✅ Un solo proyecto |

- El grueso del sitio es **contenido** (grupo, historia, discografía) → Astro gana.
- El checkout es una **parte acotada** → isla React con `@supabase/supabase-js`,
  mismas RLS y RPCs que ya usa el panel.
- Alternativa válida si se prefiere un solo paradigma: **React + Vite** (igual que
  el panel), aceptando peor SEO en la landing. Si se elige esto, considerar
  prerender/SSG.

## 5. Assets disponibles (ya copiados al proyecto)

Carpeta `Trio-Mision-individual-sinfondo/` (fotos individuales sin fondo, PNG):

- `Trio-mision/` — Alex, Gabriel, Pitter (formación actual)
- `Trio-mision-nueva-generacion/` — Arturo, César, Josué
- `Trio-mision-antiguos-integrantes/` — 13 integrantes históricos
- `trio-mision-femenino/femenino.png` — rama femenina
- **Hero de referencia**: `hero-principal-v1.png`, `hero-principal-v2.png`,
  `hero-principal-v3.png`, `hero-animate.mp4` (todos en `public/assets/hero/`).
  **Decisión: son borradores — NO se usan en el sitio.** El hero final se compone
  en código por capas con las fotos individuales (ver `src/sections/Hero.astro`):
  trío actual al frente-centro (Alex, Gabriel, Pitter), nueva generación
  atrás-izquierda (Arturo, Josué, César), antiguos integrantes atrás-derecha
  (siluetas oscuras) y rama femenina lo más atrás a la izquierda (foto grupal).

## 6. Dirección visual (del hero de referencia)

- **Fondo oscuro** tipo escenario/teatro, spotlight circular en el piso.
- Iluminación dual: **cian/teal a la izquierda, rojo/magenta a la derecha**.
- Logotipo **"TRIO MISION / BOLIVIA"** en **serif dorada** elegante, con líneas
  finas laterales.
- Composición: trío actual al frente, nueva generación detrás, antiguos
  integrantes como siluetas oscuras al fondo (narrativa de "30 años de legado").
- Vestimenta formal: trajes negros, guitarra clásica como elemento icónico.
- Relación con el branding de la app: el teal `#3FC9BE` y el **dorado premium
  `#D9B36A`** de la app calzan directo con esta estética; fondos oscuros
  `#0F1416`–`#1A2226`.
- Tono: sobrio, elegante, moderno — **sin clichés religiosos**.

### 6.1 Sistema de diseño DEFINIDO (basado en La Velada, fondo negro)

Referencia analizada: `github.com/midudev/la-velada-web-oficial` (clonado en
`.reference/la-velada-web-oficial/` — consultar cuando se necesite). De La Velada
tomamos: **tipografía, dorados, cards y efectos**. Descartamos: su fondo azul
noche — el nuestro es **negro cálido de estudio fotográfico**.

**Tipografía:**
- **Cinzel** (serif romana/epigráfica) para TODO el sitio — es la seña de
  identidad. Pesos 500 (body) y 900 (títulos). Carga vía `@font-face` woff2 con
  `font-display: swap` + fallback `local(georgia)` con `size-adjust`.
- Todo en **mayúsculas con tracking amplio**: eyebrow `tracking-[0.24em]`,
  títulos de sección `tracking-[0.1em]`, nombre hero `tracking-[0.08em]`.
- Título principal con **gradiente cream→gold** en `background-clip: text` +
  text-shadow dorado (receta de `BoxerSelector.astro` de La Velada).
- Fuente de apoyo para texto largo/legales (opcional): una sans neutra
  (Inter o system stack) — definir al maquetar.

**Colores (tokens `@theme` Tailwind v4, CSS-first, sin tailwind.config):**

| Token | Valor | Uso |
|---|---|---|
| `--color-theme-cream` | `#f4e4c9` | Texto principal (marfil cálido) |
| `--color-theme-gold` | `#c7a86b` | Dorado base (mates, bordes, glow, CTAs) |
| `--color-theme-ink` | `#0a0908` | **Fondo global** (negro cálido, reemplaza al azul) |
| `--color-theme-ink-2` | `#141110` | Fondo secundario / secciones alternas |
| Card bg | `#141210 → #080706` | Gradiente vertical de cards (era azul en La Velada) |
| Velos sobre fotos | `rgba(0,0,0,…)` | Degradado inferior para texto sobre imagen |
| Acento teal (secundario) | `#3FC9BE` | Solo detalles puntuales que enlazan con la app |

**Dorado (nunca plano en elementos destacados):**
- Bordes: `box-shadow: 0 0 0 1px gold/24%` → hover `gold/70-75%` (sin `border`,
  evita reflow).
- Glow: `0 0 30-36px gold/30%`.
- Dorado "metálico" (CTAs, badges): gradiente `160deg` gold→`#6b4f1e` +
  highlight blanco inset + sombra dorada exterior.

**Cards (integrantes, álbumes):**
- Ring dorado 24% + sombra negra; hover: `translateY(-4px)` + ring 70% + glow.
- **Esquinas en L** ("trading card") que escalan en hover (transform, sin reflow).
- **Spotlight radial dorado** detrás de la foto + velo inferior negro para el nombre.
- Foto en reposo `saturate(0.9) brightness(0.9)` → hover `saturate(1.1)` + `scale(1.04)`.
- Glass card (bio/datos): `border gold/44%` + `backdrop-blur(14px)` + highlights
  `mix-blend-mode: screen`.

**Efectos globales:**
- Zoom de fondo del hero ligado al scroll (`animation-timeline: scroll()`).
- `mask-image` para fundir fotos con el negro; grano de cine `feTurbulence` al 6%.
- Header con scroll-glass (`backdrop-blur` al hacer scroll).
- Scroll reveal escalonado (`tailwind-animations`, `animate-fade-in-up` + delay).
- Líneas divisorias `via-theme-gold/30` y `SectionDivider` (línea + logo + línea).
- Scrollbar dorada; CSS crítico inline del fondo para evitar flash blanco.
- View Transitions (`transition:name` por integrante si hay páginas de detalle).
- Respetar `prefers-reduced-motion` en todo.
- Nota: La Velada usa `color-mix()` intensivamente → navegadores modernos 2023+.

**Confirmación de stack que esto implica:** Astro + Tailwind v4 — exactamente el
stack de La Velada, lo que refuerza la recomendación de la sección 4.

## 7. Branding y datos operativos

- Operador: **Blakor Tech Solution** (Pitter Quenallata y Rodrigo Echeverria, Bolivia).
- Dominio de la operadora: `blakor.tech` (dominio propio del grupo: **por definir**).
- Soporte/legal: WhatsApp **+591 67033711**.
- SEO sugerido (ya definido en la spec): "letras y acordes cristianos",
  "himnario adventista con acordes", "trio misión letras",
  "canciones cristianas para guitarra" — sumar: "trio misión bolivia",
  "música adventista bolivia".

## 8. Preguntas abiertas (definir antes de codear)

1. **Alcance exacto**: ¿sitio del grupo + portal de la app en el mismo dominio?
   ¿O el portal va en subdominio (ej. `app.` o `tienda.`)?
2. **Login**: confirmado que sí se necesita (para `/comprar` y `/mis-compras`)
   con la misma cuenta Supabase. ¿Solo email/password + Google, igual que la app?
3. **Precios**: placeholders en `subscription_plans`/`products` — definir montos
   reales en BOB (se editan desde el panel).
4. **Dominio y hosting**: ¿dominio propio del grupo? ¿Vercel/Netlify/Cloudflare?
5. **Contenido histórico**: bio del grupo, años, discografía oficial (orden y
   portadas de álbumes — existen en Supabase `albums`/`artists`).
6. **¿La landing de la app** (spec 07) es sección del sitio del grupo
   (ej. `/app`) o página aparte?
7. Idioma: español únicamente (asumido).

## 9. Fuentes

- Repo `PitterQuenallata/trio-mision-app` → `docs/01-contexto.md` … `docs/07-sitio-web.md`
- Repo `PitterQuenallata/panelweb-triomision-lyrics`
- [Trio Mision en Apple Music](https://music.apple.com/us/artist/trio-mision/1612702140)
- Assets locales: `Trio-Mision-individual-sinfondo/`
