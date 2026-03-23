// payment-webhook: provider-driven webhook core (auth, idempotency, atomic completion).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveWebhookProvider } from "./providers/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const webhookProvider = resolveWebhookProvider();
  const webhookProviderId = webhookProvider.id;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "x-request-id": requestId } });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", request_id: requestId }, 405, requestId);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookApiKey = webhookProvider.getAuthSecret();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    return jsonResponse({ error: "Server misconfigured", request_id: requestId }, 500, requestId);
  }

  if (!webhookApiKey) {
    console.error(`Webhook API key is missing for provider: ${webhookProviderId}`);
    return jsonResponse({ error: "Webhook is not configured securely", request_id: requestId }, 500, requestId);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let webhookEventId: string | null = null;
  let webhookOrderId: string | null = null;

  try {
    if (!webhookProvider.isAuthorized(req, webhookApiKey)) {
      await logObservability(supabase, {
        requestId,
        source: "edge.payment_webhook",
        eventType: "blocked",
        severity: "warn",
        statusCode: 401,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "invalid_authorization_header" },
      });
      return jsonResponse({ error: "Unauthorized", request_id: requestId }, 401, requestId);
    }

    const rawBody = await req.text();
    const parsedPayload = webhookProvider.parsePayload(rawBody);
    if (!parsedPayload.ok) {
      return jsonResponse({ error: parsedPayload.error, request_id: requestId }, 400, requestId);
    }
    const data = parsedPayload.payload;

    const payloadHash = await sha256Hex(rawBody);
    const orderRefs = webhookProvider.extractOrderReferences(data);
    webhookEventId = webhookProvider.resolveEventId(data, orderRefs, payloadHash);

    // Idempotency guard: process each webhook event at most once.
    const { data: registrationRows, error: registrationError } = await supabase.rpc(
      "register_webhook_event",
      {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_payload_hash: payloadHash,
        p_request_id: requestId,
      }
    );
    if (registrationError) {
      return jsonResponse({ error: "Webhook idempotency registration failed", request_id: requestId }, 500, requestId);
    }
    const registration = Array.isArray(registrationRows) ? registrationRows[0] : registrationRows;
    const shouldProcess = Boolean((registration as { should_process?: boolean } | null)?.should_process);
    const currentStatus = String((registration as { current_status?: string } | null)?.current_status ?? "unknown");

    if (!shouldProcess) {
      if (currentStatus === "hash_mismatch") {
        await logObservability(supabase, {
          requestId,
          source: "edge.payment_webhook",
          eventType: "blocked",
          severity: "error",
          statusCode: 409,
          latencyMs: Date.now() - startedAt,
          metadata: { reason: "idempotency_hash_mismatch", eventId: webhookEventId },
        });
        return jsonResponse({ error: "Webhook payload mismatch for event", request_id: requestId }, 409, requestId);
      }
      await logObservability(supabase, {
        requestId,
        source: "edge.payment_webhook",
        eventType: "duplicate",
        severity: "info",
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
        metadata: { currentStatus, eventId: webhookEventId },
      });
      return jsonResponse({ success: true, code: "00000", msg: "duplicate", request_id: requestId }, 200, requestId);
    }

    if (!webhookProvider.isIncomingTransfer(data)) {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "ignored",
      });
      await logObservability(supabase, {
        requestId,
        source: "edge.payment_webhook",
        eventType: "ignored",
        severity: "info",
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "not_incoming_transfer" },
      });
      return jsonResponse({ success: true, code: "00000", msg: "ignored", request_id: requestId }, 200, requestId);
    }

    const orderLookup = await findOrderByReferences(supabase, orderRefs, webhookProvider.normalizeOrderRef);
    if (orderLookup.kind === "ambiguous") {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "error",
        p_error_message: "ambiguous_order_match",
      });
      await saveRawWebhook(supabase, null, rawBody, "ambiguous_order_match");
      await logObservability(supabase, {
        requestId,
        source: "edge.payment_webhook",
        eventType: "blocked",
        severity: "error",
        statusCode: 409,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "ambiguous_order_match", ref: orderLookup.ref },
      });
      return jsonResponse({ error: "Ambiguous order match", request_id: requestId }, 409, requestId);
    }
    if (orderLookup.kind !== "found") {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "ignored",
        p_error_message: "order_not_found",
      });
      await saveRawWebhook(supabase, null, rawBody, "order_not_found");
      return jsonResponse({ success: true, code: "00000", msg: "ignored", request_id: requestId }, 200, requestId);
    }
    const order = orderLookup.order;
    webhookOrderId = order.id;

    // Replay / duplicate transaction: already completed -> idempotent success
    if (order.status === "completed") {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "processed",
        p_order_id: order.id,
      });
      await logObservability(supabase, {
        requestId,
        source: "edge.payment_webhook",
        eventType: "already_completed",
        severity: "info",
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
        orderId: order.id,
      });
      return jsonResponse({ success: true, code: "00000", msg: "success", request_id: requestId }, 200, requestId);
    }

    const transferAmount = webhookProvider.extractAmount(data);
    const expectedAmount = toVndAmount(order.total_amount);
    if (transferAmount == null || expectedAmount == null || expectedAmount <= 0 || transferAmount !== expectedAmount) {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "error",
        p_order_id: order.id,
        p_error_message: "amount_mismatch",
      });
      await saveRawWebhook(supabase, order.id, rawBody, "amount_mismatch");
      await logObservability(supabase, {
        requestId,
        source: "edge.payment_webhook",
        eventType: "blocked",
        severity: "error",
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        orderId: order.id,
        metadata: { transferAmount, expectedAmount },
      });
      return jsonResponse({ error: "Amount mismatch", request_id: requestId }, 400, requestId);
    }

    // Atomic completion RPC: complete order + grant permissions in one transaction
    const orderId = order.id;
    const externalRef = String(
      orderRefs.find((x) => equalsCaseInsensitive(x, order.external_id)) ??
        webhookProvider.normalizeOrderRef(order.external_id) ??
        order.id
    );
    const webhookPayload = webhookProvider.buildRawWebhookMetadata(rawBody, data);

    const { data: completionRows, error: completionError } = await supabase.rpc(
      "complete_order_and_grant_permissions",
      {
        p_order_id: orderId,
        p_external_ref: externalRef,
        p_raw_webhook: webhookPayload,
      }
    );

    if (completionError) {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "error",
        p_order_id: orderId,
        p_error_message: "atomic_completion_failed",
      });
      await saveRawWebhook(supabase, orderId, rawBody, "atomic_completion_failed");
      throw completionError;
    }

    const completion = Array.isArray(completionRows) ? completionRows[0] : completionRows;
    const grantedCount = Number((completion as { granted_count?: number } | null)?.granted_count ?? 0);
    const alreadyCompleted = Boolean((completion as { already_completed?: boolean } | null)?.already_completed);

    await saveRawWebhook(
      supabase,
      orderId,
      rawBody,
      alreadyCompleted ? "already_completed" : `completed_atomic_${grantedCount}`
    );
    await supabase.rpc("complete_webhook_event", {
      p_provider: webhookProviderId,
      p_event_id: webhookEventId,
      p_status: "processed",
      p_order_id: orderId,
    });
    await logObservability(supabase, {
      requestId,
      source: "edge.payment_webhook",
      eventType: "completed",
      severity: "info",
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      orderId,
      metadata: { grantedCount, alreadyCompleted },
    });
    return jsonResponse({ success: true, code: "00000", msg: "success", request_id: requestId }, 200, requestId);
  } catch (err) {
    console.error("payment-webhook error:", err);
    if (webhookEventId) {
      await supabase.rpc("complete_webhook_event", {
        p_provider: webhookProviderId,
        p_event_id: webhookEventId,
        p_status: "error",
        p_order_id: webhookOrderId,
        p_error_message: err instanceof Error ? err.message.slice(0, 300) : "internal_error",
      });
    }
    await logObservability(supabase, {
      requestId,
      source: "edge.payment_webhook",
      eventType: "error",
      severity: "error",
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      metadata: { error: err instanceof Error ? err.message : "Internal error" },
    });
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal error", request_id: requestId }, 500, requestId);
  }
});

function jsonResponse(body: object, status: number, requestId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(requestId ? { "x-request-id": requestId } : {}) },
  });
}

async function saveRawWebhook(
  supabase: ReturnType<typeof createClient>,
  orderId: string | null,
  rawBody: string,
  note: string
) {
  try {
    await supabase.from("access_logs").insert({
      user_id: null,
      document_id: null,
      action: "payment_webhook",
      status: note,
      metadata: { order_id: orderId, raw_length: rawBody.length },
    });
  } catch (_) {
    // optional log
  }
}

async function logObservability(
  supabase: ReturnType<typeof createClient>,
  params: {
    requestId: string;
    source: string;
    eventType: string;
    severity: "info" | "warn" | "error";
    statusCode: number;
    latencyMs: number;
    orderId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("observability_events").insert({
      request_id: params.requestId,
      source: params.source,
      event_type: params.eventType,
      severity: params.severity,
      order_id: params.orderId ?? null,
      status_code: params.statusCode,
      latency_ms: params.latencyMs,
      metadata: params.metadata ?? {},
    });
  } catch {
    // observability should not break primary flow
  }
}

interface OrderRow {
  id?: string;
  status?: string;
  total_amount?: number;
  external_id?: string | null;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toVndAmount(v: unknown): number | null {
  const n = toNumber(v);
  if (n == null) return null;
  return Math.round(n);
}

function isSafeOrderRef(ref: string): boolean {
  const uuidLike = /^[0-9a-fA-F-]{16,64}$/;
  const externalLike = /^[a-zA-Z0-9._-]{1,120}$/;
  return uuidLike.test(ref) || externalLike.test(ref);
}

async function sha256Hex(message: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  const arr = new Uint8Array(hash);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function findOrderByReferences(
  supabase: ReturnType<typeof createClient>,
  refs: string[],
  normalizeOrderRef: (value: string | null | undefined) => string | null
): Promise<
  | { kind: "found"; order: { id: string; status: string; total_amount: number; external_id: string | null } }
  | { kind: "none" }
  | { kind: "ambiguous"; ref: string }
> {
  const candidates = new Map<string, { id: string; status: string; total_amount: number; external_id: string | null }>();

  for (const ref of refs) {
    if (!isSafeOrderRef(ref)) continue;

    if (/^[0-9a-fA-F-]{16,64}$/.test(ref)) {
      const { data: byId, error: byIdErr } = await supabase
        .from("orders")
        .select("id, status, total_amount, external_id")
        .eq("id", ref)
        .maybeSingle();
      if (!byIdErr && byId) {
        candidates.set(String(byId.id), {
          id: String(byId.id),
          status: String(byId.status ?? "pending"),
          total_amount: Number(byId.total_amount ?? 0),
          external_id: (byId.external_id as string | null | undefined) ?? null,
        });
      }
    }

    const normalizedRef = normalizeOrderRef(ref);
    if (normalizedRef) {
      const { data: byExternal, error: byExternalErr } = await supabase
        .from("orders")
        .select("id, status, total_amount, external_id")
        .ilike("external_id", normalizedRef)
        .limit(2);

      if (!byExternalErr && byExternal?.length) {
        if (byExternal.length > 1) return { kind: "ambiguous", ref: normalizedRef };
        const one = byExternal[0] as OrderRow;
        candidates.set(String(one.id), {
          id: String(one.id),
          status: String(one.status ?? "pending"),
          total_amount: Number(one.total_amount ?? 0),
          external_id: (one.external_id as string | null | undefined) ?? null,
        });
      }
    }
  }

  if (candidates.size > 1) {
    return { kind: "ambiguous", ref: refs.join(",") };
  }
  if (candidates.size === 1) {
    const only = Array.from(candidates.values())[0];
    return { kind: "found", order: only };
  }

  // Backward fallback for short D2S token: match first 8 chars of UUID id.
  const token = refs.find((x) => /^D2S-[A-Z0-9]{6,16}$/.test(x));
  if (!token) return { kind: "none" };
  const shortId = token.slice(4).toLowerCase();
  if (!/^[a-z0-9]{6,16}$/.test(shortId)) return { kind: "none" };
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_amount, external_id")
    .ilike("id", `${shortId}%`)
    .limit(3);
  if (error || !data?.length) return { kind: "none" };
  if (data.length > 1) return { kind: "ambiguous", ref: token };

  const first = data[0] as OrderRow;
  return {
    kind: "found",
    order: {
      id: String(first.id),
      status: String(first.status ?? "pending"),
      total_amount: Number(first.total_amount ?? 0),
      external_id: (first.external_id as string | null | undefined) ?? null,
    },
  };
}

function equalsCaseInsensitive(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}
