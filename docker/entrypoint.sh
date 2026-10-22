#!/bin/sh
# Áp dụng migration (an toàn khi chạy lại) và dữ liệu nền trước khi khởi động ứng dụng.
set -e
echo "[entrypoint] Ap dung migration CSDL..."
npx prisma migrate deploy
echo "[entrypoint] Kiem tra du lieu nen (vai tro, quyen, danh muc)..."
npx tsx prisma/seed.ts
exec "$@"
