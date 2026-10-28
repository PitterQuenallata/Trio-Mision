# Trio Misión — Monorepo

**Trio Misión** es un grupo musical adventista de Bolivia. Este monorepo contiene
su sitio web, aplicaciones, API, contenido del himnario e infraestructura.

## Inicio rápido: API y base de datos

### 1. Requisitos

- Docker con Docker Compose. En macOS puede usarse Docker Desktop o Colima.
- Go para ejecutar la API y el seed.
- `make` y `goose` para migraciones.
- Node.js/npx o pnpm para ejecutar Bruno CLI (opcional).
- pnpm para la web (opcional).

Instalación de goose:

```bash
go install github.com/pressly/goose/v3/cmd/goose@v3.24.3
```

Si usas Colima, inicia primero el daemon:

```bash
colima start
```

### 2. Configurar el entorno

Desde la raíz del repositorio, solo si todavía no existe `.env`:

```bash
cp .env.example .env
```

El `.env` contiene configuración local y no debe compartirse ni subirse a git.

### 3. Iniciar Docker Compose (PostgreSQL + GoTrue)

```bash
make up
# equivalente: docker compose up -d

docker compose ps
```

Deben aparecer `postgres` y `gotrue` en `healthy` (puertos `5432` y `9999`).
La API se ejecuta aparte como proceso Go (paso 6).

> **PostgreSQL nativo:** si existe una instalación nativa de PostgreSQL (por
> ejemplo con brew), debe estar detenida mientras se usa Docker:
> `brew services list | grep postgres` → `brew services stop postgresql@16`.
> Si el 5432 local lo ocupa otra instancia, `make db-migrate` y la API
> trabajarían contra otra base sin que sea evidente.

### 4. Aplicar migraciones y datos de desarrollo

```bash
make db-migrate
make db-seed
```

El seed es idempotente: carga 614 himnos con sus versiones y un catálogo mínimo.
Para consultar migraciones:

```bash
make db-status
```

### 5. Abrir la base de datos con TablePlus (macOS)

1. Instala y abre [TablePlus](https://tableplus.com/).
2. Selecciona **Create a new connection… → PostgreSQL**.
3. Completa la conexión con estos valores locales:

| Campo | Valor |
|---|---|
| Name | `Trio Misión - Local` |
| Host | `127.0.0.1` |
| Port | `5432` |
| User | El valor de `POSTGRES_USER` del `.env` (por defecto, `triomision`) |
| Password | El valor de `POSTGRES_PASSWORD` del `.env` |
| Database | El valor de `POSTGRES_DB` del `.env` (por defecto, `triomision`) |
| SSL | `Disabled` para la conexión local de Docker |

4. Pulsa **Test** y luego **Connect**.

Antes de conectar deben estar activos PostgreSQL (`make up`), las migraciones y el
seed. Dentro de TablePlus abre la base `triomision`, esquema `public`, para ver las
tablas. Como comprobación puedes abrir `hymns` y `hymn_versions` o ejecutar en la
consola SQL:

```sql
SELECT COUNT(*) AS himnos FROM hymns;
SELECT hymn_id, version_code, chord_scope FROM hymn_versions LIMIT 10;
```

El resultado del primer query debe ser `614` después del seed. TablePlus se conecta
directamente a PostgreSQL; no necesita que la API esté iniciada.

### 6. Iniciar la API y abrir su documentación

En una terminal separada, desde la raíz:

```bash
make api-run
```

La API queda en <http://localhost:8080> y carga el `.env` de la raíz.

- Swagger UI: <http://localhost:8080/docs>
- OpenAPI JSON: <http://localhost:8080/openapi.json>
- Health: <http://localhost:8080/api/v1/health>
- Readiness: <http://localhost:8080/api/v1/ready>

Comprobación manual:

```bash
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/ready
curl http://localhost:8080/api/v1/himnario/himnos
curl http://localhost:8080/api/v1/catalogo/artistas
```

Si aparece `ECONNREFUSED 127.0.0.1:8080`, la API no está corriendo: ejecuta
`make api-run`. Para detenerla, usa `Ctrl+C` en su terminal.

### 7. Probar con Bruno

La colección está en `bruno/`.

Con la aplicación Bruno:

1. Abre **Open Collection** y selecciona la carpeta `bruno/`.
2. Selecciona el entorno **Local**.
3. Ejecuta el flujo real de autenticación, en orden:
   - `GoTrue - signup` — alta del usuario de desarrollo (repetible).
   - `GoTrue - login` — password grant; guarda `gotrueAccessToken`.
   - `Me con token GoTrue` — `/api/v1/me` con el JWT emitido por GoTrue.
4. Para las demás requests protegidas genera un token de desarrollo con
   `make api-token` y guárdalo como variable secreta `gotrueToken`.
   `Health`, `Ready`, himnario y catálogo son públicas.

Desde terminal:

```bash
cd bruno
pnpm dlx @usebruno/cli run --env Local \
  --env-var gotrueToken="$(../scripts/mint-dev-token.sh)"
```

### 8. Tests y apagado

```bash
make api-test
make api-build

make down        # detiene contenedores; conserva los datos
colima stop      # opcional, solo si usas Colima
```

## Web pública

```bash
cd apps/web
pnpm install
pnpm dev
```

## Mapa del monorepo

```text
apps/           Web pública, app móvil y panel administrativo
services/api/   API central en Go, versión 0.3.0
services/worker/Tareas asíncronas (pendiente)
content/        Himnario y fuentes de contenido
database/       Migraciones goose y seeds
bruno/          Colección de requests y pruebas HTTP
infra/          Docker, GoTrue y despliegue
docs/           Alcance, arquitectura, desarrollo y decisiones
legacy/         Referencias v1, fuera del desarrollo actual
reverse-lab/    Investigación con límites éticos
```

## Estado actual

- Fase 1 de API completada.
- Fase 2 completada: migraciones, seed, himnario y catálogo de lectura,
  GoTrue en Compose y login real de extremo a extremo (registro → token →
  `/api/v1/me` con perfil creado).
- Siguiente: Fase 3 (tienda, pagos, audio y permisos) según
  [`docs/planificacion/README.md`](docs/planificacion/README.md).
- App móvil, panel y worker: pendientes.

El detalle operativo está en [`CURRENT_TASK.md`](CURRENT_TASK.md) y las reglas
para agentes en [`AGENTS.md`](AGENTS.md).

## Contenido fuera de git

`content/himnario/source/` (fotos escaneadas y PDF del himnario, ~564 MB) no está
versionado por su tamaño. Para reobtenerlo desde el repositorio local de origen:

```bash
cp -R "../scrip-orc-himanrio-convert/himnario adventista/fotos" content/himnario/source/fotos
cp "../scrip-orc-himanrio-convert/himnario adventista/Acordes_para_el_himnario_adventista_2020_3.pdf" content/himnario/source/
```

## Documentación

- [Alcance del sistema](docs/alcance/README.md)
- [Plan general](docs/planificacion/README.md)
- [Desarrollo local](docs/development/README.md)
- [API](services/api/README.md)
- [Base de datos](database/README.md)
- [Arquitectura](docs/architecture/arquitectura-trio-mision-v2.md)
- [Modelo de datos](docs/architecture/modelo-datos-v2.md)
- [Pagos](docs/payments/README.md)
- [Decisiones de arquitectura](docs/decisions/)
