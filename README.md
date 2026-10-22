# Trio Misión — Monorepo

**Trio Misión** es un grupo musical adventista de Bolivia. Este monorepo contiene todo su ecosistema digital: sitio web, aplicaciones, servicios y el contenido del himnario.

## Mapa del monorepo

```
apps/           Aplicaciones de usuario
  web/          Sitio web público (Astro 7 + Tailwind 4)
  mobile/       App móvil (Flutter, pendiente)
  admin/        Panel de administración (pendiente)
services/       Servicios de backend
  api/          API central (Go, monolito modular, pendiente)
  worker/       Tareas en segundo plano (pendiente)
content/        Contenido versionado
  himnario/     Acordes .cho del Himnario Adventista + fuentes
legacy/         Clones v1 de referencia (app y panel; fuera de git)
reverse-lab/    Laboratorio de análisis de apps (con límites éticos)
database/       Migraciones y seeds (pendiente)
infra/          Infraestructura: docker, gotrue, deploy (pendiente)
docs/           Documentación: arquitectura, desarrollo, despliegue, pagos, decisiones
```

## Estado de los componentes

| Componente   | Estado                        |
|--------------|-------------------------------|
| `apps/web`   | Migrada al monorepo, en desarrollo |
| `apps/mobile`| Pendiente (Flutter)           |
| `apps/admin` | Pendiente                     |
| `services/api` | Pendiente (Go)              |
| `services/worker` | Pendiente                |
| `content/himnario` | 1228 archivos `.cho` migrados |
| `database`, `infra` | Pendientes   |

## Requisitos

- [Docker](https://www.docker.com/) con Docker Compose (para PostgreSQL de desarrollo).
- [pnpm](https://pnpm.io/) (para la web en `apps/web`).

## Puesta en marcha

```bash
cp .env.example .env   # credenciales de desarrollo
make up                # levanta PostgreSQL en el puerto 5432
make check             # verifica la estructura del monorepo
```

Para la web:

```bash
cd apps/web
pnpm install
pnpm dev
```

## Contenido fuera de git

`content/himnario/source/` (fotos escaneadas y PDF del himnario, ~564 MB) **no está versionado** por su tamaño. Para re-obtenerlo, copiar desde el repositorio local `scrip-orc-himanrio-convert`:

```bash
cp -R "../scrip-orc-himanrio-convert/himnario adventista/fotos" content/himnario/source/fotos
cp "../scrip-orc-himanrio-convert/himnario adventista/Acordes_para_el_himnario_adventista_2020_3.pdf" content/himnario/source/
```

## Documentación

- Documento de arquitectura: [`docs/architecture/arquitectura-trio-mision-v2.md`](docs/architecture/arquitectura-trio-mision-v2.md)
- Decisiones de arquitectura (ADR): [`docs/decisions/`](docs/decisions/)
- Desarrollo: [`docs/development/`](docs/development/) · Despliegue: [`docs/deployment/`](docs/deployment/) · Pagos: [`docs/payments/`](docs/payments/)
