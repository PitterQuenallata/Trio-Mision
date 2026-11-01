#!/usr/bin/env bash
# Genera los fixtures multipart del flujo staff de importaciones PDF→ChordPro
# (Sprint 4B). El PDF demo (acordes sobre letra, primeros 10 cantos) lo
# produce la herramienta de desarrollo services/worker/cmd/pdfdemo; los
# fixtures resultantes son pequeños y se versionan en bruno/fixtures/.
# Idempotente: regenerar sobrescribe los mismos archivos.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOUNDARY="------------------------------triomision"
FIXTURES="$ROOT/bruno/fixtures"
DEMO_PDF="$FIXTURES/.himnario-demo.pdf"
VACIO_PDF="$FIXTURES/.vacio.pdf"
CORRUPTO_PDF="$FIXTURES/.corrupto.pdf"
FALSO_PDF="$FIXTURES/.falso.pdf"

(cd "$ROOT/services/worker" && go run ./cmd/pdfdemo \
  -dir "$ROOT/content/himnario/acordes-completos" -n 10 -out "$DEMO_PDF")
(cd "$ROOT/services/worker" && go run ./cmd/pdfdemo -kind vacio -out "$VACIO_PDF")

part_pdf() { # $1=ruta $2=nombre de archivo
  printf -- '--%s\r\n' "$BOUNDARY"
  printf 'Content-Disposition: form-data; name="archivo"; filename="%s"\r\n' "$2"
  printf 'Content-Type: application/pdf\r\n\r\n'
  cat "$1"
  printf '\r\n'
}

part_key() { # $1=clave idempotente
  printf -- '--%s\r\n' "$BOUNDARY"
  printf 'Content-Disposition: form-data; name="idempotency_key"\r\n\r\n'
  printf '%s\r\n' "$1"
}

close_form() {
  printf -- '--%s--\r\n' "$BOUNDARY"
}

{
  part_pdf "$DEMO_PDF" "himnario-demo.pdf"
  part_key "bruno-import-demo-v1"
  close_form
} > "$FIXTURES/import-demo-multipart.bin"

{
  part_pdf "$VACIO_PDF" "escaneo.pdf"
  part_key "bruno-import-sintexto-v1"
  close_form
} > "$FIXTURES/import-sintexto-multipart.bin"

# PDF corrupto: firma %PDF seguida de basura (falla en el worker).
{
  printf '%%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF-basura-'
  head -c 4096 /dev/urandom
} > "$CORRUPTO_PDF"
{
  part_pdf "$CORRUPTO_PDF" "corrupto.pdf"
  part_key "bruno-import-corrupto-v1"
  close_form
} > "$FIXTURES/import-corrupto-multipart.bin"

# No es PDF (PNG renombrado): el MIME por contenido lo rechaza en la subida.
{
  printf '\211PNG\r\n\032\n'
  head -c 2048 /dev/urandom
} > "$FALSO_PDF"
{
  part_pdf "$FALSO_PDF" "falso.pdf"
  part_key "bruno-import-falso-v1"
  close_form
} > "$FIXTURES/import-falso-multipart.bin"

# Archivo corrupto con la CLAVE del demo: prueba el 409 de clave reutilizada
# con otro checksum (misma clave idempotente, payload distinto).
{
  part_pdf "$CORRUPTO_PDF" "corrupto.pdf"
  part_key "bruno-import-demo-v1"
  close_form
} > "$FIXTURES/import-corrupto-clave-demo-multipart.bin"

rm -f "$DEMO_PDF" "$VACIO_PDF" "$CORRUPTO_PDF" "$FALSO_PDF"
echo "fixtures de importación generados en $FIXTURES"
