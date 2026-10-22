# Hướng dẫn thay địa chỉ để tạo mã QR triển khai thực tế

## Nguyên lý
Mã QR luôn mã hóa địa chỉ cố định **`<địa chỉ chính thức>/q`**. Trang `/q` chuyển hướng nội bộ tới **đường dẫn đích** (mặc định `/` – trang chủ). Nhờ vậy:
- Đổi đích (ví dụ vào thẳng biểu mẫu `/gop-y`) **không cần in lại** mã QR.
- Chỉ phải in lại khi đổi **địa chỉ chính thức** (tên miền/IP).
- Mã QR dùng chung cho cả đơn vị, không chứa tham số định danh người quét.

## Các bước
1. Bộ phận CNTT cấp địa chỉ chính thức của máy chủ trong mạng nội bộ, ví dụ `https://gopy.lu572.local` hoặc `https://10.x.x.x`.
2. Đặt `PUBLIC_BASE_URL` trong `.env` (giá trị mặc định ban đầu) – hoặc đăng nhập tài khoản quản trị → **Mã QR** → “Địa chỉ chính thức của hệ thống” → Lưu.
3. (Tùy chọn) “Đường dẫn đích khi quét”: `/` hoặc `/gop-y`.
4. Kiểm tra: dùng 2–3 điện thoại khác nhau, đã kết nối mạng được phép, quét mã trên màn hình → phải mở được trang chủ hòm thư.
5. Tải **PNG** (in khổ lớn) hoặc **SVG** (đưa vào thiết kế), hoặc bấm **Poster A4** → **In poster** (bật “In hình nền”, chọn lề tối thiểu).
6. Dán poster ở vị trí thuận tiện, kín đáo vừa đủ để cán bộ, chiến sĩ quét mà không ngại bị quan sát.

## Lưu ý
- Mã QR không tự cấp quyền truy cập mạng: điện thoại phải kết nối mạng nội bộ chứa máy chủ.
- Không tự ý mở hệ thống ra Internet khi chưa được phê duyệt.
- Không dùng dịch vụ tạo QR trực tuyến; mã được sinh ngay trên máy chủ.
- Poster không sử dụng quân hiệu/biểu tượng chính thức; nếu đơn vị có tệp biểu tượng hợp lệ được phép sử dụng, bổ sung vào thiết kế poster (`src/app/quan-tri/ma-qr/poster/page.tsx`).
