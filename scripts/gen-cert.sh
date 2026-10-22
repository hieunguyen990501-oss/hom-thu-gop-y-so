#!/bin/sh
# Tạo chứng chỉ tự ký cho mạng nội bộ khi chưa có chứng chỉ do đơn vị cấp.
# Dùng: sh scripts/gen-cert.sh gopy.lu572.local
set -eu
name="${1:?Ten mien/dia chi may chu}"
mkdir -p docker/nginx/certs
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout docker/nginx/certs/server.key -out docker/nginx/certs/server.crt \
  -subj "/CN=$name" -addext "subjectAltName=DNS:$name"
chmod 600 docker/nginx/certs/server.key
echo "Da tao docker/nginx/certs/server.crt va server.key cho $name"
