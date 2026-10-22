// Kiểm thử 1–5: gửi ẩn danh, gửi có thông tin, từ chối dữ liệu không hợp lệ, nhận mã + bí mật, tra cứu sai mã.
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { addSenderMessage, lookupFeedback, submitFeedback, submitSatisfaction } from "@/server/services/public-feedback";
import { decrypt } from "@/server/auth/crypto";
import { setSetting } from "@/server/settings";
import { category, makeUser, resetDb, submitSample, unit } from "./helpers";

beforeEach(resetDb);

describe("Gửi góp ý", () => {
  it("[1][4] gửi ẩn danh thành công, cấp mã hồ sơ và mã bí mật, không lưu định danh", async () => {
    const receiver = await makeUser("RECEIVER");
    const r = await submitSample();
    expect(r.code).toMatch(/^GY-\d{4}-000001$/);
    expect(r.secret).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(r.publicStatus).toBe("Đã tiếp nhận");

    const fb = await prisma.feedback.findUniqueOrThrow({ where: { code: r.code }, include: { sender: true, history: true } });
    expect(fb.isAnonymous).toBe(true);
    expect(fb.sender).toBeNull();
    expect(fb.status).toBe("NEW");
    expect(fb.dueAt).not.toBeNull();
    // Mã bí mật chỉ lưu dạng băm Argon2id
    expect(fb.secretHash.startsWith("$argon2id$")).toBe(true);
    expect(fb.secretHash).not.toContain(r.secret.replace(/-/g, ""));
    expect(fb.history).toHaveLength(1);
    // Không có cột nào lưu IP/thiết bị trong bảng Feedback
    expect(Object.keys(fb).some((k) => /ip|device|agent/i.test(k))).toBe(false);
    // Không ghi nhật ký kiểm toán cho người gửi
    expect(await prisma.auditLog.count()).toBe(0);
    // Cán bộ tiếp nhận nhận thông báo
    expect(await prisma.notification.count({ where: { userId: receiver.id, type: "NEW_FEEDBACK" } })).toBe(1);

    const r2 = await submitSample();
    expect(r2.code).toMatch(/-000002$/);
  });

  it("[2] gửi có thông tin: thông tin người gửi tách bảng và được mã hóa", async () => {
    const u = await unit("TD1");
    const r = await submitSample({ isAnonymous: false, fullName: "Nguyễn Văn Thử", contact: "Đại đội 1", senderUnitId: u.id });
    const s = await prisma.feedbackSender.findFirstOrThrow({ where: { feedback: { code: r.code } } });
    expect(s.fullNameEnc).not.toContain("Nguyễn");
    expect(decrypt(s.fullNameEnc!)).toBe("Nguyễn Văn Thử");
    expect(decrypt(s.contactEnc!)).toBe("Đại đội 1");
    expect(s.unitId).toBe(u.id);
  });

  it("gửi ẩn danh thì bỏ qua mọi trường định danh dù client gửi kèm", async () => {
    const r = await submitSample({ isAnonymous: true, fullName: "Lộ danh", contact: "0900000000" });
    expect(await prisma.feedbackSender.count({ where: { feedback: { code: r.code } } })).toBe(0);
  });

  it("[3] từ chối nội dung không hợp lệ", async () => {
    const cat = await category();
    const base = { isAnonymous: true, type: "PHAN_ANH", categoryId: cat.id, title: "Tiêu đề hợp lệ", content: "Nội dung đủ dài để vượt qua kiểm tra tối thiểu.", acknowledge: true };
    await expect(submitFeedback({ ...base, content: "   " })).rejects.toThrow(/Nội dung/);
    await expect(submitFeedback({ ...base, content: "​​​".repeat(10) })).rejects.toThrow(/Nội dung/);
    await expect(submitFeedback({ ...base, title: "ab" })).rejects.toThrow(/Tiêu đề/);
    await expect(submitFeedback({ ...base, type: "KHONG_CO" })).rejects.toThrow(/loại ý kiến/);
    await expect(submitFeedback({ ...base, categoryId: "khong-ton-tai" })).rejects.toThrow(/Lĩnh vực/);
    await expect(submitFeedback({ ...base, acknowledge: false })).rejects.toThrow(/xác nhận/);
    await expect(submitFeedback({ ...base, content: "x".repeat(5001) })).rejects.toThrow(/5000/);
    expect(await prisma.feedback.count()).toBe(0);
  });

  it("nội dung có mã HTML được lưu nguyên văn dạng chữ (React tự thoát ký tự khi hiển thị)", async () => {
    const r = await submitSample({ title: "<script>alert(1)</script>" });
    const v = await lookupFeedback({ code: r.code, secret: r.secret });
    expect(v.title).toBe("<script>alert(1)</script>");
  });

  it("giới hạn tần suất gửi theo khóa máy khách", async () => {
    await setSetting("public.rateLimitPerHour", 2);
    await submitSample({}).then(() => undefined);
    const cat = await category();
    const input = { isAnonymous: true, type: "KHAC", categoryId: cat.id, title: "Tiêu đề hợp lệ", content: "Nội dung đủ dài để vượt qua kiểm tra tối thiểu.", acknowledge: true };
    await submitFeedback(input, { clientKey: "1.2.3.4" });
    await submitFeedback(input, { clientKey: "1.2.3.4" });
    await expect(submitFeedback(input, { clientKey: "1.2.3.4" })).rejects.toThrow(/quá nhiều/);
    await submitFeedback(input, { clientKey: "5.6.7.8" });
  });

  it("tạm dừng tiếp nhận khi cấu hình đóng cổng", async () => {
    await setSetting("public.submissionsOpen", false);
    await expect(submitSample()).rejects.toThrow(/tạm dừng/);
  });
});

describe("Tra cứu", () => {
  it("[4] tra cứu đúng mã + bí mật (chấp nhận chữ thường, có/không dấu gạch)", async () => {
    const r = await submitSample();
    const v = await lookupFeedback({ code: r.code.toLowerCase(), secret: r.secret.toLowerCase().replace(/-/g, " ") });
    expect(v.code).toBe(r.code);
    expect(v.publicStatus).toBe("Đã tiếp nhận");
    expect(v.timeline[0].text).toContain("tiếp nhận");
    // Không trả về trường nội bộ
    expect(JSON.stringify(v)).not.toMatch(/secretHash|assignedUser|note"/);
  });

  it("[5] không tra cứu được với mã sai; khóa tạm sau 10 lần sai", async () => {
    const r = await submitSample();
    await expect(lookupFeedback({ code: r.code, secret: "AAAA-AAAA-AAAA" })).rejects.toThrow(/không đúng/);
    await expect(lookupFeedback({ code: "GY-2099-999999", secret: r.secret })).rejects.toThrow(/không đúng/);
    await expect(lookupFeedback({ code: "abc", secret: r.secret })).rejects.toThrow(/định dạng/);
    for (let i = 0; i < 9; i++) await expect(lookupFeedback({ code: r.code, secret: "BBBB-BBBB-BBBB" })).rejects.toThrow();
    // Lần sai thứ 10 → khóa; kể cả mã đúng cũng bị từ chối trong thời gian khóa
    await expect(lookupFeedback({ code: r.code, secret: r.secret })).rejects.toThrow(/tạm khóa/);
  });

  it("[C] phản hồi hai chiều: người gửi bổ sung thông tin khi được yêu cầu", async () => {
    const { requestMoreInfo } = await import("@/server/services/feedback-admin");
    const receiver = await makeUser("RECEIVER");
    const r = await submitSample();
    await requestMoreInfo(receiver, r.id, { content: "Đề nghị cho biết cụ thể thời gian xảy ra." });
    let v = await lookupFeedback({ code: r.code, secret: r.secret });
    expect(v.needsInfo).toBe(true);
    expect(v.responses[0].kind).toBe("REQUEST_INFO");
    v = await addSenderMessage({ code: r.code, secret: r.secret, content: "Xảy ra vào sáng thứ Hai hằng tuần." });
    expect(v.statusKey).toBe("IN_PROGRESS");
    const fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id }, include: { history: true } });
    expect(fb.history.at(-1)!.actorType).toBe("SENDER");
    await expect(addSenderMessage({ code: r.code, secret: "CCCC-CCCC-CCCC", content: "Giả mạo bổ sung" })).rejects.toThrow(/không đúng/);
  });

  it("[E] đánh giá hài lòng chỉ khi đã giải quyết và chỉ một lần", async () => {
    const r = await submitSample();
    await expect(submitSatisfaction({ code: r.code, secret: r.secret, satisfaction: "SATISFIED" })).rejects.toThrow(/đã có kết quả/);
    await prisma.feedback.update({ where: { id: r.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    const v = await submitSatisfaction({ code: r.code, secret: r.secret, satisfaction: "NEUTRAL", comment: "Ổn" });
    expect(v.satisfactionLabel).toBe("Bình thường");
    await expect(submitSatisfaction({ code: r.code, secret: r.secret, satisfaction: "SATISFIED" })).rejects.toThrow(/đã gửi đánh giá/);
  });

  it("[A] gợi ý lĩnh vực theo từ khóa, không tự áp dụng", async () => {
    const cat = await category("KHAC");
    const r = await submitSample({ categoryId: cat.id, title: "Sân bóng đá bị đọng nước", content: "Sân bóng đá sau mưa bị đọng nước, không tổ chức thể thao được." });
    const fb = await prisma.feedback.findUniqueOrThrow({ where: { id: r.id }, include: { suggestedCategory: true } });
    expect(fb.categoryId).toBe(cat.id);
    expect(fb.suggestedCategory?.code).toBe("VH_TT");
  });
});
