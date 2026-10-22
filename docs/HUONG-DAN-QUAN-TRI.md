# Hướng dẫn sử dụng dành cho cán bộ tiếp nhận, xử lý, lãnh đạo và quản trị

Đăng nhập tại `/dang-nhap`. Lần đầu bắt buộc đổi mật khẩu tạm. Sai mật khẩu 5 lần → khóa 15 phút. Phiên tự hết hạn sau 30 phút không thao tác.

## 1. Cán bộ tiếp nhận
1. **Bảng điều hành** → “Hồ sơ mới chưa được phân công”; hoặc **Hồ sơ góp ý** → lọc “Chưa phân công”.
2. Mở hồ sơ, kiểm tra tính hợp lệ:
   - Không thuộc phạm vi, trùng lặp, không đủ cơ sở → **Kết thúc không xử lý** (bắt buộc ghi lý do; có thể ghi thông báo cho người gửi).
   - Thuộc thẩm quyền cấp khác → **Chuyển đầu mối có thẩm quyền**.
3. **Phân loại**: xác nhận lĩnh vực (hệ thống có gợi ý theo từ khóa, chỉ để tham khảo), loại ý kiến, mức ưu tiên; đánh dấu “Cần lãnh đạo xem xét” khi cần. Hạn xử lý được tính lại theo mức ưu tiên/lĩnh vực.
4. **Phân công**: chọn bộ phận và/hoặc cán bộ xử lý, đặt hạn xử lý, ghi nội dung chỉ đạo.
5. **Hồ sơ nhạy cảm, liên quan đến cán bộ cụ thể**: dùng **Loại trừ quyền truy cập** với người liên quan (người đó không xem được hồ sơ kể cả có quyền chung; nếu đang được giao thì bị thu hồi), rồi phân công cho tài khoản **đầu mối độc lập**.
6. Theo dõi thông báo “sắp đến hạn”, “quá hạn” để đôn đốc.
7. **Thông tin người gửi** (chỉ khi người gửi tự nguyện cung cấp): bấm “Xem thông tin người gửi” khi thật cần; mỗi lần xem được ghi nhật ký.

## 2. Cán bộ xử lý
1. Menu **Việc được giao**.
2. Chuyển **Đang xử lý**, ghi chú nội bộ quá trình xác minh.
3. Cần thêm thông tin → **Yêu cầu người gửi bổ sung** (người gửi trả lời qua trang tra cứu; khi họ trả lời, hồ sơ tự chuyển lại “Đang xử lý” và có thông báo).
4. Hoàn thành → nhập **Kết luận xử lý** (nội bộ) và **Nội dung trả lời người gửi** (có thể chèn mẫu trả lời đã duyệt) → **Trình duyệt kết quả**.
5. Bị trả lại → đọc lý do, xử lý tiếp, trình lại.

## 3. Lãnh đạo, chỉ huy
1. **Bảng điều hành**: thẻ số liệu, biểu đồ theo tháng, lĩnh vực, trạng thái, xu hướng, theo bộ phận; danh sách quá hạn, chờ duyệt. Lọc theo khoảng thời gian.
2. Hồ sơ **Chờ duyệt**: đọc kết luận, chỉnh sửa nội dung trả lời nếu cần → **Phê duyệt** (công bố cho người gửi) hoặc **Trả lại** (ghi lý do).
3. **Mở lại** hồ sơ đã giải quyết khi kết quả chưa đạt.
4. **Báo cáo**: chọn tuần/tháng/quý/năm/tùy chỉnh → **Xuất Excel** hoặc **Bản in / PDF** (có thể chỉnh phần nhận xét trước khi in; chọn máy in “Lưu dưới dạng PDF”).

## 4. Quản trị hệ thống
- **Tài khoản, phân quyền**: tạo tài khoản (mật khẩu tạm ngẫu nhiên hiển thị một lần), gán vai trò, đơn vị, phạm vi lĩnh vực, đánh dấu đầu mối độc lập; khóa tài khoản; cấp lại mật khẩu; mở khóa.
- **Danh mục**: lĩnh vực (thời hạn riêng, từ khóa gợi ý), đơn vị/bộ phận (bộ phận xử lý, đơn vị người gửi chọn được). Không xóa mục đã có dữ liệu – chuyển “ngừng sử dụng”.
- **Cấu hình**: mở/tạm dừng tiếp nhận, cho phép gửi có thông tin, giới hạn gửi/giờ, quy trình duyệt, thời hạn theo mức ưu tiên, cảnh báo sắp đến hạn, thời hạn lưu trữ, vai trò bắt buộc 2FA, chế độ demo/chính thức.
- **Mẫu trả lời**: soạn, phê duyệt (sửa nội dung phải duyệt lại).
- **Nhật ký hệ thống**: tra cứu đăng nhập, thay đổi cấu hình, xem hồ sơ, xem thông tin người gửi, xuất dữ liệu... Nhật ký không sửa/xóa được.
- **Lưu trữ, xóa dữ liệu**: xóa hồ sơ hết hạn lưu trữ; **xóa dữ liệu demo trước khi vận hành chính thức**.
- **Mã QR**: xem [THAY-URL-QR.md](THAY-URL-QR.md).
- Quản trị viên **không** đọc được nội dung góp ý. Nếu cần, phải được giao thêm vai trò phù hợp theo quyết định của chỉ huy.

## 5. Quy trình trạng thái

| Nội bộ | Người gửi nhìn thấy |
|---|---|
| Mới tiếp nhận | Đã tiếp nhận |
| Đang phân loại | Đang xem xét |
| Đã phân công / Đang xử lý / Chờ duyệt kết quả | Đang xem xét, giải quyết |
| Chờ bổ sung thông tin | Cần bổ sung thông tin |
| Đã giải quyết | Đã có kết quả giải quyết |
| Kết thúc không xử lý | Đã kết thúc |
| Chuyển đầu mối có thẩm quyền | Đã chuyển đến cấp có thẩm quyền |

## 6. Khôi phục quyền quản trị khi mất mật khẩu
Trên máy chủ: `docker compose exec app npx tsx scripts/create-admin.ts quantri2 "Họ và tên"` → in mật khẩu tạm mới (thao tác được ghi nhật ký).
