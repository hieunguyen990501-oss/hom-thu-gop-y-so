// Kiểm thử 6 và 15: người không có quyền không xem được hồ sơ; cố ý truy cập hồ sơ người khác (IDOR).
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as svc from "@/server/services/feedback-admin";
import { dashboardData } from "@/server/services/stats";
import { createUser, listUsers, purgeDemoData, updateSettings } from "@/server/services/admin";
import { login } from "@/server/services/auth";
import { loadActor } from "@/server/rbac";
import { setSetting } from "@/server/settings";
import { category, makeUser, resetDb, submitSample, TEST_PASSWORD, unit } from "./helpers";

beforeEach(resetDb);

describe("Phân quyền tại server", () => {
  it("[6] quản trị viên kỹ thuật không đọc được nội dung góp ý", async () => {
    const admin = await makeUser("ADMIN");
    const r = await submitSample();
    await expect(svc.getFeedbackDetail(admin, r.id)).rejects.toThrow(/Không tìm thấy/);
    expect((await svc.listFeedback(admin, {})).total).toBe(0);
    await expect(dashboardData(admin, {})).rejects.toThrow(/không có quyền/);
  });

  it("[15] cán bộ xử lý chỉ thấy hồ sơ được giao; truy cập hồ sơ khác bằng ID bị từ chối", async () => {
    const receiver = await makeUser("RECEIVER");
    const h1 = await makeUser("HANDLER", { unitCode: "CQ_HCKT" });
    const h2 = await makeUser("HANDLER", { unitCode: "CQ_TM" });
    const a = await submitSample();
    const b = await submitSample();
    await svc.assignFeedback(receiver, a.id, { userId: h1.id });
    await svc.assignFeedback(receiver, b.id, { unitId: (await unit("CQ_TM")).id });

    expect((await svc.listFeedback(h1, {})).items.map((i) => i.id)).toEqual([a.id]);
    expect((await svc.listFeedback(h2, {})).items.map((i) => i.id)).toEqual([b.id]); // giao cho bộ phận của h2
    await expect(svc.getFeedbackDetail(h1, b.id)).rejects.toThrow(/Không tìm thấy/);
    await expect(svc.getFeedbackDetail(h2, a.id)).rejects.toThrow(/Không tìm thấy/);
    await expect(svc.submitResponse(h2, a.id, { content: "Cố tình trả lời hồ sơ người khác", conclusion: "x x" })).rejects.toThrow(/Không tìm thấy/);
    await expect(svc.addInternalNote(h2, a.id, { content: "chen ngang" })).rejects.toThrow(/Không tìm thấy/);
    await expect(svc.getFeedbackDetail(h1, "../../etc/passwd")).rejects.toThrow(/Không tìm thấy/);
  });

  it("vai trò không đủ quyền bị từ chối dù thấy hồ sơ", async () => {
    const receiver = await makeUser("RECEIVER");
    const handler = await makeUser("HANDLER", { unitCode: "CQ_HCKT" });
    const leader = await makeUser("LEADER");
    const r = await submitSample();
    await expect(svc.assignFeedback(handler, r.id, { userId: handler.id })).rejects.toThrow(/không có quyền/);
    await svc.assignFeedback(receiver, r.id, { userId: handler.id });
    await expect(svc.assignFeedback(handler, r.id, { userId: handler.id })).rejects.toThrow(/không có quyền/);
    await expect(svc.classifyFeedback(handler, r.id, { categoryId: (await category()).id, type: "KHAC", priority: "NORMAL" })).rejects.toThrow(/không có quyền/);
    await expect(svc.submitResponse(receiver, r.id, { content: "Tiếp nhận không được trả lời thay", conclusion: "x x" })).rejects.toThrow(/không có quyền/);
    await svc.submitResponse(handler, r.id, { content: "Đã giải quyết theo đúng quy định.", conclusion: "Đã xong" });
    const resp = await prisma.feedbackResponse.findFirstOrThrow({ where: { feedbackId: r.id } });
    await expect(svc.reviewResponse(receiver, r.id, { responseId: resp.id, approve: true })).rejects.toThrow(/không có quyền/);
    await expect(svc.reviewResponse(handler, r.id, { responseId: resp.id, approve: true })).rejects.toThrow(/không có quyền/);
    await svc.reviewResponse(leader, r.id, { responseId: resp.id, approve: true });
    const admin = await makeUser("ADMIN");
    await expect(createUser(receiver, { username: "hack", fullName: "Hack", roleCode: "ADMIN" })).rejects.toThrow(/không có quyền/);
    await expect(updateSettings(leader, { "system.demoMode": true })).rejects.toThrow(/không có quyền/);
    await expect(listUsers(handler)).rejects.toThrow(/không có quyền/);
    await createUser(admin, { username: "moi.taikhoan", fullName: "Tài khoản mới", roleCode: "HANDLER" });
  });

  it("loại trừ người bị phản ánh khỏi hồ sơ; thu hồi phân công nếu đang được giao", async () => {
    const receiver = await makeUser("RECEIVER");
    const leader2 = await makeUser("LEADER");
    const handler = await makeUser("HANDLER", { unitCode: "CQ_HCKT" });
    const independent = await makeUser("RECEIVER", { independent: true, categoryCodes: ["QL_CH"] });
    const r = await submitSample();
    await svc.assignFeedback(receiver, r.id, { userId: handler.id });
    await svc.restrictAccess(receiver, r.id, { userId: leader2.id, reason: "Nội dung phản ánh liên quan trực tiếp" });
    await svc.restrictAccess(receiver, r.id, { userId: handler.id, reason: "Người được giao có liên quan đến nội dung" });
    await expect(svc.getFeedbackDetail(leader2, r.id)).rejects.toThrow(/Không tìm thấy/);
    await expect(svc.getFeedbackDetail(handler, r.id)).rejects.toThrow(/Không tìm thấy/);
    expect((await svc.listFeedback(leader2, {})).total).toBe(0);
    const fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id } });
    expect(fb.assignedUserId).toBeNull();
    expect(fb.status).toBe("CLASSIFYING");
    await expect(svc.assignFeedback(receiver, r.id, { userId: handler.id })).rejects.toThrow(/loại trừ/);
    // Chuyển cho đầu mối độc lập (ngoài phạm vi lĩnh vực của họ) → đầu mối vẫn thấy hồ sơ được giao
    await expect(svc.getFeedbackDetail(independent, r.id)).rejects.toThrow(/Không tìm thấy/);
    await svc.assignFeedback(receiver, r.id, { userId: independent.id });
    expect((await svc.getFeedbackDetail(independent, r.id)).id).toBe(r.id);
  });

  it("phạm vi lĩnh vực giới hạn hồ sơ cán bộ tiếp nhận được xem", async () => {
    const scoped = await makeUser("RECEIVER", { categoryCodes: ["VH_TT"] });
    await submitSample({ categoryCode: "HC_BD" });
    const vh = await submitSample({ categoryCode: "VH_TT" });
    const list = await svc.listFeedback(scoped, {});
    expect(list.items.map((i) => i.id)).toEqual([vh.id]);
    await expect(svc.classifyFeedback(scoped, vh.id, { categoryId: (await category("HC_BD")).id, type: "KHAC", priority: "NORMAL" })).rejects.toThrow(/ngoài phạm vi/);
  });

  it("thông tin người gửi chỉ xem được khi có quyền, mỗi lần xem được ghi nhật ký", async () => {
    const receiver = await makeUser("RECEIVER");
    const handler = await makeUser("HANDLER", { unitCode: "CQ_HCKT" });
    const r = await submitSample({ isAnonymous: false, fullName: "Trần Thử", contact: "Liên hệ qua đại đội" });
    await svc.assignFeedback(receiver, r.id, { userId: handler.id });
    await expect(svc.getSenderInfo(handler, r.id)).rejects.toThrow(/không có quyền/);
    const detail = await svc.getFeedbackDetail(handler, r.id);
    expect(JSON.stringify(detail)).not.toContain("Trần Thử");
    expect(JSON.stringify(detail)).not.toContain("secretHash");
    const info = await svc.getSenderInfo(receiver, r.id);
    expect(info?.fullName).toBe("Trần Thử");
    expect(await prisma.auditLog.count({ where: { action: "feedback.sender_viewed", actorId: receiver.id } })).toBe(1);
    // Danh sách tổng hợp không chứa thông tin định danh
    const list = await svc.listFeedback(receiver, {});
    expect(JSON.stringify(list)).not.toContain("Trần Thử");
  });

  it("dữ liệu demo tách biệt dữ liệu chính thức; tài khoản demo bị chặn ở chế độ chính thức", async () => {
    const admin = await makeUser("ADMIN");
    const realReceiver = await makeUser("RECEIVER");
    const official = await submitSample();
    await setSetting("system.demoMode", true);
    const demoReceiver = await makeUser("RECEIVER", { isDemo: true });
    const demo = await submitSample();
    expect(demo.code).toMatch(/^DEMO-GY-/);
    expect((await svc.listFeedback(demoReceiver, {})).items.map((i) => i.id)).toEqual([demo.id]);
    await setSetting("system.demoMode", false);
    expect((await svc.listFeedback(realReceiver, {})).items.map((i) => i.id)).toEqual([official.id]);
    expect(await loadActor(demoReceiver.id)).toBeNull();
    await expect(login({ username: demoReceiver.username, password: TEST_PASSWORD }, null)).rejects.toThrow(/không đúng/);
    // Xóa dữ liệu demo
    await setSetting("system.demoMode", true);
    const res = await purgeDemoData(admin, "XOA DEMO");
    expect(res.feedback).toBe(1);
    expect(await prisma.feedback.count({ where: { isDemo: true } })).toBe(0);
    expect(await prisma.feedback.count()).toBe(1);
    await expect(purgeDemoData(admin, "sai")).rejects.toThrow(/XOA DEMO/);
  });
});
