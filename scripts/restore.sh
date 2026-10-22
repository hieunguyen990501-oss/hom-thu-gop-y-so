#!/bin/sh
# Khôi phục CSDL từ tệp sao lưu pg_dump. CẢNH BÁO: ghi đè dữ liệu hiện tại.
# Dùng: sh scripts/restore.sh backups/homthu-YYYYMMDD-HHMMSS.dump
set -eu
f="${1:?Chi dinh tep sao luu .dump}"
[ -f "$f" ] || { echo "Khong thay tep $f"; exit 1; }
if [ -f "$f.sha256" ]; then sha256sum -c "$f.sha256"; fi
printf "Khoi phuc se GHI DE du lieu hien tai. Go KHOIPHUC de tiep tuc: "
read ans
[ "$ans" = "KHOIPHUC" ] || { echo "Da huy."; exit 1; }
docker compose stop app
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < "$f"
docker compose start app
echo "Da khoi phuc tu $f. Kiem tra: dang nhap, so ho so, bang dieu hanh."
