import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
    extractOrderReferences,
    extractAmount,
    resolveEventId,
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
    | { ok: false; status: 400 | 401 | 409 | 503 | 500; error: string };

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
    requestId: string,
): Promise<SePayHandleResult> {
    const admin = createServiceRoleClient();
    const { transferTypeNorm, transferAmount } = normalizeSePayPayload(body);
    const refs = extractOrderReferences(body as any);

    const payloadCanonical = stableStringify(body);
    const payloadHash = createHash("sha256").update(payloadCanonical, "utf8").digest("hex");
    const eventId = resolveEventId(body as any, refs, payloadHash);

    // 1) Idempotency contract (route-level)
    const { data: regRows, error: registerError } = await admin.rpc("register_webhook_event", {
        p_provider: "sepay",
        p_event_id: eventId,
        p_payload_hash: payloadHash,
        p_request_id: requestId,
    });

    if (registerError) {
        console.error("Webhook SePay: register_webhook_event failed", registerError);
        return { ok: false, status: 500, error: registerError.message };
    }

    const reg = Array.isArray(regRows) ? regRows[0] : regRows;
    const shouldProcess = Boolean(reg?.should_process);
    const currentStatus = String(reg?.current_status ?? "");

    if (!shouldProcess) {
        if (currentStatus === "hash_mismatch") {
            return { ok: false, status: 409, error: "hash_mismatch" };
        }
        return { ok: true, status: 200, message: `Duplicate/ignored (${currentStatus})` };
    }

    // 2) Process (must always complete_webhook_event for should_process=true)
    const complete = async (opts: {
        status: "processed" | "ignored" | "error";
        orderId?: string;
        errorMessage?: string | null;
    }) => {
        await admin.rpc("complete_webhook_event", {
            p_provider: "sepay",
            p_event_id: eventId,
            p_status: opts.status,
            p_order_id: opts.orderId ?? null,
            p_error_message: opts.errorMessage ?? null,
        });
    };

    try {
        // Ignore non-incoming transfers
        if (transferTypeNorm !== "in") {
            await complete({ status: "ignored" });
            return { ok: true, status: 200, message: "Ignored: not an incoming transfer" };
        }

        if (refs.length === 0) {
            console.error("Webhook SePay: no order reference in content/description", {
                content: typeof (body.content ?? "") === "string" ? String(body.content).slice(0, 80) : body.content,
            });
            await logTransaction(admin, body, { order_id: null, order_id_prefix: null });
            await complete({ status: "ignored" });
            return { ok: true, status: 200, message: "No order code in content" };
        }

        let order: any = null;
        let orderIdPrefixMatch: string | null = null;
        let ambiguous = false;

        // Try matching each ref until we find a single deterministic order
        for (const ref of refs) {
            let matchedOrders: any[] = [];

            // 1) Try matching by UUID prefix via RPC (optimized, if exists)
            try {
                const { data: rpcRows, error: rpcError } = await admin.rpc(
                    "match_orders_by_id_prefix",
                    { p_prefix: ref },
                );
                if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
                    matchedOrders = rpcRows;
                }
            } catch {
                // Silent fail for RPC (fallback will run)
            }

            // 2) Fallback to direct external_id match if RPC failed or missed
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

            if (matchedOrders.length > 1) {
                // Ambiguous match => do not choose matchedOrders[0]
                ambiguous = true;
                break;
            }

            if (matchedOrders.length === 1) {
                order = matchedOrders[0];
                orderIdPrefixMatch = ref;
                break; // FOUND!
            }
        }

        if (ambiguous) {
            await logTransaction(admin, body, {
                order_id: null,
                order_id_prefix: refs.join(","),
                amount_matched: null,
                ambiguous_order_match: true,
            });
            await complete({ status: "error", errorMessage: "ambiguous_order_match" });
            return { ok: false, status: 409, error: "ambiguous_order_match" };
        }

        if (!order) {
            console.error("Webhook SePay: order not found for any ref", { refs });
            await logTransaction(admin, body, { order_id: null, order_id_prefix: refs.join(",") });
            await complete({ status: "ignored" });
            return { ok: true, status: 200, message: "Order not found" };
        }

        const orderIdPrefix = orderIdPrefixMatch!;
        const expectedAmount = resolveExpectedOrderAmount(order);
        const amountMatched = expectedAmount > 0 && Math.round(transferAmount) === expectedAmount;

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
                metadata: {
                    expectedAmount,
                    transferAmount,
                    orderId: order.id,
                    actualAmount: (order as any).total_amount,
                },
            });
            await complete({
                status: "error",
                orderId: order.id,
                errorMessage: "amount_mismatch",
            });
            return { ok: false, status: 400, error: "amount_mismatch" };
        }

        // ATOMIC COMPLETION (Updates order.status and grants document permissions)
        const { data: completionRows, error: updateError } = await admin.rpc(
            "complete_order_and_grant_permissions",
            {
                p_order_id: order.id,
                p_external_ref: body.referenceCode || body.reference_code || orderIdPrefix,
                p_raw_webhook: body,
            },
        );

        const completion = Array.isArray(completionRows) ? completionRows[0] : completionRows;
        const alreadyCompleted = Boolean(completion?.already_completed);

        if (updateError) {
            console.error(
                "Webhook SePay: RPC complete_order_and_grant_permissions",
                updateError,
            );
            await complete({
                status: "error",
                orderId: order.id,
                errorMessage: "complete_order_and_grant_permissions_error",
            });
            return { ok: false, status: 500, error: updateError.message };
        }

        // Sync the new columns for the payment UI
        if (!alreadyCompleted) {
            await admin
                .from("orders")
                .update({
                    payment_status: PAYMENT_STATUS_PAID,
                    priority: PRIORITY_NORMAL,
                })
                .eq("id", order.id);
        }

        await logTransaction(admin, body, {
            order_id: order.id,
            order_id_prefix: orderIdPrefix,
            amount_matched: true,
            order_updated: true,
        });

        await complete({
            status: "processed",
            orderId: order.id,
        });

        return { ok: true, status: 200 };
    } catch (err: any) {
        console.error("Webhook SePay: unexpected error", err);
        // Best-effort completion to keep DB state consistent
        try {
            await complete({
                status: "error",
                errorMessage: "internal_error",
            });
        } catch {
            // ignore
        }
        return { ok: false, status: 500, error: "Internal server error" };
    }
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

function stableStringify(value: unknown): string {
    // Deterministic string used for hashing webhook payloads.
    // - Object keys sorted
    // - undefined values omitted (by not emitting those keys)
    if (value === null) return "null";
    const t = typeof value;
    if (t === "number" || t === "boolean" || t === "string") return JSON.stringify(value);
    if (t === "bigint") return JSON.stringify((value as bigint).toString());
    if (t === "undefined") return JSON.stringify(null);
    if (Array.isArray(value)) {
        return `[${value.map((v) => stableStringify(v)).join(",")}]`;
    }
    if (t === "object") {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj)
            .filter((k) => obj[k] !== undefined)
            .sort();
        const props = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
        return `{${props.join(",")}}`;
    }
    // functions/symbols -> stringify as string form (should not appear in JSON payload)
    return JSON.stringify(String(value));
}
