#!/usr/bin/env bash
# Genera un JWT de desarrollo compatible con GoTrue para probar endpoints
# protegidos sin hacer login. Para validar el flujo real usar los requests
# "GoTrue - signup" y "GoTrue - login" de la colección Bruno.
#
# Uso:
#   ./scripts/mint-dev-token.sh [sub] [email] [horas]
#   make api-token
set -euo pipefail

SECRET="${GOTRUE_JWT_SECRET:-}"
if [ -z "$SECRET" ] && [ -f .env ]; then
  SECRET=$(grep -E '^GOTRUE_JWT_SECRET=' .env | cut -d= -f2-)
fi
: "${SECRET:?define GOTRUE_JWT_SECRET en el entorno o en .env}"

AUD="${GOTRUE_JWT_AUDIENCE:-authenticated}"
# sub debe ser un UUID: profiles.id es uuid y /me inserta el perfil con ese valor.
SUB="${1:-11111111-2222-4333-8444-555555555555}"
EMAIL="${2:-dev@triomision.bo}"
HOURS="${3:-8}"
EXP=$(( $(date +%s) + HOURS * 3600 ))

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
payload=$(printf '{"sub":"%s","email":"%s","role":"authenticated","aud":"%s","exp":%d}' \
  "$SUB" "$EMAIL" "$AUD" "$EXP" | b64url)
sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$SECRET" -binary | b64url)

echo "$header.$payload.$sig"
