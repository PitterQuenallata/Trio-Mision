#!/usr/bin/env bash
# Crea/actualiza los logins de servicio con secretos locales y privilegios
# NOLOGIN definidos en 00014_least_privilege.sql. Nunca imprime contraseñas.
set -euo pipefail

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${POSTGRES_USER:?falta POSTGRES_USER}"
: "${POSTGRES_DB:?falta POSTGRES_DB}"
: "${API_DB_PASSWORD:?falta API_DB_PASSWORD}"
: "${GOTRUE_DB_PASSWORD:?falta GOTRUE_DB_PASSWORD}"

docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -v api_password="$API_DB_PASSWORD" -v gotrue_password="$GOTRUE_DB_PASSWORD" <<'SQL'
select 'create role triomision_api login'
where not exists (select from pg_roles where rolname = 'triomision_api') \gexec
select 'create role triomision_gotrue login'
where not exists (select from pg_roles where rolname = 'triomision_gotrue') \gexec

alter role triomision_api login password :'api_password';
alter role triomision_gotrue login password :'gotrue_password';
grant api_app to triomision_api;
grant gotrue_app to triomision_gotrue;
alter role triomision_api set search_path to "$user", public;
alter role triomision_gotrue set search_path to "$user", public, auth;
SQL

echo "cuentas de servicio PostgreSQL configuradas"
