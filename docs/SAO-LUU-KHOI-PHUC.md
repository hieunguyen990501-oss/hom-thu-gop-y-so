# Sao lưu và khôi phục dữ liệu

## 1. Những gì cần sao lưu

| Thành phần | Cách sao lưu | Ghi chú |
|---|---|---|
| CSDL PostgreSQL | Tự động: dịch vụ `backup` chạy `pg_dump -Fc` hằng ngày lúc `BACKUP_HOUR` (mặc định 2h), giữ `BACKUP_KEEP_DAYS` (mặc định 14) ngày, kèm tệp `.sha256` | Thư mục `./backups` trên máy chủ |
| Khóa `APP_ENCRYPTION_KEY` | Ghi ra giấy/thiết bị lưu trữ an toàn, cất **tách riêng** bản sao lưu CSDL | Mất khóa = không giải mã được thông tin người gửi đã lưu |
| Tệp `.env`, chứng chỉ `docker/nginx/certs` | Sao chép thủ công khi thay đổi | Không lưu chung với bản sao lưu CSDL |

Khuyến nghị: định kỳ hằng tuần chép thư mục `backups/` sang thiết bị lưu trữ khác **được phép** của đơn vị (không đưa lên dịch vụ đám mây khi chưa được phép).

## 2. Sao lưu thủ công
```bash
sh scripts/backup.sh       # tạo backups/homthu-manual-YYYYMMDD-HHMMSS.dump (+ .sha256)
```
Thực hiện trước mỗi lần cập nhật phiên bản, xóa dữ liệu theo chính sách lưu trữ.

## 3. Khôi phục
```bash
sh scripts/restore.sh backups/homthu-20261022-020000.dump
```
Kịch bản sẽ: kiểm tra mã băm → hỏi xác nhận (gõ `KHOIPHUC`) → dừng ứng dụng → tạo lại CSDL → `pg_restore` → khởi động lại ứng dụng.

Khôi phục sang máy chủ mới: cài như [CAI-DAT.md](CAI-DAT.md) với **cùng `APP_ENCRYPTION_KEY`**, khởi động `db`, chạy `restore.sh`.

## 4. Kiểm tra khôi phục định kỳ (bắt buộc hằng quý)
1. Trên máy kiểm tra (không phải máy chủ chính), khôi phục bản sao lưu gần nhất.
2. Đăng nhập, đối chiếu: tổng số hồ sơ trên bảng điều hành, 3 hồ sơ bất kỳ (nội dung, lịch sử), nhật ký hệ thống.
3. Tra cứu thử một hồ sơ bằng mã bí mật (nếu có hồ sơ demo/kiểm thử).
4. Lập biên bản: ngày, bản sao lưu dùng, kết quả, người thực hiện.

## 5. Kết quả kiểm thử đã thực hiện khi phát triển
- `npm run test:backup` (scripts/test-backup-restore.mjs): sao lưu **mức tệp** (dừng CSDL, sao chép thư mục dữ liệu) → giả lập mất dữ liệu → khôi phục → đối chiếu số hồ sơ, lịch sử, nhật ký, trigger bảo vệ và mã băm nội dung: **ĐẠT** (22/10/2026, 26 hồ sơ, 110 bản ghi lịch sử).
- Phương án `pg_dump/pg_restore` trong Docker **chưa chạy thử** được trên máy phát triển (không có Docker và công cụ pg_dump). Cần chạy mục 4 ngay sau khi triển khai trên máy chủ thật và trước khi nghiệm thu.

## 6. Chính sách lưu trữ và xóa dữ liệu
- Thời hạn lưu hồ sơ đã kết thúc: cấu hình tại Cấu hình → “Thời hạn lưu hồ sơ đã kết thúc” (mặc định đề xuất 36 tháng – **cần đơn vị quyết định**).
- Xóa: Quản trị → Lưu trữ, xóa dữ liệu → nhập `XOA DU LIEU` → xác nhận. Xóa vĩnh viễn hồ sơ và lịch sử kèm theo; nhật ký kiểm toán giữ lại và ghi nhận thao tác xóa.
- Bản sao lưu cũ hơn `BACKUP_KEEP_DAYS` tự xóa. Dữ liệu đã xóa khỏi CSDL vẫn tồn tại trong các bản sao lưu đến khi bản sao lưu hết hạn.
