import { periodRange, type PeriodKind } from "./dates";

export const PERIOD_KINDS: Record<PeriodKind, string> = { week: "Tuần này", month: "Tháng này", quarter: "Quý này", year: "Năm nay", custom: "Tùy chỉnh" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function resolvePeriod(sp: Record<string, string | undefined>): { kind: PeriodKind; from: string; to: string } {
  const kind = (Object.keys(PERIOD_KINDS).includes(sp.ky ?? "") ? sp.ky : "month") as PeriodKind;
  if (kind === "custom" && sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to)) return { kind, from: sp.from, to: sp.to };
  return { kind, ...periodRange(kind === "custom" ? "month" : kind) };
}
