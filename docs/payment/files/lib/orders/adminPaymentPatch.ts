/** Giá trị thanh toán đã thanh toán — đồng bộ với SePay / trang thanh toán. */
export const PAYMENT_STATUS_PAID = "Đã thanh toán";

/** Giá trị hiển thị / PATCH tay cho « chưa thanh toán » (khác null trong DB). */
export const PAYMENT_STATUS_UNPAID_LABEL = "Chưa thanh toán";

export const ADMIN_PATCH_NOTE_MAX_LENGTH = 20_000;

export function isAllowedAdminPaymentStatus(v: string | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  const t = v.trim();
  return t === PAYMENT_STATUS_PAID || t === PAYMENT_STATUS_UNPAID_LABEL;
}
