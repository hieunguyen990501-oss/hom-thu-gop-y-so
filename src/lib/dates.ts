// Xử lý ngày giờ theo múi giờ Việt Nam (UTC+7, không có giờ mùa hè).
export const TZ = "Asia/Ho_Chi_Minh";
const OFFSET_MS = 7 * 3600_000;
export const DAY_MS = 86_400_000;

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

// "2026-10" theo giờ Việt Nam
export function monthKey(d: Date): string {
  const v = new Date(d.getTime() + OFFSET_MS);
  return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `T${Number(m)}/${y}`;
}

export function vnYear(d: Date): number {
  return new Date(d.getTime() + OFFSET_MS).getUTCFullYear();
}

// Đầu ngày (00:00 giờ VN) của chuỗi "YYYY-MM-DD", trả về Date UTC.
export function startOfVnDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);
}

export function endOfVnDay(isoDate: string): Date {
  return new Date(startOfVnDay(isoDate).getTime() + DAY_MS - 1);
}

export function toVnIsoDate(d: Date): string {
  const v = new Date(d.getTime() + OFFSET_MS);
  return v.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export type PeriodKind = "week" | "month" | "quarter" | "year" | "custom";

// Khoảng thời gian chứa ngày tham chiếu (theo giờ VN). Trả về chuỗi YYYY-MM-DD.
export function periodRange(kind: PeriodKind, ref: Date = new Date()): { from: string; to: string } {
  const v = new Date(ref.getTime() + OFFSET_MS);
  const y = v.getUTCFullYear();
  const m = v.getUTCMonth();
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  switch (kind) {
    case "week": {
      const dow = (v.getUTCDay() + 6) % 7; // thứ Hai = 0
      const start = new Date(Date.UTC(y, m, v.getUTCDate() - dow));
      return { from: iso(start), to: iso(new Date(start.getTime() + 6 * DAY_MS)) };
    }
    case "quarter": {
      const q = Math.floor(m / 3);
      return { from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(new Date(Date.UTC(y, q * 3 + 3, 0))) };
    }
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "month":
    default:
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
  }
}

export function monthsBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const a = new Date(from.getTime() + OFFSET_MS);
  const b = new Date(to.getTime() + OFFSET_MS);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth())) {
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m > 11) { m = 0; y++; }
    if (keys.length > 60) break;
  }
  return keys;
}
