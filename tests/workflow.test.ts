// Kiểm thử 7–10: phân công, cập nhật trạng thái, gửi phản hồi, duyệt kết quả; lịch sử chỉ ghi thêm.
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as svc from "@/server/services/feedback-admin";
import { lookupFeedback } from "@/server/services/public-feedback";
import { setSetting } from "@/server/settings";
import { category, makeUser, resetDb, submitSample, unit } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const receiver = await makeUser("RECEIVER", { unitCode: "CQ_CT" });
  const handler = await makeUser("HANDLER", { unitCode: "CQ_HCKT" });
  const leader = await makeUser("LEADER", { unitCode: "CQ_CT" });
  const r = await submitSample();
  return { receiver, handler, leader, r };
}

describe("Quy trình xử lý đầy đủ", () => {
  it("[7][8][9][10] phân loại → phân công → xử lý → trình duyệt → phê duyệt; người gửi thấy kết quả", async () => {
    const { receiver, handler, leader, r } = await setup();
    const hc = await unit("CQ_HCKT");

    await svc.classifyFeedback(receiver, r.id, { categoryId: (await category("HC_BD")).id, type: "KIEN_NGHI", priority: "HIGH", note: "Hợp lệ" });
    let fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } });
    expect(fb.status).toBe("CLASSIFYING");
    expect(fb.priority).toBe("HIGH");
    // HIGH = 3 ngày theo cấu hình mặc định
    expect(Math.round((fb.dueAt!.getTime() - fb.createdAt.getTime()) / 86_400_000)).toBe(3);

    // [7] Phân công
    await svc.assignFeedback(receiver, r.id, { unitId: hc.id, userId: handler.id, note: "Xác minh, báo cáo" });
    fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } });
    expect(fb.status).toBe("ASSIGNED");
    expect(fb.assignedUserId).toBe(handler.id);
    expect(await prisma.notification.count({ where: { userId: handler.id, type: "ASSIGNED" } })).toBe(1);

    // [8] Cập nhật trạng thái
    await svc.changeStatus(handler, r.id, { to: "IN_PROGRESS", note: "Đang xác minh" });
    await expect(svc.changeStatus(handler, r.id, { to: "RESOLVED" })).rejects.toThrow(/Không thể chuyển/);

    // [9] Soạn phản hồi, trình duyệt
    await svc.submitResponse(handler, r.id, { content: "Đơn vị đã điều chỉnh thời gian chia suất ăn sáng.", conclusion: "Phản ánh đúng, đã khắc phục" });
    fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } });
    expect(fb.status).toBe("PENDING_APPROVAL");
    let pub = await lookupFeedback({ code: r.code, secret: r.secret });
    expect(pub.responses).toHaveLength(0); // chưa duyệt thì người gửi chưa thấy
    expect(pub.publicStatus).toBe("Đang xem xét, giải quyết");
    expect(await prisma.notification.count({ where: { userId: leader.id, type: "PENDING_APPROVAL" } })).toBe(1);

    // Trả lại
    const resp1 = await prisma.feedbackResponse.findFirstOrThrow({ where: { feedbackId: r.id, status: "PENDING_APPROVAL" } });
    await expect(svc.reviewResponse(leader, r.id, { responseId: resp1.id, approve: false, reason: "ngắn" })).rejects.toThrow(/Lý do/);
    await svc.reviewResponse(leader, r.id, { responseId: resp1.id, approve: false, reason: "Cần nêu rõ thời gian áp dụng" });
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("IN_PROGRESS");

    // [10] Trình lại và phê duyệt (có chỉnh sửa)
    await svc.submitResponse(handler, r.id, { content: "Từ ngày 01/11, bữa sáng chia lúc 6 giờ 15.", conclusion: "Đã khắc phục" });
    const resp2 = await prisma.feedbackResponse.findFirstOrThrow({ where: { feedbackId: r.id, status: "PENDING_APPROVAL" } });
    await svc.reviewResponse(leader, r.id, { responseId: resp2.id, approve: true, content: "Từ ngày 01/11, bữa sáng được chia lúc 6 giờ 15. Cảm ơn đồng chí." });
    fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } });
    expect(fb.status).toBe("RESOLVED");
    expect(fb.resolvedAt).not.toBeNull();
    expect(fb.conclusionApprovedById).toBe(leader.id);

    pub = await lookupFeedback({ code: r.code, secret: r.secret });
    expect(pub.publicStatus).toBe("Đã có kết quả giải quyết");
    expect(pub.responses).toHaveLength(1);
    expect(pub.responses[0].content).toContain("Cảm ơn đồng chí");
    expect(pub.canRate).toBe(true);
    // Người gửi không thấy ghi chú nội bộ, tên cán bộ
    expect(JSON.stringify(pub)).not.toContain(handler.fullName);
    expect(JSON.stringify(pub)).not.toContain("Cần nêu rõ thời gian áp dụng");

    // Lịch sử đủ thông tin: người thực hiện, thời gian, trạng thái cũ/mới, nội dung
    const hist = await prisma.feedbackStatusHistory.findMany({ where: { feedbackId: r.id }, orderBy: { createdAt: "asc" } });
    expect(hist.map((h) => h.toStatus)).toEqual(["NEW", "CLASSIFYING", "ASSIGNED", "IN_PROGRESS", "PENDING_APPROVAL", "IN_PROGRESS", "PENDING_APPROVAL", "RESOLVED"]);
    for (const h of hist.slice(1)) {
      expect(h.actorId).toBeTruthy();
      expect(h.fromStatus).toBeTruthy();
      expect(h.note).toBeTruthy();
    }
    // Nhật ký kiểm toán
    const actions = (await prisma.auditLog.findMany()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["feedback.classified", "feedback.assigned", "feedback.response_submitted", "feedback.response_rejected", "feedback.response_approved"]));
  });

  it("không cần duyệt khi cấu hình tắt quy trình duyệt", async () => {
    const { receiver, handler, r } = await setup();
    await setSetting("workflow.requireApproval", false);
    await svc.assignFeedback(receiver, r.id, { userId: handler.id });
    await svc.submitResponse(handler, r.id, { content: "Đã giải quyết xong nội dung phản ánh.", conclusion: "Xong" });
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("RESOLVED");
  });

  it("kết thúc không xử lý bắt buộc có lý do; chuyển đầu mối; lãnh đạo mở lại", async () => {
    const { receiver, leader, r } = await setup();
    await expect(svc.closeWithoutAction(receiver, r.id, { reason: "" })).rejects.toThrow(/Lý do/);
    await svc.closeWithoutAction(receiver, r.id, { reason: "Trùng với hồ sơ đã giải quyết trước đó" });
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CLOSED_NO_ACTION");
    await expect(svc.assignFeedback(receiver, r.id, { userId: receiver.id })).rejects.toThrow(/trạng thái/);
    await svc.reopenFeedback(leader, r.id, { reason: "Cần xem xét lại nội dung" });
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("IN_PROGRESS");

    const r2 = await submitSample();
    await svc.transferFeedback(receiver, r2.id, { target: "Thủ trưởng cấp trên", reason: "Thuộc thẩm quyền cấp trên giải quyết" });
    const pub = await lookupFeedback({ code: r2.code, secret: r2.secret });
    expect(pub.publicStatus).toBe("Đã chuyển đến cấp có thẩm quyền");
  });

  it("lịch sử xử lý, nhật ký, ghi chú nội bộ không thể sửa hay xóa ở mức CSDL", async () => {
    const { receiver, r } = await setup();
    await svc.addInternalNote(receiver, r.id, { content: "Ghi chú cần bảo toàn" });
    await expect(prisma.feedbackStatusHistory.updateMany({ where: { feedbackId: r.id }, data: { note: "sửa" } })).rejects.toThrow();
    await expect(prisma.feedbackStatusHistory.deleteMany({ where: { feedbackId: r.id } })).rejects.toThrow();
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow();
    await expect(prisma.auditLog.updateMany({ data: { action: "x" } })).rejects.toThrow();
    await expect(prisma.internalNote.updateMany({ where: { feedbackId: r.id }, data: { content: "sửa" } })).rejects.toThrow();
    // Xóa hồ sơ trực tiếp (kéo theo lịch sử) cũng bị chặn nếu không qua thủ tục lưu trữ
    await expect(prisma.feedback.delete({ where: { id: r.id } })).rejects.toThrow();
    expect(await prisma.feedbackStatusHistory.count({ where: { feedbackId: r.id } })).toBeGreaterThan(0);
  });

  it("[D] mẫu trả lời chỉ hiển thị khi đã được phê duyệt", async () => {
    const admin = await makeUser("ADMIN");
    const receiver = await makeUser("RECEIVER");
    const { saveTemplate, approveTemplate } = await import("@/server/services/admin");
    await saveTemplate(admin, { title: "Cảm ơn", content: "Cảm ơn đồng chí đã gửi ý kiến." });
    expect((await svc.processingOptions(receiver)).templates).toHaveLength(0);
    const t = await prisma.responseTemplate.findFirstOrThrow();
    await approveTemplate(admin, t.id);
    expect((await svc.processingOptions(receiver)).templates).toHaveLength(1);
  });

  it("[B] phát hiện hồ sơ tương tự, không tự gộp", async () => {
    const { receiver } = await setup();
    const a = await submitSample({ title: "Nước nóng khu tắm bị hỏng", content: "Bình nước nóng khu tắm dãy B bị hỏng nhiều ngày chưa sửa." });
    await submitSample({ title: "Bình nước nóng khu tắm hỏng", content: "Khu tắm dãy B bình nước nóng hỏng, đề nghị sửa chữa sớm." });
    await submitSample({ title: "Đề xuất giải bóng chuyền", content: "Đề xuất tổ chức giải bóng chuyền giữa các đại đội hằng quý." });
    const sim = await svc.findSimilar(receiver, a.id);
    expect(sim[0].title).toContain("nước nóng");
    expect(sim.find((s) => s.title.includes("bóng chuyền"))).toBeUndefined();
    expect(await prisma.feedback.count()).toBe(4);
  });
});
