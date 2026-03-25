import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ORDER_ID_REGEX = /IN AN\s+([a-fA-F0-9]{6,8})/i;
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
};

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

function extractOrderIdPrefix(text: string | null | undefined): string | null {
    if (!text || typeof text !== "string") return null;
    const m = text.match(ORDER_ID_REGEX);
    return m ? m[1].toLowerCase() : null;
}

function coerceAmount(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
        const s = v.replace(/\s/g, "");
        if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
            return parseInt(s.replace(/\./g, ""), 10);
        }
        if (/^\d+$/.test(s)) {
            return parseInt(s, 10);
        }
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function normalizeSePayPayload(
    body: SePayWebhookPayload,
): { transferTypeNorm: "in" | "out" | "other"; transferAmount: number } {
    const tt = body.transferType ?? body.transfer_type ?? "";
    const lower = String(tt).toLowerCase();
    let transferTypeNorm: "in" | "out" | "other" = "other";
    if (lower === "in" || lower === "credit") transferTypeNorm = "in";
    else if (lower === "out" || lower === "debit") transferTypeNorm = "out";

    const amt = coerceAmount(body.transferAmount) ?? coerceAmount(body.amount) ?? 0;

    if (transferTypeNorm === "other" && amt > 0) {
        transferTypeNorm = "in";
    }

    return { transferTypeNorm, transferAmount: amt };
}

export async function handleSePayWebhook(
    body: SePayWebhookPayload,
): Promise<SePayHandleResult> {
    const content = body.content ?? "";
    const description = body.description ?? "";
    const text = `${content} ${description}`.trim();
    const { transferTypeNorm, transferAmount } = normalizeSePayPayload(body);

    if (transferTypeNorm !== "in") {
        return { ok: true, status: 200, message: "Ignored: not an incoming transfer" };
    }

    const admin = createServiceRoleClient();
    const orderIdPrefix = extractOrderIdPrefix(text);

    if (!orderIdPrefix) {
        await logTransaction(admin, body, { order_id: null, order_id_prefix: null });
        return { ok: true, status: 200, message: "No order code in content" };
    }

    // Find order by 8-char prefix (id::text)
    const { data: orderRows, error: findError } = await admin.rpc(
        "match_orders_by_id_prefix",
        { p_prefix: orderIdPrefix },
    );
    const orders = orderRows ?? [];

    if (findError || !orders.length) {
        await logTransaction(admin, body, { order_id: null, order_id_prefix: orderIdPrefix });
        return { ok: true, status: 200, message: "Order not found" };
    }

    const order = orders[0];
    const expectedAmount = Number(order.total_price ?? 0);
    const amountMatched = transferAmount === expectedAmount && expectedAmount > 0;

    if (!amountMatched) {
        await logTransaction(admin, body, {
            order_id: order.id,
            order_id_prefix: orderIdPrefix,
            amount_matched: false,
        });
        return { ok: true, status: 200, message: "Amount mismatch" };
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
    const { transferAmount } = normalizeSePayPayload(body);
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
}
