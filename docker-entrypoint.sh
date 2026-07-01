#!/bin/sh
set -eu

# Runtime: `env_file: .env` provides VITE_FILE_SERVICE_URL (nginx proxy target for /files).
: "${VITE_FILE_SERVICE_URL:?Set VITE_FILE_SERVICE_URL in .env}"

export FILE_SERVICE_UPSTREAM="${VITE_FILE_SERVICE_URL}"
echo "[hopeweb] file proxy -> ${FILE_SERVICE_UPSTREAM}"

envsubst '$FILE_SERVICE_UPSTREAM' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -t
exec nginx -g 'daemon off;'
