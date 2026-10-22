// Tính hạn xử lý theo mức ưu tiên và lĩnh vực.
import type { Priority } from "@prisma/client";
import { getSetting } from "../settings";
import { addDays } from "@/lib/dates";

export async function slaDays(priority: Priority, categorySlaDays: number | null | undefined): Promise<number> {
  const cfg = await getSetting("sla.days");
  if (priority === "NORMAL") return categorySlaDays ?? cfg.NORMAL;
  return Math.min(cfg[priority], categorySlaDays ?? cfg[priority]);
}

export async function computeDueAt(from: Date, priority: Priority, categorySlaDays: number | null | undefined): Promise<Date> {
  return addDays(from, await slaDays(priority, categorySlaDays));
}
