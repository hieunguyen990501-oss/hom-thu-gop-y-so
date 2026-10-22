// Sinh mã QR cục bộ (thư viện qrcode), không phụ thuộc dịch vụ trực tuyến.
// Mã QR luôn trỏ tới đường dẫn cố định "<địa chỉ chính thức>/q"; trang /q chuyển hướng nội bộ tới
// đường dẫn đích cấu hình trong quản trị → đổi đích không cần in lại mã. Mã QR không chứa tham số
// định danh, tránh "QR cá nhân hóa" làm lộ người gửi.
import QRCode from "qrcode";
import { getSetting } from "../settings";

export async function qrTargetUrl(): Promise<string> {
  const base = (await getSetting("qr.publicBaseUrl")).replace(/\/+$/, "");
  return `${base}/q`;
}

const OPTS = { errorCorrectionLevel: "H" as const, margin: 2, color: { dark: "#1f2a1c", light: "#ffffff" } };

export async function qrPng(size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(await qrTargetUrl(), { ...OPTS, type: "png", width: Math.min(Math.max(size, 256), 2048) });
}

export async function qrSvg(): Promise<string> {
  return QRCode.toString(await qrTargetUrl(), { ...OPTS, type: "svg" });
}

export async function qrDataUrl(text?: string, width = 640): Promise<string> {
  return QRCode.toDataURL(text ?? (await qrTargetUrl()), { ...OPTS, width });
}
