# Development — entorno local

Guía para levantar el entorno de desarrollo del monorepo Trio Misión.

## Prerequisitos (macOS)

```bash
brew install go                          # toolchain Go (API y worker)
brew install colima docker docker-compose # Docker sin Docker Desktop (gratis, sin sudo)
brew install pnpm                        # para apps/web
```

> **Por qué Colima y no Docker Desktop:** Desktop exige contraseña de admin al
> instalar y tiene licencia comercial según el tamaño de la organización.
> Colima da el mismo daemon de Docker desde la terminal. Si prefieres Desktop,
> instálalo con `brew install --cask docker` (pide tu contraseña en la terminal).

### Compose plugin (una sola vez)

El `docker compose` de brew necesita que el CLI encuentre el plugin. El setup
ya lo hizo el equipo, pero si ves `docker: 'compose' is not a docker command`:

```json
// ~/.docker/config.json
{
  "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]
}
```

## Levantar el entorno

```bash
colima start          # enciende el daemon de Docker (VM ligera)
cp .env.example .env  # una sola vez (incluye S3_* para MinIO)
make up               # PostgreSQL + GoTrue + MinIO en Docker
make api-run          # API en http://localhost:8080
```

Swagger UI: <http://localhost:8080/docs> · Consola MinIO: <http://localhost:9001>
(credenciales `MINIO_ROOT_*`; la API usa la cuenta limitada `S3_*`).

## Comandos de la API

| Comando | Qué hace |
|---|---|
| `make api-run` | Corre la API con `go run` cargando el `.env` de la raíz |
| `make api-test` | Tests unitarios |
| `make api-build` | Compila |
| `make db-migrate` / `make db-status` | Migraciones goose con `DB_ADMIN_URL` |
| `make db-security` | Crea/actualiza las cuentas restringidas de API y GoTrue |
| `make db-seed` | Seed idempotente: himnario + catálogo + demo de tienda (sube master/preview a MinIO) |
| `make db-reset` | Reset total de migraciones y re-aplicación desde cero |
| `make db-staff EMAIL=… ROLE=vendedor` | Asigna un rol staff a un usuario GoTrue (asegura su perfil) |
| `make db-artist-role EMAIL=… ROLE=manager ARTIST=trio-mision` | Asigna una membresía member/manager de arranque a un usuario GoTrue |

## Dar rol staff o membresía por artista a un usuario (Sprint 3B)

Los endpoints `/api/v1/staff/*` consultan `staff_roles` (no los claims del
token); los endpoints `/api/v1/mis-artistas/*` consultan `artist_members`.
Procedimiento:

1. Dar de alta el usuario en GoTrue (requests `GoTrue - signup*` de Bruno o
   `curl -X POST :9999/signup`).
2. Asignar el rol (ambos aseguran el perfil, como hace `/me`):

   ```bash
   make db-staff EMAIL=staff@triomision.local ROLE=vendedor   # admin | editor | vendedor
   make db-artist-role EMAIL=manager@triomision.local ROLE=manager ARTIST=trio-mision
   ```

3. Los logins de Bruno guardan `staffToken`, `memberToken`, `managerToken` y
   `editorToken` para sus flujos.

Tras el primer manager, las membresías por artista se asignan desde la propia
API (`POST /api/v1/mis-artistas/{artistId}/miembros`), con auditoría. La guía
completa de integración para clientes (auth GoTrue, idempotencia, errores,
flujo de compra, member/manager, dispositivos y matriz de permisos) está en
[`integracion-api.md`](integracion-api.md).

## Apagar el entorno

```bash
make down             # detiene los contenedores (los datos persisten)
colima stop           # apaga la VM (opcional, ahorra recursos)
```

## Notas

- La API corre **nativa** (`go run`), no en contenedor: iteración más rápida.
  Docker solo hospeda la infraestructura (PostgreSQL y GoTrue; más adelante
  MinIO y un SMTP de desarrollo).
- Si el puerto 5432 lo ocupa un PostgreSQL nativo (`brew services list | grep
  postgres`), la API y las migraciones caerán en esa base en vez del contenedor:
  deténlo con `brew services stop postgresql@16` antes de trabajar.
- Tras `make db-reset` ejecuta `make db-security` y reinicia GoTrue
  (`docker compose restart gotrue`): sus tablas se recrean al arrancar y el
  reset elimina el esquema `auth`.
- Después de un reset, el usuario de desarrollo debe darse de alta de nuevo
  (request `GoTrue - signup` de la colección Bruno).

## Probar la API con Bruno

La colección vive en `bruno/` (archivos de texto, versionada en git).

1. Abre [Bruno](https://www.usebruno.com/) → **Open Collection** → selecciona la
   carpeta `bruno/` del repo.
2. Arriba a la derecha elige el entorno **Local**.
3. En ese entorno define la variable secreta `gotrueToken` con la salida de:

   ```bash
   make api-token
   ```

4. Ejecuta las requests: `Health` y `Ready` son públicas; `Me` usa el Bearer
   heredado de la colección (sin token válido responde 401).
5. Para probar el flujo real de autenticación (sin token sintético), ejecuta en
   orden `GoTrue - signup`, `GoTrue - login` y `Me con token GoTrue`: el login
   guarda `gotrueAccessToken` y el último request valida `/api/v1/me` con el
   JWT emitido por GoTrue.

Headless (CI o terminal), desde la carpeta `bruno/`:

```bash
TOKEN=$(make -C .. api-token | tail -1)
npx @usebruno/cli run . --env Local --env-var "gotrueToken=$TOKEN"
```

El runner reescribe `environments/Local.bru` al persistir variables de
entorno. `gotrueToken` se pasa en cada corrida por `--env-var`; los tokens de
comprador/staff y las URLs firmadas usan `bru.setVar`, que solo conserva los
valores en memoria durante la corrida. No deben cambiarse a `bru.setEnvVar`.

El flujo completo del Sprint 3A (oferta → orden → pago → comprobante →
aprobación staff → descarga desde MinIO, con idempotencia, revocación y
casos negativos) está en los requests seq 11-36 de la colección. El Sprint 3B
agrega seq 37-68: logins de member/manager/editor, autorización por artista
(lecturas member, mutaciones manager, negativos cruzados 403/404, membresías
por API con auditoría) y dispositivos (registro, heartbeat, revocación propia
y staff, negativos de ciclo de vida). Incluye regresiones de aislamiento
entre cuentas, clave reutilizada con otro payload y nuevos pagos sobre una
orden pagada. Es repetible sin reset; solo hay que re-asignar roles tras un
`make db-reset` (sección anterior). Prerequisitos: `make db-seed`
(demo de tienda) y, tras un reset, `docker compose restart gotrue`.
