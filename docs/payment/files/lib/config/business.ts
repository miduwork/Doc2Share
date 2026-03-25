/**
 * Copy & số nghiệp vụ hiển thị (client). Override bằng biến môi trường (build-time):
 * - NEXT_PUBLIC_PICKUP_ADDRESS — địa chỉ lấy hàng (một dòng)
 * - NEXT_PUBLIC_FREESHIP_THRESHOLD_VND — ngưỡng freeship (VNĐ), đồng bộ với calculateGrandTotal
 */

const DEFAULT_PICKUP_ADDRESS =
  "454 Bình Giã, phường Tam Thắng, TP. Hồ Chí Minh";

const DEFAULT_FREESHIP_THRESHOLD_VND = 200_000;

function parsePositiveIntEnv(
  v: string | undefined,
  fallback: number,
): number {
  if (v == null || v.trim() === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const rawPickup = process.env.NEXT_PUBLIC_PICKUP_ADDRESS?.trim();

/** Địa chỉ cửa hàng khi khách chọn tự đến lấy (hiển thị thanh toán / form). */
export const PICKUP_ADDRESS_DISPLAY =
  rawPickup && rawPickup.length > 0 ? rawPickup : DEFAULT_PICKUP_ADDRESS;

/** Ngưỡng giá trị in (chưa ship) để được freeship — khớp [lib/payments/pricing.ts]. */
export const FREESHIP_THRESHOLD_VND = parsePositiveIntEnv(
  process.env.NEXT_PUBLIC_FREESHIP_THRESHOLD_VND,
  DEFAULT_FREESHIP_THRESHOLD_VND,
);

/** Chuỗi gợi ý freeship cho UI (định dạng theo locale). */
export function getFreeshipHintText(
  thresholdVnd: number = FREESHIP_THRESHOLD_VND,
): string {
  return `Freeship cho đơn từ ${thresholdVnd.toLocaleString("vi-VN")} VNĐ`;
}
