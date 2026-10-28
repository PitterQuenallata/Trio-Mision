#!/usr/bin/env bash
# Asigna una membresía por artista (member | manager) a un usuario registrado
# en GoTrue. Asegura el perfil en profiles (mismo patrón perezoso que /me) y
# registra la membresía en artist_members, que es lo que la API consulta para
# autorizar. Uso operativo de arranque: después, los managers asignan roles
# desde la propia API (POST /api/v1/mis-artistas/{artistId}/miembros), que
# queda auditado como source 'api'.
#
# Uso (desde la raíz del monorepo):
#   ./scripts/grant-artist-role.sh manager@triomision.local manager trio-mision
#   make db-artist-role EMAIL=manager@triomision.local ROLE=manager ARTIST=trio-mision
set -euo pipefail

EMAIL="${1:-}"
ROLE="${2:-manager}"
ARTIST="${3:-trio-mision}"

if [ -z "$EMAIL" ]; then
  echo "uso: $0 <email> [member|manager] [slug-del-artista]" >&2
  exit 1
fi
case "$ROLE" in
  member | manager) ;;
  *)
    echo "rol inválido: $ROLE (member | manager)" >&2
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
  -v email="$EMAIL" -v role="$ROLE" -v artist="$ARTIST" <<'SQL'
insert into profiles (id, display_name, email)
select id, split_part(email, '@', 1), email from auth.users where email = :'email'
on conflict (id) do update set email = excluded.email;

insert into artist_members (artist_id, user_id, member_role)
select ar.id, au.id, :'role'
from auth.users au
cross join lateral (select id from artists where slug = :'artist') ar
where au.email = :'email'
on conflict do nothing;

insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
select null, 'rol.asignado', 'artist_members', ar.id::text,
       jsonb_build_object('member_role', :'role', 'source', 'db-artist-role',
                          'usuario_id', au.id)
from auth.users au
cross join lateral (select id from artists where slug = :'artist') ar
where au.email = :'email';
SQL

echo "membresía '$ROLE' en '$ARTIST' asignada a $EMAIL"
