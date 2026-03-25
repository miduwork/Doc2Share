import { serverConfig } from "@/lib/config/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/orders/types";
import type { TransactionInsert } from "@/lib/types";

const ORDER_ID_REGEX = /IN AN\s+([a-fA-F0-9]{6,8})/i;
const PAYMENT_STATUS_PAID = "Đã thanh toán";
const PRIORITY_NORMAL = "Ưu tiên";

/**
 * Payload webhook SePay.
 * - Cổng thanh toán / tài liệu cũ: camelCase `transferType` ("in"|"out"), `transferAmount`.
 * - BankHub IPN (biến động số dư): snake_case `transfer_type` ("credit"|"debit"), `amount`.
 * @see https://developer.sepay.vn/vi/bankhub/thong-bao-bien-dong-so-du
 */
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
  /** BankHub: tiền vào = "credit", ra = "debit" */
  transfer_type?: string;
  /** JSON runtime có thể là number hoặc chuỗi (vd. "2.000" VNĐ). */
  transferAmount?: number | string;
  /** BankHub: số tiền giao dịch */
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

/** SePay gửi API Key qua header: Authorization: "Apikey YOUR_KEY" */
export function isSePayAuthorized(request: Request): boolean {
  const apiKey = serverConfig.sepayWebhookKey;
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

/**
 * SePay / UI VN có thể gửi số tiền dạng chuỗi với dấu chấm phân nghìn (vd. "2.000").
 * Trong JS, parseFloat("2.000") === 2 — sai với 2000 VND → phải bỏ dấu chấm nhóm nghìn.
 */
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

/** Chuẩn hoá: BankHub dùng credit/debit + amount; cổng cũ dùng in/out + transferAmount. */
export function normalizeSePayPayload(
  body: SePayWebhookPayload,
): { transferTypeNorm: "in" | "out" | "other"; transferAmount: number } {
  const tt =
    body.transferType ??
    body.transfer_type ??
    "";
  const lower = String(tt).toLowerCase();
  let transferTypeNorm: "in" | "out" | "other" = "other";
  if (lower === "in" || lower === "credit") transferTypeNorm = "in";
  else if (lower === "out" || lower === "debit") transferTypeNorm = "out";

  const amt =
    coerceAmount(body.transferAmount) ??
    coerceAmount(body.amount) ??
    0;

  // Webhook chỉ bật "tiền vào" nhưng một payload SePay/BankHub thiếu transferType → trước đây thành "other" và bị bỏ qua.
  if (transferTypeNorm === "other" && amt > 0) {
    transferTypeNorm = "in";
  }

  return { transferTypeNorm, transferAmount: amt };
}

function payloadToTransaction(
  body: SePayWebhookPayload,
  overrides: Partial<TransactionInsert>,
): TransactionInsert {
  const { transferAmount } = normalizeSePayPayload(body);
  return {
    sepay_id: body.id ?? null,
    gateway: body.gateway ?? null,
    transaction_date: body.transactionDate ?? body.transaction_date ?? null,
    account_number: body.accountNumber ?? body.account_number ?? null,
    content: body.content ?? null,
    description: body.description ?? null,
    transfer_type: body.transferType ?? body.transfer_type ?? null,
    transfer_amount: transferAmount,
    reference_code: body.referenceCode ?? body.reference_code ?? null,
    order_id: null,
    order_id_prefix: null,
    amount_matched: false,
    order_updated: false,
    raw_payload: body as Record<string, unknown>,
    ...overrides,
  };
}

/**
 * Xử lý webhook SePay:
 * - chỉ xử lý tiền vào: transferType "in" hoặc BankHub transfer_type "credit"
 * - trích mã đơn từ content/description: "IN AN xxxxxxxx"
 * - tìm order theo prefix id
 * - so khớp amount với total_price
 * - cập nhật orders.payment_status = 'Đã thanh toán' và priority = 'Ưu tiên'
 * - log vào bảng transactions
 */
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

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("Webhook SePay: missing SUPABASE_SERVICE_ROLE_KEY", e);
    return { ok: false, status: 503, error: "Server configuration error" };
  }

  const orderIdPrefix = extractOrderIdPrefix(text);
  if (!orderIdPrefix) {
    await admin.from("transactions").insert(
      payloadToTransaction(body, {
        order_id: null,
        order_id_prefix: null,
        amount_matched: false,
        order_updated: false,
      }),
    );
    return { ok: true, status: 200, message: "No order code in content" };
  }

  // PostgREST không áp ổn định filter `id::text` qua query string — dùng RPC (migration 20260322140000).
  const { data: orderRows, error: findError } = await admin.rpc(
    "match_orders_by_id_prefix",
    { p_prefix: orderIdPrefix },
  );
  const orders = orderRows ?? [];
  if (findError) {
    console.error("Webhook SePay: match_orders_by_id_prefix", findError);
  }

  if (findError || !orders.length) {
    await admin.from("transactions").insert(
      payloadToTransaction(body, {
        order_id: null,
        order_id_prefix: orderIdPrefix,
      }),
    );
    return { ok: true, status: 200, message: "Order not found" };
  }

  const order = orders[0] as Order;
  const expectedAmount = Number(order.total_price ?? 0);
  const amountMatched = transferAmount === expectedAmount && expectedAmount > 0;

  if (!amountMatched) {
    await admin.from("transactions").insert(
      payloadToTransaction(body, {
        order_id: order.id,
        order_id_prefix: orderIdPrefix,
        amount_matched: false,
        order_updated: false,
      }),
    );
    return { ok: true, status: 200, message: "Amount mismatch" };
  }

  if (order.payment_status === PAYMENT_STATUS_PAID) {
    await admin.from("transactions").insert(
      payloadToTransaction(body, {
        order_id: order.id,
        order_id_prefix: orderIdPrefix,
        amount_matched: true,
        order_updated: false,
      }),
    );
    return { ok: true, status: 200, message: "Already paid" };
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({
      payment_status: PAYMENT_STATUS_PAID,
      priority: PRIORITY_NORMAL,
    })
    .eq("id", order.id);

  await admin.from("transactions").insert(
    payloadToTransaction(body, {
      order_id: order.id,
      order_id_prefix: orderIdPrefix,
      amount_matched: true,
      order_updated: !updateError,
    }),
  );

  if (updateError) {
    return { ok: false, status: 500, error: updateError.message };
  }

  return { ok: true, status: 200 };
}

