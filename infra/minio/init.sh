#!/usr/bin/env bash
set -euo pipefail

: "${MINIO_ROOT_USER:?falta MINIO_ROOT_USER}"
: "${MINIO_ROOT_PASSWORD:?falta MINIO_ROOT_PASSWORD}"
: "${S3_BUCKET:?falta S3_BUCKET}"
: "${S3_ACCESS_KEY:?falta S3_ACCESS_KEY}"
: "${S3_SECRET_KEY:?falta S3_SECRET_KEY}"

for attempt in {1..30}; do
  if mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" = 30 ]; then
    echo "MinIO no aceptó conexiones a tiempo" >&2
    exit 1
  fi
  sleep 1
done

mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set download "local/$S3_BUCKET/public"

policy_file=/tmp/triomision-api-policy.json
cat >"$policy_file" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
JSON

if ! mc admin user info local "$S3_ACCESS_KEY" >/dev/null 2>&1; then
  mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
fi
mc admin policy create local triomision-api-rw "$policy_file"
mc admin policy attach local triomision-api-rw --user "$S3_ACCESS_KEY"

echo "bucket y cuenta S3 de servicio configurados"
