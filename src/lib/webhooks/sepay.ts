import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
    extractOrderReferences,
    extractAmount,
} from "@/lib/payments/sepay-webhook-core";

const PAYMENT_STATUS_PAID = "Đã thanh toán";
const PRIORITY_NORMAL = "Ưu tiên";

export type SePayWebhookPayload = {
    id?: number;
    gateway?: string;
    transactionDate?: string;
    transaction_date?: string;
    accountNumber?: string;
    account_number?: string;
    code?: string | null;
    content?: string;
    transferType?: string;
    transfer_type?: string;
    transferAmount?: number | string;
    amount?: number | string;
    accumulated?: number;
    subAccount?: string | null;
    referenceCode?: string;
    reference_code?: string;
    description?: string;
    transaction_id?: string;
    transfer_amount?: number | string;
    amount_in?: number | string;
};

/** Số tiền kỳ vọng (source of truth): luôn lấy từ `orders.total_amount`. */
function resolveExpectedOrderAmount(order: { total_amount?: unknown }): number {
    const nTa = order.total_amount == null || order.total_amount === "" ? NaN : Number(order.total_amount);
    if (Number.isFinite(nTa) && nTa > 0) return Math.round(nTa);
    return 0;
}

export type SePayHandleResult =
    | { ok: true; status: 200; message?: string }
    | { ok: false; status: 400 | 401 | 503 | 500; error: string };

export function isSePayAuthorized(request: Request): boolean {
    const apiKey = process.env.WEBHOOK_SEPAY_API_KEY;
    if (!apiKey) return false;
    const auth = request.headers.get("Authorization") ?? "";
    return auth === `Apikey ${apiKey}` || auth === apiKey;
}

export async function parseSePayJson(request: Request): Promise<
    | { ok: true; payload: SePayWebhookPayload }
    | { ok: false; error: string }
> {
    try {
        const payload = (await request.json()) as SePayWebhookPayload;
        return { ok: true, payload };
    } catch {
        return { ok: false, error: "Invalid JSON body" };
    }
}



export function normalizeSePayPayload(
    body: SePayWebhookPayload,
): { transferTypeNorm: "in" | "out" | "other"; transferAmount: number } {
    const tt = body.transferType ?? body.transfer_type ?? "";
    const lower = String(tt).toLowerCase();
    let transferTypeNorm: "in" | "out" | "other" = "other";
    if (lower === "in" || lower === "credit") transferTypeNorm = "in";
    else if (lower === "out" || lower === "debit") transferTypeNorm = "out";

    const amt = extractAmount(body as any) ?? 0;

    if (transferTypeNorm === "other" && amt > 0) {
        transferTypeNorm = "in";
    }

    return { transferTypeNorm, transferAmount: amt };
}

export async function handleSePayWebhook(
    body: SePayWebhookPayload,
): Promise<SePayHandleResult> {
    const content = body.content ?? "";
    const { transferTypeNorm, transferAmount } = normalizeSePayPayload(body);

    if (transferTypeNorm !== "in") {
        return { ok: true, status: 200, message: "Ignored: not an incoming transfer" };
    }

    const admin = createServiceRoleClient();
    const refs = extractOrderReferences(body as any);

    if (refs.length === 0) {
        console.error("Webhook SePay: no order reference in content/description", {
            content: typeof content === "string" ? content.slice(0, 80) : content,
        });
        await logTransaction(admin, body, { order_id: null, order_id_prefix: null });
        return { ok: true, status: 200, message: "No order code in content" };
    }

    let order: any = null;
    let orderIdPrefixMatch: string | null = null;

    // Try matching each ref until we find an order
    for (const ref of refs) {
        let matchedOrders: any[] = [];

        // 1. Try matching by UUID prefix via RPC (optimized, if exists)
        try {
            const { data: rpcRows, error: rpcError } = await admin.rpc(
                "match_orders_by_id_prefix",
                { p_prefix: ref },
            );
            if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
                matchedOrders = rpcRows;
            }
        } catch (e) {
            // silent fail for RPC
        }

        // 2. Fallback to direct external_id match if RPC failed or missed
        if (matchedOrders.length === 0) {
            const { data: fallbackRows, error: fallbackError } = await admin
                .from("orders")
                .select("id, total_amount, payment_status, status")
                .ilike("external_id", `${ref}%`)
                .limit(2);

            if (!fallbackError && Array.isArray(fallbackRows) && fallbackRows.length > 0) {
                matchedOrders = fallbackRows;
            }
        }

        if (matchedOrders.length > 0) {
            order = matchedOrders[0];
            orderIdPrefixMatch = ref;
            break; // FOUND!
        }
    }

    if (!order) {
        console.error("Webhook SePay: order not found for any ref", { refs });
        await logTransaction(admin, body, { order_id: null, order_id_prefix: refs.join(",") });
        return { ok: true, status: 200, message: "Order not found" };
    }

    const orderIdPrefix = orderIdPrefixMatch!;
    const expectedAmount = resolveExpectedOrderAmount(order);
    const amountMatched =
        expectedAmount > 0 && Math.round(transferAmount) === expectedAmount;

    if (!amountMatched) {
        console.error("Webhook SePay: amount mismatch", {
            orderIdPrefix,
            expectedAmount,
            transferAmount,
            orderId: order.id,
            total_amount: (order as any).total_amount,
        });
        await logTransaction(admin, body, {
            order_id: order.id,
            order_id_prefix: orderIdPrefix,
            amount_matched: false,
            // Extra debug info in JSON
            metadata: { expectedAmount, transferAmount, orderId: order.id, actualAmount: (order as any).total_amount }
        });
        return {
            ok: true,
            status: 200,
            message: `Amount mismatch (expected=${expectedAmount}, got=${transferAmount})`,
        };
    }

    // ATOMIC COMPLETION (Updates order.status and grants document permissions)
    const { data: completionRows, error: updateError } = await admin.rpc(
        "complete_order_and_grant_permissions",
        {
            p_order_id: order.id,
            p_external_ref: body.referenceCode || body.reference_code || orderIdPrefix,
            p_raw_webhook: body,
        }
    );

    const completion = Array.isArray(completionRows) ? completionRows[0] : completionRows;
    const alreadyCompleted = Boolean(completion?.already_completed);

    // Sync the new columns for the payment UI
    if (!alreadyCompleted && !updateError) {
        await admin.from("orders").update({
            payment_status: PAYMENT_STATUS_PAID,
            priority: PRIORITY_NORMAL,
        }).eq("id", order.id);
    }

    await logTransaction(admin, body, {
        order_id: order.id,
        order_id_prefix: orderIdPrefix,
        amount_matched: true,
        order_updated: !updateError,
    });

    if (updateError) {
        console.error("Webhook SePay: RPC complete_order_and_grant_permissions", updateError);
        return { ok: false, status: 500, error: updateError.message };
    }

    return { ok: true, status: 200 };
}

async function logTransaction(admin: any, body: SePayWebhookPayload, metadata: any) {
    const transferAmount = extractAmount(body as any) ?? 0;
    try {
        await admin.from("transactions").insert({
            sepay_id: body.id ?? null,
            gateway: body.gateway ?? null,
            transaction_date: body.transactionDate ?? body.transaction_date ?? null,
            account_number: body.accountNumber ?? body.account_number ?? null,
            content: body.content ?? null,
            description: body.description ?? null,
            transfer_type: body.transferType ?? body.transfer_type ?? null,
            transfer_amount: transferAmount,
            reference_code: body.referenceCode ?? body.reference_code ?? null,
            raw_payload: body,
            ...metadata,
        });
    } catch {
        // Fallback to observability if transactions table fails
        await admin.from("observability_events").insert({
            source: "api.webhook_sepay",
            event_type: "transaction_log_fallback",
            severity: "info",
            metadata: { ...body, ...metadata },
        });
    }
}
