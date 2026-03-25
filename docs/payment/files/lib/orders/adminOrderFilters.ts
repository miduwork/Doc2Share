import type { Order } from "./types";

const PAYMENT_STATUS_PAID = "Đã thanh toán";

export function isPaidPaymentStatus(status: string | null | undefined): boolean {
  if (status == null) return false;
  return status.trim() === PAYMENT_STATUS_PAID;
}

export function normalizeUuidForPrefixMatch(s: string): string {
  return s.replace(/-/g, "").toLowerCase();
}

export function orderMatchesSearchQuery(order: Order, rawQ: string): boolean {
  const q = rawQ.trim();
  if (!q) return true;

  const qLower = q.toLowerCase();
  const phoneDigits = order.phone_number.replace(/\s/g, "");
  const qDigits = q.replace(/\s/g, "");
  if (phoneDigits.includes(qDigits) || order.phone_number.toLowerCase().includes(qLower)) {
    return true;
  }
  if (order.customer_name.toLowerCase().includes(qLower)) {
    return true;
  }

  const idNorm = normalizeUuidForPrefixMatch(order.id);
  const qNorm = normalizeUuidForPrefixMatch(q);
  if (qNorm.length === 0) return true;
  if (qNorm.length >= 8) {
    return idNorm.slice(0, 8) === qNorm.slice(0, 8);
  }
  return idNorm.startsWith(qNorm);
}

export type AdminOrderListFilters = {
  payment: "" | "paid" | "unpaid";
  status: string;
  q: string;
};

export function filterAdminOrders(
  orders: Order[],
  filters: AdminOrderListFilters,
): Order[] {
  return orders.filter((order) => {
    if (filters.payment === "paid" && !isPaidPaymentStatus(order.payment_status)) {
      return false;
    }
    if (filters.payment === "unpaid" && isPaidPaymentStatus(order.payment_status)) {
      return false;
    }
    if (filters.status && order.status !== filters.status) {
      return false;
    }
    if (!orderMatchesSearchQuery(order, filters.q)) {
      return false;
    }
    return true;
  });
}
