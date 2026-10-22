// Chạy một lần khi máy chủ khởi động: lập lịch quét hạn xử lý để tạo thông báo nội bộ.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_SCHEDULER === "true") return;
  const { runDeadlineScan } = await import("./server/services/notifications");
  const run = () => runDeadlineScan().catch((e) => console.error("[deadline-scan]", e instanceof Error ? e.message : e));
  setTimeout(run, 15_000);
  setInterval(run, 15 * 60_000);
}
