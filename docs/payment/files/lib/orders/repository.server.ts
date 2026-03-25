import type { PostgrestError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderInsert } from "./types";

/** Cột trả về cho GET /api/orders/[id] (trang thanh toán). */
const ORDER_PAYMENT_SELECT =
  "id, customer_name, total_pages, page_count, total_price, copies, delivery_method, delivery_address, shipping_fee, payment_status, print_color, print_sides, order_spec";

export type OrderPaymentRow = {
  id: string;
  customer_name: string;
  total_pages: number | null;
  page_count: number | null;
  total_price: number | null;
  copies: number | null;
  delivery_method: string | null;
  delivery_address: string | null;
  shipping_fee: number | null;
  payment_status: string | null;
  print_color: string | null;
  print_sides: string | null;
  order_spec: Record<string, unknown> | null;
};

export type GetOrderByIdResult =
  | { ok: true; order: OrderPaymentRow }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "error"; error: PostgrestError };

function logOrdersServerError(context: string, error: PostgrestError) {
  console.error(`[orders.repository.server] ${context}:`, error);
}

/**
 * Đọc đơn theo id (service role). Chỉ dùng trên server (API routes, server actions).
 */
export async function getOrderById(id: string): Promise<GetOrderByIdResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_PAYMENT_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.message.includes("Row not found")) {
      return { ok: false, kind: "not_found" };
    }
    logOrdersServerError("getOrderById", error);
    return { ok: false, kind: "error", error };
  }

  const row = data as OrderPaymentRow;
  return {
    ok: true,
    order: {
      ...row,
      payment_status: row.payment_status?.trim() ?? null,
    },
  };
}

function logOrdersServerInsertError(context: string, error: PostgrestError) {
  console.error(`[orders.repository.server] ${context}:`, error);
}

/**
 * Insert đơn (service role).
 */
export async function insertOrderWithServiceRole(
  order: OrderInsert,
): Promise<{ error: PostgrestError | null }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").insert(order);
  if (error) logOrdersServerInsertError("insertOrderWithServiceRole", error);
  return { error };
}
