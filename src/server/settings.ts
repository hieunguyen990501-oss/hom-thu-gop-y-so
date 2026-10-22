// Cấu hình hệ thống lưu trong bảng SystemSetting, có giá trị mặc định an toàn.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface SettingsShape {
  "system.demoMode": boolean;
  "public.submissionsOpen": boolean;
  "public.allowIdentified": boolean;
  "public.rateLimitPerHour": number;
  "workflow.requireApproval": boolean;
  "sla.days": { NORMAL: number; ATTENTION: number; HIGH: number };
  "sla.dueSoonDays": number;
  "qr.publicBaseUrl": string;
  "qr.targetPath": string;
  "retention.closedMonths": number;
  "security.requireTotpRoles": string[];
}

export const DEFAULT_SETTINGS: SettingsShape = {
  "system.demoMode": false,
  "public.submissionsOpen": true,
  "public.allowIdentified": true,
  "public.rateLimitPerHour": 5,
  "workflow.requireApproval": true,
  "sla.days": { NORMAL: 15, ATTENTION: 7, HIGH: 3 },
  "sla.dueSoonDays": 2,
  "qr.publicBaseUrl": process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  "qr.targetPath": "/",
  "retention.closedMonths": 36,
  "security.requireTotpRoles": [],
};

export type SettingKey = keyof SettingsShape;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsShape[K]> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return (row?.value as SettingsShape[K] | undefined) ?? DEFAULT_SETTINGS[key];
}

export async function getAllSettings(): Promise<SettingsShape> {
  const rows = await prisma.systemSetting.findMany();
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as unknown as SettingsShape;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingsShape[K], updatedById?: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, updatedById },
    update: { value: value as Prisma.InputJsonValue, updatedById },
  });
}

export const isDemoMode = () => getSetting("system.demoMode");
