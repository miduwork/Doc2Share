export type OrderStatus = "pending" | "completed" | "expired" | "cancelled";

export interface Order {
    id: string;
    user_id: string;
    status: OrderStatus;
    total_amount: number;
    payment_status?: string; // QR2Print bridge
    customer_name?: string;
    phone_number?: string;
    delivery_method?: string;
    external_id: string | null;
    payment_ref?: string | null;
    created_at: string;
    updated_at: string;
    order_items: any; // JSONB from DB
}

export interface OrderItem {
    id: string;
    order_id: string;
    document_id: string;
    quantity: number;
    price: number;
    title?: string; // Denormalized for quick view
}

export interface CheckoutResult {
    orderId: string;
    externalId: string | null;
    documentTitle: string;
    amount: number;
    paymentLink: string;
    transferContent: string;
    status: OrderStatus;
}
