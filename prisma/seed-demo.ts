// Dữ liệu DEMO hoàn toàn giả lập để kiểm thử, nghiệm thu. Mọi bản ghi được đánh dấu isDemo = true,
// mã hồ sơ có tiền tố "DEMO-", và chỉ hiển thị khi hệ thống ở chế độ demo. Không chứa thông tin quân sự thực.
import type { FeedbackStatus, FeedbackType, Priority, PrismaClient, Satisfaction } from "@prisma/client";
import { hashSecret } from "../src/server/auth/password";
import { encrypt, formatSecret, randomPassword, randomSecret } from "../src/server/auth/crypto";

const DAY = 86_400_000;

interface DemoItem {
  type: FeedbackType;
  cat: string;
  title: string;
  content: string;
  proposal?: string;
  anon?: boolean;
  status: FeedbackStatus;
  priority?: Priority;
  daysAgo: number;
  slaDays?: number;
  unit?: string;
  handler?: 1 | 2;
  rating?: Satisfaction;
  leader?: boolean;
}

const ITEMS: DemoItem[] = [
  { type: "PHAN_ANH", cat: "HC_BD", title: "Bữa sáng thường xuyên nguội vào mùa đông", content: "Thời gian gần đây, bữa sáng tại nhà ăn thường nguội do chia suất quá sớm, nhất là những hôm sương lạnh. Đề nghị xem xét lại thời điểm chia suất.", proposal: "Chia suất muộn hơn 10 phút hoặc dùng khay giữ nhiệt.", status: "RESOLVED", daysAgo: 160, unit: "CQ_HCKT", handler: 2, rating: "SATISFIED" },
  { type: "KIEN_NGHI", cat: "DS_SH", title: "Bình nóng lạnh khu tắm dãy B hỏng", content: "Bình nóng lạnh khu tắm dãy B hỏng khoảng một tuần, chiến sĩ phải tắm nước lạnh. Đề nghị sửa chữa sớm.", status: "RESOLVED", daysAgo: 140, unit: "CQ_HCKT", handler: 2, rating: "SATISFIED" },
  { type: "DE_XUAT", cat: "VH_TT", title: "Đề xuất tổ chức giải bóng chuyền giữa các đại đội", content: "Đề xuất tổ chức giải bóng chuyền hằng quý giữa các đại đội để tăng cường rèn luyện thể lực và giao lưu đoàn kết.", proposal: "Tổ chức vào chiều thứ Bảy, mỗi đại đội cử một đội.", status: "RESOLVED", daysAgo: 130, unit: "CQ_CT", handler: 1, rating: "SATISFIED" },
  { type: "GOP_Y_XAY_DUNG", cat: "NN_MT", title: "Góp ý về vệ sinh khu vực nhà xe", content: "Khu vực nhà xe thường có rác, lá cây chưa được thu gom thường xuyên. Đề nghị phân công trực nhật cụ thể theo tuần.", status: "RESOLVED", daysAgo: 120, unit: "CQ_TM", handler: 1, rating: "NEUTRAL" },
  { type: "KIEN_NGHI", cat: "CD_CS", title: "Hỏi về chế độ nghỉ phép năm khi có việc gia đình đột xuất", content: "Đồng chí có việc gia đình đột xuất muốn hỏi thủ tục, chế độ nghỉ phép năm và nghỉ phép đặc biệt được thực hiện thế nào cho đúng quy định.", anon: false, status: "RESOLVED", daysAgo: 110, unit: "CQ_CT", handler: 1 },
  { type: "PHAN_ANH", cat: "VH_TT", title: "Mạng wifi tại phòng đọc yếu, khó truy cập tài liệu", content: "Wifi tại phòng đọc yếu, nhiều thời điểm không truy cập được tài liệu học tập. Đề nghị kiểm tra lại thiết bị phát sóng.", status: "RESOLVED", daysAgo: 95, unit: "CQ_TM", handler: 1, rating: "UNSATISFIED" },
  { type: "DE_XUAT", cat: "GD_TT", title: "Bổ sung sách pháp luật và kỹ năng sống cho thư viện", content: "Thư viện đơn vị còn ít đầu sách về pháp luật, kỹ năng sống. Đề xuất bổ sung một số đầu sách phù hợp với chiến sĩ trẻ.", status: "RESOLVED", daysAgo: 80, unit: "CQ_CT", handler: 1 },
  { type: "PHAN_ANH", cat: "DS_SH", title: "Quạt trần phòng ở bị kêu to vào ban đêm", content: "Quạt trần phòng ở của tiểu đội kêu to, ảnh hưởng giấc ngủ. Đề nghị kiểm tra, bảo dưỡng.", status: "CLOSED_NO_ACTION", daysAgo: 75, unit: "CQ_HCKT" },
  { type: "KHAC", cat: "KHAC", title: "Câu hỏi chung về cách sử dụng hệ thống góp ý", content: "Xin hỏi sau khi gửi góp ý thì bao lâu sẽ có kết quả trả lời và tra cứu ở đâu?", status: "RESOLVED", daysAgo: 70, unit: "CQ_CT", handler: 1, rating: "SATISFIED" },
  { type: "KIEN_NGHI", cat: "HC_BD", title: "Đề nghị bổ sung nước uống tại thao trường", content: "Trong các buổi huấn luyện ngoài trời nắng nóng, lượng nước uống mang theo chưa đủ. Đề nghị bổ sung bình nước tập trung tại thao trường.", status: "RESOLVED", priority: "ATTENTION", daysAgo: 60, unit: "CQ_HCKT", handler: 2 },
  { type: "GOP_Y_XAY_DUNG", cat: "QL_CH", title: "Góp ý thông báo lịch công tác tuần sớm hơn", content: "Lịch công tác tuần thường được thông báo muộn vào tối Chủ nhật, khó chủ động sắp xếp. Đề nghị thông báo từ chiều thứ Sáu.", status: "TRANSFERRED", daysAgo: 55 },
  { type: "PHAN_ANH", cat: "NN_MT", title: "Một số đồng chí sử dụng điện thoại sai giờ quy định", content: "Phản ánh việc một số đồng chí sử dụng điện thoại ngoài giờ quy định, ảnh hưởng nền nếp sinh hoạt chung.", status: "IN_PROGRESS", daysAgo: 40, unit: "CQ_TM", handler: 1, leader: true },
  { type: "KIEN_NGHI", cat: "CD_CS", title: "Đề nghị hướng dẫn thủ tục hỗ trợ gia đình khó khăn", content: "Gia đình gặp khó khăn do thiên tai, đề nghị hướng dẫn thủ tục đề nghị hỗ trợ theo chế độ.", anon: false, status: "PENDING_APPROVAL", priority: "HIGH", daysAgo: 12, unit: "CQ_CT", handler: 1 },
  { type: "PHAN_ANH", cat: "HC_BD", title: "Thực đơn bữa trưa lặp lại nhiều ngày", content: "Thực đơn bữa trưa lặp lại nhiều ngày liên tiếp, đề nghị nhà ăn thay đổi món để bảo đảm khẩu vị và dinh dưỡng.", status: "IN_PROGRESS", daysAgo: 30, slaDays: 10, unit: "CQ_HCKT", handler: 2 },
  { type: "KIEN_NGHI", cat: "DS_SH", title: "Đề nghị sửa đường điện chiếu sáng khu vực sân sau", content: "Đèn chiếu sáng khu vực sân sau hỏng, buổi tối đi lại khó khăn. Đề nghị sửa chữa.", status: "ASSIGNED", daysAgo: 25, slaDays: 15, unit: "CQ_HCKT" },
  { type: "DE_XUAT", cat: "GD_TT", title: "Sáng kiến ôn tập kiến thức chính trị bằng câu hỏi trắc nghiệm", content: "Đề xuất xây dựng bộ câu hỏi trắc nghiệm ngắn để chiến sĩ ôn tập kiến thức giáo dục chính trị vào thời gian rảnh.", proposal: "Cơ quan chính trị biên soạn, các đơn vị tổ chức ôn tập hằng tuần.", status: "IN_PROGRESS", daysAgo: 20, unit: "CQ_CT", handler: 1 },
  { type: "PHAN_ANH", cat: "VH_TT", title: "Sân bóng đá bị đọng nước sau mưa", content: "Sau mỗi trận mưa, sân bóng bị đọng nước nhiều ngày, không sử dụng được. Đề nghị khơi thông rãnh thoát nước.", status: "WAITING_INFO", daysAgo: 18, unit: "CQ_HCKT", handler: 2 },
  { type: "GOP_Y_XAY_DUNG", cat: "NN_MT", title: "Góp ý tăng cường giao ban rút kinh nghiệm cuối tuần", content: "Đề nghị duy trì giao ban rút kinh nghiệm ngắn gọn cuối tuần ở cấp đại đội để kịp thời uốn nắn nền nếp.", status: "CLASSIFYING", daysAgo: 6 },
  { type: "KIEN_NGHI", cat: "HC_BD", title: "Đề nghị cấp bổ sung quân trang mùa đông", content: "Một số chiến sĩ mới chưa được cấp đủ áo ấm mùa đông theo tiêu chuẩn. Đề nghị kiểm tra, cấp bổ sung.", status: "ASSIGNED", priority: "HIGH", daysAgo: 9, unit: "CQ_HCKT", handler: 2 },
  { type: "PHAN_ANH", cat: "DS_SH", title: "Vòi nước khu rửa bát bị rò rỉ", content: "Vòi nước khu rửa bát bị rò rỉ gây lãng phí nước và trơn trượt.", status: "NEW", daysAgo: 3 },
  { type: "DE_XUAT", cat: "VH_TT", title: "Đề xuất thành lập câu lạc bộ đọc sách", content: "Đề xuất thành lập câu lạc bộ đọc sách, sinh hoạt mỗi tháng một lần để chia sẻ sách hay.", status: "NEW", daysAgo: 2 },
  { type: "KIEN_NGHI", cat: "CD_CS", title: "Hỏi về chế độ phụ cấp khi đi công tác ngắn ngày", content: "Đề nghị hướng dẫn chế độ phụ cấp và thanh toán công tác phí khi đi công tác ngắn ngày.", status: "NEW", daysAgo: 1 },
  { type: "PHAN_ANH", cat: "QL_CH", title: "Phân công trực nhật chưa đều giữa các tiểu đội", content: "Việc phân công trực nhật khu vực chung chưa đều giữa các tiểu đội, có tiểu đội trực nhiều lần trong tháng.", status: "IN_PROGRESS", daysAgo: 22, slaDays: 15, unit: "CQ_TM", handler: 1 },
  { type: "GOP_Y_XAY_DUNG", cat: "GD_TT", title: "Góp ý đổi mới hình thức sinh hoạt bản tin", content: "Đề nghị đổi mới hình thức đọc bản tin buổi sáng, kết hợp hình ảnh trình chiếu để sinh động hơn.", status: "RESOLVED", daysAgo: 35, unit: "CQ_CT", handler: 1, rating: "SATISFIED" },
  { type: "KHAC", cat: "KHAC", title: "Đề nghị bổ sung ghế đá khu vực vườn hoa", content: "Khu vực vườn hoa chưa có ghế ngồi nghỉ, đề nghị bổ sung một số ghế đá.", status: "CLASSIFYING", daysAgo: 4 },
  { type: "PHAN_ANH", cat: "HC_BD", title: "Tủ thuốc tại đại đội thiếu một số thuốc thông thường", content: "Tủ thuốc tại đại đội thiếu thuốc cảm cúm, thuốc sát trùng thông thường. Đề nghị bổ sung.", status: "IN_PROGRESS", priority: "ATTENTION", daysAgo: 16, slaDays: 7, unit: "CQ_HCKT", handler: 2 },
];

export async function seedDemo(prisma: PrismaClient): Promise<string[]> {
  const lines: string[] = [];
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  const units = Object.fromEntries((await prisma.organizationalUnit.findMany()).map((u) => [u.code, u.id]));
  const cats = Object.fromEntries((await prisma.feedbackCategory.findMany()).map((c) => [c.code, c]));

  const accounts = [
    { username: "demo.quantri", fullName: "Quản trị Demo", rank: "", position: "Quản trị hệ thống (demo)", role: "ADMIN", unit: "CQ_TM" },
    { username: "demo.tiepnhan", fullName: "Nguyễn Văn Tiếp", rank: "Đại úy", position: "Cán bộ tiếp nhận (demo)", role: "RECEIVER", unit: "CQ_CT" },
    { username: "demo.xuly1", fullName: "Trần Văn Xử", rank: "Thượng úy", position: "Trợ lý (demo)", role: "HANDLER", unit: "CQ_CT" },
    { username: "demo.xuly2", fullName: "Lê Văn Lý", rank: "Thượng úy", position: "Trợ lý hậu cần (demo)", role: "HANDLER", unit: "CQ_HCKT" },
    { username: "demo.xuly3", fullName: "Phạm Văn Ba", rank: "Trung úy", position: "Trợ lý tham mưu (demo)", role: "HANDLER", unit: "CQ_TM" },
    { username: "demo.chihuy", fullName: "Hoàng Văn Huy", rank: "Thượng tá", position: "Lãnh đạo, chỉ huy (demo)", role: "LEADER", unit: "CQ_CT" },
  ];
  const userIds: Record<string, string> = {};
  lines.push("TÀI KHOẢN DEMO (mật khẩu ngẫu nhiên, chỉ dùng cho thử nghiệm; bắt buộc đổi khi đăng nhập lần đầu):");
  for (const a of accounts) {
    const pw = randomPassword(14);
    const u = await prisma.user.upsert({
      where: { username: a.username },
      create: { username: a.username, fullName: a.fullName, rank: a.rank || null, position: a.position, roleId: roles[a.role], unitId: units[a.unit], passwordHash: await hashSecret(pw), mustChangePassword: true, isDemo: true },
      update: { passwordHash: await hashSecret(pw), mustChangePassword: true, isActive: true, failedLoginCount: 0, lockedUntil: null },
    });
    userIds[a.username] = u.id;
    lines.push(`  ${a.username.padEnd(15)} ${pw}   (${a.position})`);
  }
  const H = { 1: userIds["demo.xuly1"], 2: userIds["demo.xuly2"] } as const;
  const handlerFor = (unit?: string, h?: 1 | 2) => (h ? H[h] : unit === "CQ_TM" ? userIds["demo.xuly3"] : undefined);
  const receiver = userIds["demo.tiepnhan"];
  const leader = userIds["demo.chihuy"];

  const year = new Date().getFullYear();
  const existing = await prisma.feedback.count({ where: { isDemo: true } });
  if (existing > 0) {
    lines.push(`\n(Đã có ${existing} hồ sơ demo, không tạo thêm. Xóa dữ liệu demo trong trang quản trị rồi chạy lại nếu cần.)`);
    return lines;
  }
  lines.push("\nMỘT SỐ HỒ SƠ DEMO ĐỂ THỬ TRA CỨU (mã hồ sơ / mã bí mật):");
  const now = Date.now();
  let seq = 0;
  for (const it of ITEMS) {
    seq++;
    const code = `DEMO-GY-${year}-${String(seq).padStart(6, "0")}`;
    const secret = randomSecret(12);
    const created = new Date(now - it.daysAgo * DAY - (seq % 7) * 3_600_000);
    const cat = cats[it.cat];
    const sla = it.slaDays ?? cat.slaDays ?? (it.priority === "HIGH" ? 3 : it.priority === "ATTENTION" ? 7 : 15);
    const dueAt = new Date(created.getTime() + sla * DAY);
    const handler = handlerFor(it.unit, it.handler);
    const assigned = !["NEW", "CLASSIFYING", "TRANSFERRED"].includes(it.status);
    const tAssign = new Date(created.getTime() + 1 * DAY);
    const tProcess = new Date(created.getTime() + 2 * DAY);
    const resolvedAt = it.status === "RESOLVED" ? new Date(created.getTime() + Math.min(sla - 1, 4 + (seq % 6)) * DAY) : null;

    const fb = await prisma.feedback.create({
      data: {
        code,
        type: it.type,
        categoryId: cat.id,
        title: it.title,
        content: it.content,
        proposal: it.proposal ?? null,
        isAnonymous: it.anon !== false,
        status: it.status,
        priority: it.priority ?? "NORMAL",
        secretHash: await hashSecret(secret),
        dueAt,
        assignedUnitId: assigned && it.unit ? units[it.unit] : null,
        assignedUserId: assigned ? handler ?? null : null,
        needsLeaderReview: !!it.leader,
        conclusion: it.status === "RESOLVED" || it.status === "PENDING_APPROVAL" ? "Đã kiểm tra, xác minh và khắc phục theo đề nghị." : null,
        closeReason: it.status === "CLOSED_NO_ACTION" ? "Nội dung trùng với hồ sơ đã tiếp nhận và giải quyết trước đó." : it.status === "TRANSFERRED" ? "Chuyển: Thủ trưởng đơn vị. Nội dung thuộc thẩm quyền chỉ huy cấp trên." : null,
        resolvedAt,
        closedAt: resolvedAt ?? (["CLOSED_NO_ACTION", "TRANSFERRED"].includes(it.status) ? new Date(created.getTime() + 3 * DAY) : null),
        conclusionApprovedById: it.status === "RESOLVED" ? leader : null,
        satisfaction: it.rating ?? null,
        satisfactionAt: it.rating ? new Date((resolvedAt ?? created).getTime() + DAY) : null,
        isDemo: true,
        createdAt: created,
        publicUpdatedAt: resolvedAt ?? created,
      },
    });
    if (it.anon === false) {
      await prisma.feedbackSender.create({ data: { feedbackId: fb.id, fullNameEnc: encrypt("Người gửi Demo"), contactEnc: encrypt("Liên hệ qua đại đội (demo)"), unitId: units.TD1 } });
    }
    const hist: { from: FeedbackStatus | null; to: FeedbackStatus; at: Date; actor?: string; note: string; pub?: string }[] = [
      { from: null, to: "NEW", at: created, note: "Hệ thống tiếp nhận ý kiến qua cổng góp ý.", pub: "Hệ thống đã tiếp nhận ý kiến của đồng chí." },
    ];
    if (it.status !== "NEW") hist.push({ from: "NEW", to: "CLASSIFYING", at: new Date(created.getTime() + 6 * 3_600_000), actor: receiver, note: "Phân loại hồ sơ.", pub: "Ý kiến đang được xem xét, phân loại." });
    if (it.status === "TRANSFERRED") hist.push({ from: "CLASSIFYING", to: "TRANSFERRED", at: new Date(created.getTime() + 3 * DAY), actor: receiver, note: "Chuyển đầu mối có thẩm quyền: Thủ trưởng đơn vị.", pub: "Ý kiến đã được chuyển đến cấp có thẩm quyền xem xét, giải quyết theo quy định." });
    if (assigned) {
      hist.push({ from: "CLASSIFYING", to: "ASSIGNED", at: tAssign, actor: receiver, note: "Phân công xử lý.", pub: "Ý kiến đã được chuyển đến bộ phận có trách nhiệm xem xét, giải quyết." });
      await prisma.feedbackAssignment.create({ data: { feedbackId: fb.id, assignedUnitId: it.unit ? units[it.unit] : null, assignedUserId: handler ?? null, assignedById: receiver, dueAt, createdAt: tAssign } });
    }
    if (["IN_PROGRESS", "WAITING_INFO", "PENDING_APPROVAL", "RESOLVED"].includes(it.status))
      hist.push({ from: "ASSIGNED", to: "IN_PROGRESS", at: tProcess, actor: handler, note: "Bắt đầu xử lý, xác minh nội dung.", pub: "Ý kiến đang được bộ phận có trách nhiệm xem xét, giải quyết." });
    if (it.status === "CLOSED_NO_ACTION") hist.push({ from: "ASSIGNED", to: "CLOSED_NO_ACTION", at: new Date(created.getTime() + 3 * DAY), actor: receiver, note: "Kết thúc không xử lý. Lý do: trùng nội dung hồ sơ đã giải quyết.", pub: "Nội dung trùng với ý kiến đã được tiếp nhận, giải quyết trước đó." });
    if (it.status === "WAITING_INFO") {
      const at = new Date(created.getTime() + 3 * DAY);
      hist.push({ from: "IN_PROGRESS", to: "WAITING_INFO", at, actor: handler, note: "Gửi yêu cầu bổ sung thông tin.", pub: "Đơn vị đề nghị đồng chí bổ sung thông tin (xem nội dung yêu cầu bên dưới)." });
      await prisma.feedbackResponse.create({ data: { feedbackId: fb.id, kind: "REQUEST_INFO", content: "Đề nghị đồng chí cho biết cụ thể vị trí khu vực bị đọng nước để đơn vị kiểm tra.", status: "PUBLISHED", authorId: handler!, approvedById: handler, approvedAt: at, publishedAt: at, createdAt: at } });
    }
    if (it.status === "PENDING_APPROVAL" || it.status === "RESOLVED") {
      const at = new Date((resolvedAt ?? new Date(now - DAY)).getTime() - DAY / 2);
      hist.push({ from: "IN_PROGRESS", to: "PENDING_APPROVAL", at, actor: handler, note: "Trình duyệt kết quả giải quyết." });
      const resp = await prisma.feedbackResponse.create({
        data: {
          feedbackId: fb.id, kind: "ANSWER", authorId: handler!, createdAt: at,
          content: "Cảm ơn đồng chí đã gửi ý kiến. Đơn vị đã kiểm tra, xác minh và tổ chức khắc phục theo đề nghị. Đề nghị đồng chí tiếp tục theo dõi, phản ánh nếu còn vướng mắc.",
          status: it.status === "RESOLVED" ? "PUBLISHED" : "PENDING_APPROVAL",
          approvedById: it.status === "RESOLVED" ? leader : null,
          approvedAt: resolvedAt, publishedAt: resolvedAt,
        },
      });
      void resp;
      if (resolvedAt) hist.push({ from: "PENDING_APPROVAL", to: "RESOLVED", at: resolvedAt, actor: leader, note: "Phê duyệt kết quả giải quyết.", pub: "Đơn vị đã có kết quả giải quyết (xem nội dung trả lời bên dưới)." });
    }
    for (const h of hist) {
      await prisma.feedbackStatusHistory.create({
        data: { feedbackId: fb.id, fromStatus: h.from, toStatus: h.to, actorType: h.actor ? "STAFF" : "SYSTEM", actorId: h.actor ?? null, note: h.note, publicNote: h.pub ?? null, createdAt: h.at },
      });
    }
    if (seq <= 3 || ["WAITING_INFO", "PENDING_APPROVAL", "NEW"].includes(it.status))
      lines.push(`  ${code}  ${formatSecret(secret)}   (${it.status})`);
  }
  await prisma.feedbackCounter.upsert({ where: { scope: `DEMO-GY-${year}` }, create: { scope: `DEMO-GY-${year}`, lastSeq: seq }, update: { lastSeq: seq } });
  await prisma.systemSetting.upsert({ where: { key: "system.demoMode" }, create: { key: "system.demoMode", value: true }, update: { value: true } });
  lines.push(`\nĐã tạo ${seq} hồ sơ demo. Hệ thống đang ở CHẾ ĐỘ DEMO.`);
  return lines;
}
