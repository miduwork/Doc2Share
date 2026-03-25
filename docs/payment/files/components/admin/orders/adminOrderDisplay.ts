import type { Order } from "@/lib/orders/types";

/** Nhãn gọn giống cột « Nhận hàng » admin (khác DELIVERY_METHOD_LABEL.pickup). */
export function adminDeliveryShortLabel(order: Order): string {
  return order.delivery_method === "delivery" ? "Giao tận nhà" : "Đến lấy";
}
