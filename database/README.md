# Database

Esquema y datos de la base de datos del ecosistema.

- `migrations/` — migraciones SQL con [goose](https://github.com/pressly/goose)
  (anotaciones `-- +goose Up/Down`; nombres `NNNNN_tema.sql`).
- `seeds/` — datos semilla. El seed de desarrollo es un comando Go:
  `services/api/cmd/seed` (idempotente; lee el himnario desde
  `content/himnario/` y carga un catálogo mínimo).

## Uso

```bash
go install github.com/pressly/goose/v3/cmd/goose@v3.24.3   # una sola vez
cp .env.example .env                                       # si no existe
make up          # PostgreSQL en Docker (o PostgreSQL nativo)
make db-migrate  # aplica migraciones pendientes con DB_ADMIN_URL
make db-security # crea/actualiza las cuentas restringidas de API y GoTrue
make db-seed     # datos de desarrollo con la cuenta de API
make db-status   # estado de las migraciones
make db-reset    # revierte todo y migra desde cero (¡destruye datos!)
```

Las migraciones usan `DB_ADMIN_URL`; la API usa `API_DATABASE_URL` con una
cuenta sin SUPERUSER ni acceso a `auth`. GoTrue tiene otra cuenta propia.
Después de `make db-reset` hay que ejecutar `make db-security` y reiniciar
GoTrue para que re-migre su esquema: `docker compose restart gotrue`.

Modelo de referencia: `docs/architecture/modelo-datos-v2.md`. Núcleo actual:
identidad (`profiles`, `staff_roles`), catálogo (`styles`, `artists`,
`artist_members`, `albums`, `songs`, `themes`, `song_themes`,
`song_external_links`) e himnario versionado (`hymn_collections`, `hymns`,
`hymn_versions`).
