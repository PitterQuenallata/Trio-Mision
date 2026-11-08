# Project Guidelines: Blakor Admin Pro

## Core Design Directives (Apple HIG & Apple Design Skill)

This project strictly follows the **Apple Human Interface Guidelines (HIG)** and the design craft principles defined in `.agents/skills/apple-design/SKILL.md`.

### 1. Zero Emojis Policy (CRITICAL)
- **Do NOT use emojis anywhere in the interface**: No emojis in navigation items, buttons, headings, breadcrumbs, toasts, notifications, badges, mock tables, empty states, or error messages.
- Use vector symbols exclusively (Lucide React or inline SVG tailored to Apple SF Symbols conventions).
- Icons must use matching stroke widths (1.5px to 2px), subtle sizing (16px to 20px for controls, 24px for prominent metrics), and appropriate semantic colors.

### 2. Apple Typography System
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", -apple-system-subheadline, system-ui, -apple-system, sans-serif`.
- Tabular figures (`font-variant-numeric: tabular-nums` or `tabular-nums` class in Tailwind) for all numbers, metrics, financial amounts, and data tables.
- Standard Apple typographic scale:
  - Large Title: 34pt / font-bold / tracking-tight
  - Title 1: 28pt / font-bold / tracking-tight
  - Title 2: 22pt / font-semibold / tracking-tight
  - Title 3: 20pt / font-semibold
  - Headline: 17pt / font-semibold
  - Body: 16pt / 17pt / font-normal / leading-relaxed
  - Callout: 15pt / font-medium
  - Subheadline: 14pt / font-normal / text-muted-foreground
  - Footnote: 13pt / font-normal
  - Caption 1: 12pt / font-medium
  - Caption 2: 11pt / font-medium
- Avoid thin/ultralight weights for body text to maintain legibility.

### 3. Apple Color Palette & Dark Mode
- Neutral grays based on Apple system grays:
  - Light mode: Pure `#FFFFFF`, secondary `#F2F2F7`, tertiary `#E5E5EA`, borders `#E5E5EA` or `rgba(0,0,0,0.06)`.
  - Dark mode: True black `#000000`, secondary `#1C1C1E`, tertiary `#2C2C2E`, elevated `#3A3A3C`, borders `rgba(255,255,255,0.08)`.
- Accent colors: Apple Blue (`#007AFF`), Orange/Accent (`#FF9500`), Green (`#34C759`), Red (`#FF3B30`), Purple (`#AF52DE`), Indigo (`#5856D6`).
- Subtle 1px borders with delicate alpha transparency instead of harsh drop shadows.

### 4. Liquid Glass & Functional Layer
- Dynamic frosted glass (`backdrop-blur-xl bg-background/80 dark:bg-background/70 border border-border/50`) for floating navigation bars, iOS dock, sidebars, and popovers.
- The content layer remains clean, readable, and distinct from the functional floating controls.

### 5. Code Quality & Technical Stack
- React 18/19, TypeScript, Vite.
- Tailwind CSS with semantic tokens and CSS variables.
- TanStack Router (file-based or code-based type-safe routes).
- TanStack Query v5 with optimistic updates and caching.
- TanStack Table v8 for high-density enterprise tables.
- TanStack Form + Zod for structured input handling.
- Feature / Domain-Driven Architecture (`src/features/<feature>/{components, hooks, api, types}`).
