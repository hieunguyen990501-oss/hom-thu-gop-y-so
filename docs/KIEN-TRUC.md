# Kiến trúc hệ thống – Hòm thư góp ý số

## 1. Tổng quan

```
 Điện thoại cán bộ, chiến sĩ          Máy tính cán bộ tiếp nhận / xử lý / lãnh đạo / quản trị
 (quét mã QR, không đăng nhập)        (đăng nhập, phân quyền theo vai trò)
            │  HTTPS (mạng nội bộ được phép)          │
            └───────────────┬─────────────────────────┘
                            ▼
                ┌───────────────────────┐   Nhật ký truy cập: KHÔNG ghi IP với cổng công khai
                │ nginx (reverse proxy) │   Ghi IP với khu quản trị (phục vụ kiểm toán)
                └───────────┬───────────┘
                            ▼
      ┌──────────────────────────────────────────────────────┐
      │ Ứng dụng Next.js 15 (Node 22) – một tiến trình        │
      │  Phân hệ A: Cổng góp ý (/ , /gop-y, /tra-cuu, /q)     │
      │  Phân hệ B: Quản trị, xử lý (/quan-tri/...)           │
      │  Phân hệ C: Bảng điều hành, báo cáo                   │
      │  Tầng dịch vụ (src/server/services): kiểm quyền RBAC, │
      │  kiểm phạm vi từng hồ sơ, ghi lịch sử, nhật ký        │
      │  Bộ lập lịch nội bộ: quét hạn xử lý 15 phút/lần       │
      └───────────┬──────────────────────────────────────────┘
                  ▼  Prisma ORM (truy vấn tham số hóa)
      ┌───────────────────────┐        ┌──────────────────────┐
      │ PostgreSQL 17         │──────▶│ Dịch vụ sao lưu       │ pg_dump hằng ngày, giữ 14 bản
      │ trigger chỉ-ghi-thêm   │        │ (container backup)    │
      └───────────────────────┘        └──────────────────────┘
```

Không dùng CDN, phông chữ ngoài, dịch vụ phân tích, AI đám mây hay API bên thứ ba. Phông Be Vietnam Pro, biểu đồ (Recharts), mã QR (thư viện `qrcode`) đều được đóng gói cục bộ.

**Lý do chọn kiến trúc một khối (monolith):** quy mô một lữ đoàn (hàng trăm đến vài nghìn ý kiến/năm), vận hành bởi bộ phận CNTT nhỏ → một ứng dụng + một CSDL dễ triển khai, sao lưu, kiểm định hơn nhiều so với tách microservice. Server Actions của Next.js có sẵn cơ chế chống CSRF (kiểm tra Origin), giảm mã bảo mật phải tự viết.

## 2. Công nghệ

| Lớp | Công nghệ |
|---|---|
| Giao diện | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, thành phần giao diện tự xây theo phong cách shadcn/ui, lucide-react, React Hook Form + Zod, Recharts |
| Máy chủ | Next.js Server Actions + Route Handlers, Prisma 6, PostgreSQL 17 |
| Bảo mật | Argon2id (mật khẩu, mã bí mật tra cứu), AES-256-GCM (thông tin người gửi, khóa TOTP), phiên lưu băm SHA-256, cookie HttpOnly + SameSite=Strict + Secure, CSP có nonce, TOTP (RFC 6238) |
| Triển khai | Docker, Docker Compose, nginx (HTTPS), dịch vụ sao lưu pg_dump |
| Kiểm thử | Vitest + PostgreSQL thật (38 ca), kịch bản kiểm thử sao lưu – khôi phục |

## 3. Cơ sở dữ liệu

```
Role ─< RolePermission >─ Permission
Role ─< User >─ OrganizationalUnit (cây đơn vị: parentId)
User ─< UserCategoryScope >─ FeedbackCategory      (phạm vi lĩnh vực được xem)
User ─< Session                                     (tokenHash, mfaPending, hết hạn)

FeedbackCategory ─< Feedback >─ OrganizationalUnit (bộ phận được giao)
                     │  └─ User (cán bộ được giao)
                     ├── FeedbackSender (1–1, tách riêng, MÃ HÓA; chỉ có khi người gửi tự nguyện)
                     ├─< FeedbackAssignment         (lịch sử phân công)
                     ├─< FeedbackStatusHistory      (CHỈ GHI THÊM – trigger chặn sửa/xóa)
                     ├─< FeedbackResponse           (yêu cầu bổ sung / trả lời; trạng thái duyệt)
                     ├─< FeedbackMessage            (người gửi bổ sung qua mã tra cứu; chỉ ghi thêm)
                     ├─< InternalNote               (ghi chú nội bộ; chỉ ghi thêm)
                     ├─< FeedbackAccessRestriction  (loại trừ người có xung đột lợi ích)
                     └─< Notification >─ User

AuditLog (CHỈ GHI THÊM)   SystemSetting (khóa–giá trị JSON)   ResponseTemplate   FeedbackCounter (cấp mã GY-YYYY-NNNNNN)
```

Các điểm thiết kế chính:

- **Mã hồ sơ** `GY-2026-000001` cấp tuần tự theo năm bằng bộ đếm trong giao dịch. Dữ liệu demo có tiền tố `DEMO-`.
- **Mã bí mật tra cứu** 12 ký tự (≈60 bit), chỉ lưu băm Argon2id; khóa tạm 30 phút sau 10 lần nhập sai.
- **Không có cột IP, thiết bị, tài khoản** trong bảng `Feedback`. Thời điểm gửi được lưu vì cần cho thời hạn xử lý.
- **Bảng `FeedbackSender`** tách riêng, họ tên/liên hệ mã hóa AES-256-GCM bằng khóa `APP_ENCRYPTION_KEY`.
- **Trigger** `htgy_block_history_mutation` chặn UPDATE/DELETE trên `AuditLog`, `FeedbackStatusHistory`, `InternalNote`, `FeedbackMessage`; chỉ thủ tục xóa theo chính sách lưu trữ (đặt cờ phiên `app.retention_purge`) mới xóa được.
- **Chỉ mục** theo trạng thái, thời gian, lĩnh vực, loại, bộ phận/cán bộ được giao, hạn xử lý; chỉ mục `lower(title)` phục vụ tìm kiếm.
- **Migration** trong `prisma/migrations` (áp dụng bằng `prisma migrate deploy`).

## 4. Phân quyền

| Quyền | Quản trị HT | Tiếp nhận | Xử lý | Lãnh đạo |
|---|:-:|:-:|:-:|:-:|
| Xem hồ sơ (toàn bộ trong phạm vi lĩnh vực) | | ✓ | | ✓ |
| Xem hồ sơ được giao (mình/bộ phận) | | | ✓ | |
| Phân loại, phân công | | ✓ | | |
| Cập nhật tiến độ, soạn trả lời, trình duyệt | | | ✓ | |
| Duyệt kết quả, mở lại hồ sơ | | | | ✓ |
| Kết thúc không xử lý, chuyển đầu mối, loại trừ truy cập | | ✓ | | ✓ |
| Xem thông tin người gửi (có ghi nhật ký) | | ✓ | | ✓ |
| Bảng điều hành, báo cáo, xuất dữ liệu | | ✓ | | ✓ |
| Tài khoản, danh mục, cấu hình, nhật ký, lưu trữ, mẫu trả lời | ✓ | | | |
| Mã QR | ✓ | ✓ | | |

Quản trị viên kỹ thuật **không** có quyền đọc nội dung góp ý. Mọi truy vấn hồ sơ đi qua `feedbackScopeWhere()` (src/server/rbac.ts) – không tồn tại và không có quyền trả cùng một thông báo (chống dò hồ sơ, IDOR).

## 5. Luồng nghiệp vụ

```
Người gửi ──quét QR──▶ /q ──▶ trang chủ ──▶ Gửi ý kiến ──▶ [Mã hồ sơ + Mã bí mật]
                                                                │
 Mới tiếp nhận ─▶ Đang phân loại ─▶ Đã phân công ─▶ Đang xử lý ─┼─▶ Chờ bổ sung ◀──▶ người gửi bổ sung
       │                │                                │       │
       └──▶ Kết thúc không xử lý (có lý do)              └─▶ Chờ duyệt ─▶ (trả lại) ─▶ Đang xử lý
       └──▶ Chuyển đầu mối có thẩm quyền                             └─▶ Đã giải quyết ─▶ người gửi đánh giá
```

Người gửi chỉ thấy trạng thái “công khai” (Đã tiếp nhận / Đang xem xét, giải quyết / Cần bổ sung / Đã có kết quả / Đã kết thúc / Đã chuyển cấp có thẩm quyền), phản hồi đã được duyệt và các ghi chú được phép công khai; không thấy tên cán bộ, ghi chú nội bộ.

## 6. Danh sách màn hình

| Phân hệ | Đường dẫn | Màn hình |
|---|---|---|
| A | `/` | Trang chủ: giới thiệu, 3 chức năng |
| A | `/gop-y` | Biểu mẫu gửi ý kiến (ẩn danh/có thông tin), màn hình nhận mã |
| A | `/tra-cuu` | Tra cứu, phản hồi, bổ sung thông tin, đánh giá hài lòng |
| A | `/huong-dan` | Hướng dẫn sử dụng cho người gửi |
| A | `/q` | Điểm vào cố định của mã QR (chuyển hướng nội bộ) |
| B | `/dang-nhap`, `/dang-nhap/xac-thuc`, `/doi-mat-khau` | Đăng nhập, TOTP, đổi mật khẩu |
| B | `/quan-tri/gop-y` | Danh sách hồ sơ: tìm kiếm, lọc, sắp xếp, phân trang, xuất Excel |
| B | `/quan-tri/gop-y/[id]` | Chi tiết: thông tin tiếp nhận, tiến trình (timeline), phân loại, phân công, cập nhật, yêu cầu bổ sung, trả lời, duyệt, kết thúc, chuyển, ghi chú nội bộ, hồ sơ tương tự, loại trừ truy cập |
| B | `/quan-tri/thong-bao` | Thông báo nội bộ |
| B | `/quan-tri/ma-qr`, `/quan-tri/ma-qr/poster` | Tạo, tải (PNG/SVG), in poster A4 |
| B | `/quan-tri/he-thong/*` | Tài khoản, danh mục, cấu hình, mẫu trả lời, nhật ký, lưu trữ |
| B | `/quan-tri/tai-khoan`, `/quan-tri/huong-dan` | Tài khoản của tôi (TOTP), hướng dẫn cho cán bộ |
| C | `/quan-tri/tong-quan` | Bảng điều hành: 7 thẻ số liệu, 5 biểu đồ, 4 danh sách cần chú ý |
| C | `/quan-tri/bao-cao`, `/quan-tri/bao-cao/in` | Báo cáo theo kỳ, xuất Excel, bản in/PDF |

## 7. Rủi ro bảo mật đã xác định và biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Lộ danh tính người gửi ẩn danh qua dữ liệu lưu | Không lưu IP/thiết bị/tài khoản; thông tin tự nguyện mã hóa, tách bảng; danh sách, dashboard, báo cáo không chứa định danh |
| Lộ qua nhật ký máy chủ | nginx không ghi IP với cổng công khai; ứng dụng không ghi log yêu cầu; giới hạn tần suất dùng IP băm trong bộ nhớ, tự hết hạn |
| Lộ qua mã QR cá nhân hóa | Một mã QR chung, không tham số |
| Lộ qua thời điểm gửi đối chiếu nhật ký mạng | Còn tồn tại – nêu rõ trong tài liệu; cần đơn vị kiểm soát nhật ký thiết bị mạng |
| Đoán mã tra cứu, dò hồ sơ (IDOR) | Mã bí mật 60 bit + Argon2id + khóa tạm + giới hạn tần suất; kiểm phạm vi hồ sơ tại server |
| Tấn công tài khoản cán bộ | Argon2id, khóa 15 phút sau 5 lần sai, phiên hết hạn (30 phút không hoạt động / 8 giờ), TOTP, buộc đổi mật khẩu tạm |
| XSS, SQL Injection, CSRF | React tự thoát ký tự, không dùng HTML thô; Prisma tham số hóa; Server Actions kiểm Origin + cookie SameSite=Strict; CSP có nonce |
| Người bị phản ánh xem hồ sơ của chính mình | Loại trừ truy cập theo hồ sơ, thu hồi phân công, chuyển đầu mối độc lập |
| Quản trị viên đọc trộm nội dung | Vai trò quản trị không có quyền đọc hồ sơ; mọi lần xem chi tiết/xem người gửi được ghi nhật ký |
| Sửa, xóa dấu vết | Trigger CSDL chặn sửa/xóa lịch sử và nhật ký |
| Mất dữ liệu | Sao lưu hằng ngày, kiểm tra khôi phục định kỳ, sao lưu riêng khóa mã hóa |
