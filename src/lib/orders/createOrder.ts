import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CheckoutResult } from "./types";

/**
 * Creates a new order for a single document purchase.
 * Merges legacy Doc2Share logic with new QR2Print columns.
 */
export async function createDocumentOrder(params: {
    userId: string;
    documentId: string;
}): Promise<CheckoutResult> {
    const admin = createServiceRoleClient();

    // 1. Fetch document info (price, title)
    const { data: doc, error: docError } = await admin
        .from("documents")
        .select("id, title, price")
        .eq("id", params.documentId)
        .single();

    if (docError || !doc) throw new Error("Document not found");

    const amount = Number(doc.price || 0);
    const orderId = crypto.randomUUID();
    const shortId = orderId.slice(0, 8).toUpperCase();
    const transferContent = `IN AN ${shortId}`;

    // 2. Create the order with all necessary columns (bridged)
    const { data: order, error: orderError } = await admin
        .from("orders")
        .insert({
            id: orderId,
            user_id: params.userId,
            status: "pending",
            total_amount: amount,
            payment_status: "Chưa thanh toán",
            external_id: shortId,
            order_items: [
                {
                    document_id: doc.id,
                    title: doc.title,
                    price: amount,
                    quantity: 1,
                },
            ],
        })
        .select()
        .single();

    if (orderError) {
        console.error("Failed to create order:", orderError);
        throw new Error("Failed to create order");
    }

    // 3. Insert order item for normalization
    await admin.from("order_items").insert({
        order_id: orderId,
        document_id: doc.id,
        price: amount,
        quantity: 1,
    });

    return {
        orderId: order.id,
        externalId: shortId,
        documentTitle: doc.title,
        amount: amount,
        transferContent: transferContent,
        paymentLink: "", // Handled by frontend via /api/qr
        status: "pending",
    };
}
