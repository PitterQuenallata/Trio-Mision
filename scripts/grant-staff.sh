#!/usr/bin/env bash
# Asigna un rol staff (admin | editor | vendedor) a un usuario registrado en
# GoTrue. Asegura el perfil en profiles (mismo patrón perezoso que /me) y
# registra el rol en staff_roles, que es lo que la API consulta para autorizar.
#
# Uso (desde la raíz del monorepo):
#   ./scripts/grant-staff.sh dev@triomision.local vendedor
#   make db-staff EMAIL=dev@triomision.local ROLE=admin
set -euo pipefail

EMAIL="${1:-}"
ROLE="${2:-vendedor}"

if [ -z "$EMAIL" ]; then
  echo "uso: $0 <email> [admin|editor|vendedor]" >&2
  exit 1
fi
case "$ROLE" in
  admin | editor | vendedor) ;;
  *)
    echo "rol inválido: $ROLE (admin | editor | vendedor)" >&2
    exit 1
    ;;
esac

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "faltan POSTGRES_USER/POSTGRES_DB en el .env" >&2
  exit 1
fi

docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -v email="$EMAIL" -v role="$ROLE" <<'SQL'
insert into profiles (id, display_name, email)
select id, split_part(email, '@', 1), email from auth.users where email = :'email'
on conflict (id) do update set email = excluded.email;

insert into staff_roles (user_id, role)
select id, :'role' from auth.users where email = :'email'
on conflict do nothing;

insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
select null, 'rol.asignado', 'profile', id::text,
       jsonb_build_object('role', :'role', 'source', 'db-staff')
from auth.users where email = :'email';
SQL

echo "rol '$ROLE' asignado a $EMAIL"
