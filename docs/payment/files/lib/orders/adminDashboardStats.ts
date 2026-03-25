import { isPaidPaymentStatus } from "@/lib/orders/adminOrderFilters";
import type { Order } from "@/lib/orders/types";
import { ORDER_STATUS } from "@/lib/orders/types";

/** Ngày lịch theo timezone local của trình duyệt, định dạng YYYY-MM-DD. */
export function getLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getLocalDateKeyFromIso(iso: string): string {
  return getLocalDateKey(new Date(iso));
}

export type AdminDashboardStats = {
  /** Đơn có created_at thuộc ngày hôm nay (theo timezone trình duyệt). */
  ordersToday: number;
  /** Chưa thanh toán: không phải trạng thái « Đã thanh toán ». */
  unpaidCount: number;
  /** Chưa hoàn thành in: status = ORDER_STATUS.PENDING. */
  pendingPrintCount: number;
};

export function computeAdminDashboardStats(orders: Order[]): AdminDashboardStats {
  const todayKey = getLocalDateKey(new Date());
  let ordersToday = 0;
  let unpaidCount = 0;
  let pendingPrintCount = 0;

  for (const o of orders) {
    if (getLocalDateKeyFromIso(o.created_at) === todayKey) ordersToday += 1;
    if (!isPaidPaymentStatus(o.payment_status)) unpaidCount += 1;
    if (o.status === ORDER_STATUS.PENDING) pendingPrintCount += 1;
  }

  return { ordersToday, unpaidCount, pendingPrintCount };
}
