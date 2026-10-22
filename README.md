# HÒM THƯ GÓP Ý SỐ – Lữ đoàn Pháo binh 572, Quân khu 5

*Lắng nghe ý kiến – Tiếp nhận kịp thời – Giải quyết trách nhiệm*

Hệ thống web tiếp nhận kiến nghị, phản ánh, đề xuất của cán bộ, chiến sĩ qua mã QR (có thể gửi ẩn danh). Cán bộ dùng hệ thống để phân loại, phân công, xử lý và trả lời; lãnh đạo theo dõi bảng điều hành và báo cáo.

## Tài liệu
| Tài liệu | Nội dung |
|---|---|
| [docs/KIEN-TRUC.md](docs/KIEN-TRUC.md) | Kiến trúc, sơ đồ CSDL, phân quyền, luồng nghiệp vụ, màn hình, rủi ro bảo mật |
| [docs/CAI-DAT.md](docs/CAI-DAT.md) | Cài đặt bằng Docker, chạy thử trên máy cá nhân, kiểm thử |
| [docs/HUONG-DAN-NGUOI-GUI.md](docs/HUONG-DAN-NGUOI-GUI.md) | Hướng dẫn cho cán bộ, chiến sĩ |
| [docs/HUONG-DAN-QUAN-TRI.md](docs/HUONG-DAN-QUAN-TRI.md) | Hướng dẫn cho tiếp nhận, xử lý, lãnh đạo, quản trị |
| [docs/SAO-LUU-KHOI-PHUC.md](docs/SAO-LUU-KHOI-PHUC.md) | Sao lưu, khôi phục, chính sách lưu trữ |
| [docs/KIEM-TRA-BAO-MAT.md](docs/KIEM-TRA-BAO-MAT.md) | Danh sách kiểm tra an toàn thông tin trước nghiệm thu |
| [docs/THAY-URL-QR.md](docs/THAY-URL-QR.md) | Thay địa chỉ, in mã QR |
| [docs/thuyet-minh/](docs/thuyet-minh/) | Hồ sơ sáng kiến (Đơn đăng ký, Tóm tắt, Thuyết minh) dạng .docx, .pdf và hình minh họa |

## Chạy nhanh (máy cá nhân)
```bash
npm install
node scripts/init-env.mjs
npm run db:local          # cửa sổ riêng
npx prisma migrate deploy
npm run db:seed-demo      # tài khoản + hồ sơ DEMO → .demo-accounts.txt
npm run dev               # http://localhost:3000
```

## Trạng thái (22/10/2026)
- **Đã lập trình**: toàn bộ phân hệ A, B, C; QR; báo cáo Excel/in PDF; thông báo nội bộ; phản hồi hai chiều; mẫu trả lời; khảo sát hài lòng; gợi ý lĩnh vực; hồ sơ tương tự; TOTP; nhật ký; lưu trữ; Docker.
- **Đã kiểm thử**: 38 ca tự động với PostgreSQL thật (đạt 38/38), kiểm thử sao lưu–khôi phục mức tệp (đạt), typecheck, build production, kiểm tra thủ công trên trình duyệt (giao diện điện thoại 375px và máy tính).
- **Chưa kiểm thử**: build/chạy Docker, nginx HTTPS, pg_dump/pg_restore (máy phát triển không có Docker) – phải chạy trên máy chủ thật.
- **Chưa đủ điều kiện triển khai chính thức**: cần phê duyệt an toàn thông tin và hoàn thành [docs/KIEM-TRA-BAO-MAT.md](docs/KIEM-TRA-BAO-MAT.md).

## Cần đơn vị xác nhận
Hạ tầng và địa chỉ mạng triển khai; danh mục đơn vị/bộ phận thật (hiện là mẫu); người được giao tiếp nhận, xử lý, đầu mối độc lập; thời hạn xử lý (mặc định 15/7/3 ngày); thời hạn lưu trữ (mặc định 36 tháng); chứng chỉ HTTPS; biểu tượng được phép dùng trên poster.
