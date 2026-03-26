import "server-only";

import type {
  CheckoutOrderMeta,
  CheckoutOrderStatus,
  CheckoutRepository,
  CreateCheckoutOrderResult,
} from "@/lib/domain/checkout/ports";
import { createClient } from "@/lib/supabase/server";

type RpcCheckoutRow = {
  order_id: string;
  total_amount: number;
  document_title: string;
};

export function createSupabaseCheckoutRepository(): CheckoutRepository {
  return {
    async createCheckoutOrder(documentId: string): Promise<CreateCheckoutOrderResult> {
      const supabase = await createClient();

      // We use the RPC because it handles auth.uid() and order_items atomicity securely in DB.
      // But we need to ensure total_price (bridged column) is set.
      const { data, error } = await supabase.rpc("create_checkout_order", { p_document_id: documentId }).single();
      if (error || !data) throw new Error(error?.message || "Không thể tạo đơn hàng.");

      const row = data as RpcCheckoutRow;

      // Bridged fix: ensure total_price is synced for legacy/Print integration if not already by trigger.
      // Migration 20260322135000 added it but function might be old.
      await supabase
        .from("orders")
        .update({ total_price: row.total_amount })
        .eq("id", row.order_id)
        .is("total_price", null);

      return {
        orderId: row.order_id,
        amount: Number(row.total_amount || 0),
        documentTitle: String(row.document_title || "Tài liệu"),
      };
    },
    async getOrderMeta(orderId: string): Promise<CheckoutOrderMeta> {
      const supabase = await createClient();
      const { data } = await supabase.from("orders").select("external_id, status").eq("id", orderId).maybeSingle();
      return {
        externalId: (data?.external_id as string | null | undefined) ?? null,
        status: (data?.status as string | null | undefined) ?? "pending",
      };
    },
    async getOrderStatus(orderId: string): Promise<CheckoutOrderStatus | null> {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, payment_status, updated_at")
        .eq("id", orderId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      const isPaid = data.status === "completed" || data.payment_status === "Đã thanh toán";

      return {
        orderId: String(data.id),
        status: isPaid ? "completed" : String(data.status ?? "pending"),
        paidAt: isPaid && data.updated_at ? String(data.updated_at) : null,
      };
    },
  };
}
