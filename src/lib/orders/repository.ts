import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Order, OrderStatus } from "./types";

export function createOrderRepository() {
    const admin = createServiceRoleClient();

    return {
        async getOrderById(orderId: string): Promise<Order | null> {
            const { data, error } = await admin
                .from("orders")
                .select("*")
                .eq("id", orderId)
                .maybeSingle();

            if (error || !data) return null;
            return data as Order;
        },

        async getOrderStatus(orderId: string): Promise<{ orderId: string; status: OrderStatus; paidAt: string | null } | null> {
            const { data, error } = await admin
                .from("orders")
                .select("id, status, payment_status, updated_at")
                .eq("id", orderId)
                .maybeSingle();

            if (error || !data) return null;
            const isPaid = data.status === "completed" || data.payment_status === "Đã thanh toán";
            return {
                orderId: data.id,
                status: isPaid ? "completed" : data.status,
                paidAt: isPaid ? data.updated_at : null,
            };
        },

        async updateOrderMetadata(orderId: string, metadata: Partial<Order>) {
            const { error } = await admin
                .from("orders")
                .update(metadata)
                .eq("id", orderId);

            if (error) throw error;
        }
    };
}
