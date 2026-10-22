# Danh sách kiểm tra an toàn thông tin trước khi nghiệm thu và triển khai

Đánh dấu từng mục khi đã kiểm tra trên **máy chủ thật**. Mục có ghi “(đã kiểm thử tự động)” đã được kiểm chứng bằng bộ kiểm thử trong quá trình phát triển; vẫn cần xác nhận lại sau khi triển khai.

## A. Phê duyệt và phạm vi
- [ ] Có văn bản phê duyệt của cấp có thẩm quyền về: mạng sử dụng, phạm vi dữ liệu, người được giao tiếp nhận/xử lý.
- [ ] Đã phổ biến nguyên tắc: không dùng hệ thống cho bí mật nhà nước, bí mật quân sự, thông tin tác chiến, bố trí lực lượng.
- [ ] Hệ thống chỉ truy cập được trong mạng được phép; đã kiểm tra từ ngoài mạng **không** truy cập được.
- [ ] Đã quyết định: thời hạn xử lý, thời hạn lưu trữ, người có quyền xem thông tin người gửi, đầu mối độc lập.

## B. Máy chủ và mạng
- [ ] Hệ điều hành cập nhật bản vá; chỉ mở cổng 80/443 (và SSH cho quản trị, giới hạn nguồn).
- [ ] CSDL không công bố cổng ra ngoài (`docker compose ps` không có cổng 5432).
- [ ] HTTPS hoạt động; chứng chỉ do CA nội bộ cấp (hoặc đã phân phối chứng chỉ tự ký có kiểm soát).
- [ ] `COOKIE_SECURE=true`, `TRUST_PROXY=true` khi chạy sau nginx.
- [ ] Nhật ký nginx: `public.log` không chứa địa chỉ IP; đã kiểm tra thực tế.
- [ ] Đã rà soát nhật ký của thiết bị mạng (Wi-Fi, tường lửa) – thời gian lưu và người được xem – vì có thể dùng để đối chiếu thời điểm gửi ý kiến.

## C. Bí mật và tài khoản
- [ ] `POSTGRES_PASSWORD`, `APP_ENCRYPTION_KEY` sinh ngẫu nhiên, không dùng giá trị mẫu; `.env` quyền 600.
- [ ] `APP_ENCRYPTION_KEY` đã sao lưu riêng, tách khỏi bản sao lưu CSDL.
- [ ] Đã xóa `runtime/.initial-admin.txt` sau khi đổi mật khẩu quản trị đầu tiên.
- [ ] Không còn mật khẩu mặc định cố định trong mã nguồn (đã kiểm thử tự động: mọi mật khẩu khởi tạo đều ngẫu nhiên).
- [ ] Tài khoản quản trị, lãnh đạo đã bật xác thực hai yếu tố.
- [ ] Mỗi người một tài khoản, không dùng chung; tài khoản người chuyển công tác đã khóa.

## D. Ứng dụng
- [ ] Khóa tài khoản sau 5 lần sai mật khẩu (đã kiểm thử tự động).
- [ ] Phiên hết hạn sau thời gian không hoạt động (đã kiểm thử tự động).
- [ ] Phân quyền thực thi tại server: cán bộ xử lý không xem được hồ sơ không được giao; quản trị viên không đọc được nội dung (đã kiểm thử tự động – kiểm thử 6, 15).
- [ ] Truy cập hồ sơ người khác bằng cách đổi ID trên địa chỉ bị từ chối (đã kiểm thử tự động – IDOR).
- [ ] Tra cứu sai mã bí mật bị từ chối, khóa tạm sau 10 lần (đã kiểm thử tự động – kiểm thử 5).
- [ ] Mã bí mật, mật khẩu chỉ lưu dạng băm Argon2id; thông tin người gửi mã hóa (đã kiểm thử tự động).
- [ ] Lịch sử xử lý, nhật ký không sửa/xóa được (đã kiểm thử tự động – trigger CSDL).
- [ ] Tiêu đề bảo mật: CSP có nonce, X-Frame-Options DENY, nosniff, Referrer-Policy no-referrer (đã kiểm tra trên bản build production).
- [ ] Không tải tài nguyên từ bên ngoài (CDN, phông chữ, phân tích): mở công cụ phát triển của trình duyệt, tab Network chỉ có yêu cầu tới máy chủ của đơn vị.
- [ ] Không có chức năng tải tệp lên (phiên bản đầu không hỗ trợ).
- [ ] Hệ thống đang ở **chế độ chính thức**, đã **xóa dữ liệu demo**, tài khoản demo đã vô hiệu hóa.

## E. Ẩn danh – kiểm tra thực tế
- [ ] Gửi thử một ý kiến ẩn danh; kiểm tra bản ghi trong CSDL không có IP, thiết bị, tài khoản.
- [ ] Danh sách hồ sơ, bảng điều hành, báo cáo, tệp Excel không chứa thông tin định danh người gửi.
- [ ] Mã QR là mã chung, không có tham số.
- [ ] Tài liệu, poster, giao diện **không** tuyên bố “ẩn danh tuyệt đối”.
- [ ] Đã xác định ai có quyền truy cập máy chủ/CSDL ở mức hệ điều hành (người này có thể đọc dữ liệu thô) và có cam kết bảo mật.

## F. Sao lưu, vận hành
- [ ] Dịch vụ `backup` tạo được tệp sao lưu hằng ngày.
- [ ] Đã khôi phục thử thành công một bản sao lưu trên máy kiểm tra (xem SAO-LUU-KHOI-PHUC.md mục 4).
- [ ] Có người chịu trách nhiệm theo dõi nhật ký hệ thống định kỳ (hằng tuần).
- [ ] Có quy trình xử lý sự cố: lộ mật khẩu, mất thiết bị, nghi ngờ truy cập trái phép.

Người kiểm tra: ……………………  Ngày: ……………  Kết luận: ……………………………
