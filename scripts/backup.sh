#!/bin/sh
# Sao lưu thủ công ngay lập tức (chạy trên máy chủ, trong thư mục dự án).
set -eu
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backups/homthu-manual-$ts.dump"
sha256sum "backups/homthu-manual-$ts.dump" > "backups/homthu-manual-$ts.dump.sha256"
echo "Da sao luu: backups/homthu-manual-$ts.dump"
