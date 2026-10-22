# Hướng dẫn cài đặt

> Hệ thống chỉ được triển khai sau khi bộ phận có thẩm quyền phê duyệt về mạng sử dụng, an toàn thông tin và phạm vi dữ liệu. Không mở ra Internet khi chưa được phép.

## A. Triển khai chính thức bằng Docker (khuyến nghị)

### 1. Yêu cầu máy chủ
- Máy chủ Linux (Ubuntu 22.04/24.04 hoặc tương đương) trong mạng nội bộ được phép; 2 CPU, 4 GB RAM, 40 GB đĩa.
- Docker Engine 24+ và Docker Compose v2.
- Địa chỉ cố định (IP nội bộ hoặc tên miền nội bộ), do bộ phận CNTT cấp.
- Điện thoại của cán bộ, chiến sĩ phải kết nối được vào mạng này (Wi-Fi nội bộ được phép).

### 2. Chuẩn bị mã nguồn và cấu hình
```bash
# chép thư mục dự án lên máy chủ, ví dụ /opt/hom-thu-gop-y
cd /opt/hom-thu-gop-y
cp .env.example .env
```
Sửa `.env`:

| Biến | Giá trị |
|---|---|
| `POSTGRES_PASSWORD` | Mật khẩu ngẫu nhiên mạnh (≥ 24 ký tự) |
| `APP_ENCRYPTION_KEY` | Sinh bằng `openssl rand -base64 32`. **Sao lưu riêng khóa này** |
| `PUBLIC_BASE_URL` | Địa chỉ chính thức, ví dụ `https://gopy.lu572.local` |
| `SERVER_NAME` | Tên miền/IP tương ứng, ví dụ `gopy.lu572.local` |
| `SESSION_IDLE_MINUTES`, `SESSION_MAX_HOURS` | Mặc định 30 phút / 8 giờ |

Hoặc sinh tự động khóa và mật khẩu: `node scripts/init-env.mjs` (khi máy có Node.js).

### 3. Chứng chỉ HTTPS
- Có chứng chỉ do đơn vị cấp: chép vào `docker/nginx/certs/server.crt` và `server.key`.
- Chưa có: tạo chứng chỉ tự ký `sh scripts/gen-cert.sh gopy.lu572.local` (trình duyệt sẽ cảnh báo; nên dùng CA nội bộ của đơn vị).

### 4. Khởi động
```bash
docker compose build
docker compose up -d
docker compose ps          # các dịch vụ ở trạng thái running/healthy
```
Lần đầu khởi động, ứng dụng tự áp dụng migration và tạo tài khoản quản trị `quantri` với **mật khẩu tạm ngẫu nhiên**:
```bash
docker compose exec app cat runtime/.initial-admin.txt
docker compose exec app rm runtime/.initial-admin.txt   # xóa sau khi đã ghi nhận
```
Đăng nhập `https://<địa-chỉ>/dang-nhap`, đổi mật khẩu, bật xác thực hai yếu tố.

### 5. Cấu hình ban đầu (trong trang quản trị)
1. Danh mục → cập nhật đơn vị, bộ phận xử lý theo thực tế (danh mục hiện tại là **mẫu**).
2. Danh mục → rà soát lĩnh vực, thời hạn, từ khóa gợi ý.
3. Cấu hình → thời hạn xử lý, quy trình duyệt, giới hạn gửi, thời hạn lưu trữ.
4. Tài khoản → tạo tài khoản tiếp nhận, xử lý, lãnh đạo; giao mật khẩu tạm trực tiếp.
5. Mã QR → kiểm tra địa chỉ chính thức, in poster.

### 6. Cập nhật phiên bản
```bash
sh scripts/backup.sh               # sao lưu trước
docker compose build && docker compose up -d   # migration tự áp dụng khi khởi động
```

## B. Chạy thử trên máy cá nhân (Windows/Linux, không cần Docker)

Yêu cầu Node.js 22+ (đã thử với Node 24).
```bash
npm install
node scripts/init-env.mjs          # tạo .env với khóa ngẫu nhiên
npm run db:local                   # cửa sổ 1: PostgreSQL cục bộ (cổng 54329)
npx prisma migrate deploy          # cửa sổ 2
npm run db:seed-demo               # dữ liệu nền + dữ liệu DEMO, in tài khoản demo
npm run dev                        # http://localhost:3000
```
- Tài khoản demo và một số mã tra cứu demo được ghi vào `.demo-accounts.txt` (mật khẩu ngẫu nhiên, bắt buộc đổi khi đăng nhập lần đầu).
- Để điện thoại trong cùng mạng Wi-Fi truy cập thử: `npx next dev -H 0.0.0.0`, đặt địa chỉ chính thức trong Mã QR là `http://<IP-máy>:3000`. Chỉ dùng để trình diễn.

## C. Kiểm thử
```bash
npm test                 # 38 ca kiểm thử với PostgreSQL thật (tự khởi động CSDL kiểm thử riêng)
npm run test:backup      # kiểm thử sao lưu – khôi phục mức tệp
npm run typecheck
npm run build
```
