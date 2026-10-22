#!/bin/sh
# Sao lưu CSDL hằng ngày bằng pg_dump (định dạng custom, có nén), giữ BACKUP_KEEP_DAYS ngày.
set -eu
mkdir -p /backups
echo "[backup] Khoi dong. Sao luu luc ${BACKUP_HOUR}h hang ngay, giu ${BACKUP_KEEP_DAYS} ngay."
last=""
while true; do
  today=$(date +%Y-%m-%d)
  hour=$(date +%H | sed 's/^0//')
  if [ "$hour" = "${BACKUP_HOUR}" ] && [ "$last" != "$today" ]; then
    f="/backups/homthu-$(date +%Y%m%d-%H%M%S).dump"
    if pg_dump -Fc -f "$f.tmp"; then
      mv "$f.tmp" "$f"
      sha256sum "$f" > "$f.sha256"
      echo "[backup] Da tao $f"
      last="$today"
      find /backups -name 'homthu-*.dump*' -mtime +"${BACKUP_KEEP_DAYS}" -delete
    else
      echo "[backup] LOI sao luu" >&2
      rm -f "$f.tmp"
    fi
  fi
  sleep 300
done
