import { requireActor } from "@/server/session";
import { Card, PageHeader } from "@/components/ui";
import { STATUS_LABELS, PUBLIC_STATUS_LABELS, STATUSES } from "@/lib/constants";

export const metadata = { title: "Hướng dẫn sử dụng" };

const ROLE_GUIDES = [
  {
    role: "Cán bộ tiếp nhận",
    steps: [
      "Vào “Bảng điều hành” xem mục “Hồ sơ mới chưa được phân công”, hoặc “Hồ sơ góp ý” → lọc “Chưa phân công”.",
      "Mở hồ sơ, đọc nội dung; kiểm tra tính hợp lệ. Nếu không thuộc phạm vi hoặc trùng lặp: “Kết thúc không xử lý” (ghi rõ lý do) hoặc “Chuyển đầu mối có thẩm quyền”.",
      "“Phân loại”: xác nhận lĩnh vực (tham khảo gợi ý theo từ khóa), loại ý kiến, mức ưu tiên; đánh dấu “Cần lãnh đạo xem xét” nếu cần.",
      "“Phân công”: chọn bộ phận và/hoặc cán bộ xử lý, đặt hạn xử lý. Hồ sơ liên quan đến cán bộ có thẩm quyền: dùng “Loại trừ quyền truy cập” với người liên quan và phân công cho đầu mối độc lập.",
      "Theo dõi tiến độ, thông báo sắp đến hạn/quá hạn; đôn đốc bộ phận xử lý.",
    ],
  },
  {
    role: "Cán bộ xử lý",
    steps: [
      "Vào “Việc được giao” để xem hồ sơ được phân công cho mình hoặc bộ phận.",
      "Chuyển trạng thái “Đang xử lý”, ghi chú nội bộ quá trình xác minh.",
      "Khi cần thêm thông tin: “Yêu cầu người gửi bổ sung” — người gửi trả lời bằng mã tra cứu, không lộ danh tính.",
      "Hoàn thành: nhập “Kết luận xử lý” và “Nội dung trả lời người gửi” (có thể chèn mẫu trả lời đã duyệt) → “Trình duyệt kết quả”.",
      "Nếu bị trả lại, đọc lý do trong mục phản hồi, xử lý tiếp và trình lại.",
    ],
  },
  {
    role: "Lãnh đạo, chỉ huy",
    steps: [
      "Theo dõi “Bảng điều hành”: tổng số, tỷ lệ giải quyết, hồ sơ quá hạn, tình hình theo bộ phận.",
      "Mục “Hồ sơ cần lãnh đạo xem xét, chờ duyệt”: mở hồ sơ, đọc kết luận, chỉnh sửa nội dung trả lời nếu cần → “Phê duyệt” hoặc “Trả lại” (ghi lý do).",
      "“Báo cáo”: chọn kỳ (tuần/tháng/quý/năm/tùy chỉnh) → xuất Excel hoặc bản in/PDF.",
      "Có thể “Mở lại” hồ sơ đã giải quyết nếu kết quả chưa đạt.",
    ],
  },
  {
    role: "Quản trị hệ thống",
    steps: [
      "Tạo tài khoản, gán vai trò, đơn vị, phạm vi lĩnh vực; giao mật khẩu tạm trực tiếp cho người dùng.",
      "Cập nhật danh mục lĩnh vực (thời hạn, từ khóa gợi ý) và đơn vị theo thực tế.",
      "Cấu hình thời hạn xử lý, quy trình duyệt, địa chỉ chính thức của mã QR; tải, in poster mã QR.",
      "Theo dõi “Nhật ký hệ thống”; kiểm tra sao lưu; xóa dữ liệu hết hạn theo chính sách được duyệt.",
      "Quản trị viên không mặc nhiên đọc được nội dung góp ý.",
    ],
  },
];

export default async function AdminGuidePage() {
  await requireActor();
  return (
    <div className="space-y-4">
      <PageHeader title="Hướng dẫn sử dụng cho cán bộ" subtitle="Tài liệu đầy đủ: docs/HUONG-DAN-QUAN-TRI.md" />
      <div className="grid gap-4 lg:grid-cols-2">
        {ROLE_GUIDES.map((g) => (
          <Card key={g.role} title={g.role}>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </Card>
        ))}
      </div>
      <Card title="Quy trình trạng thái" bodyClassName="p-0">
        <table className="table-base">
          <thead><tr><th>Trạng thái nghiệp vụ (nội bộ)</th><th>Người gửi nhìn thấy</th></tr></thead>
          <tbody>{STATUSES.map((s) => <tr key={s}><td>{STATUS_LABELS[s]}</td><td>{PUBLIC_STATUS_LABELS[s]}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Nguyên tắc bảo mật">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>Không dùng hệ thống để thu thập, lưu trữ, truyền tải bí mật nhà nước, bí mật quân sự, thông tin tác chiến, bố trí lực lượng.</li>
          <li>Chỉ xem thông tin người gửi khi thật cần cho việc giải quyết; mọi lần xem đều được ghi nhật ký.</li>
          <li>Không tìm cách xác định danh tính người gửi ẩn danh; không sao chép nội dung góp ý ra ngoài hệ thống khi chưa được phép.</li>
          <li>Không chia sẻ tài khoản; đăng xuất khi rời máy; bật xác thực hai yếu tố với tài khoản có thẩm quyền cao.</li>
        </ul>
      </Card>
    </div>
  );
}
