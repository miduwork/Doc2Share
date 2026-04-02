import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

const baseUrl = process.env.SECURE_PDF_TEST_BASE_URL;
const webhookApiKey = process.env.WEBHOOK_SEPAY_API_KEY;

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const documentId = process.env.SECURE_PDF_TEST_DOCUMENT_ID;

const superEmail = process.env.TEST_SUPER_ADMIN_EMAIL;
const superPassword = process.env.TEST_SUPER_ADMIN_PASSWORD;

const canRun = Boolean(
  baseUrl &&
    webhookApiKey &&
    supabaseUrl &&
    anonKey &&
    serviceRoleKey &&
    documentId &&
    superEmail &&
    superPassword
);

async function signInAsTestUser() {
  const client = createClient(supabaseUrl!, anonKey!);
  const { error } = await client.auth.signInWithPassword({
    email: superEmail!,
    password: superPassword!,
  });
  if (error) throw error;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("signIn failed: missing user");

  return { client, userId: user.id };
}

function toUpperHexPrefix(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function buildSePayPayload({
  transferAmount,
  referenceCode,
}: {
  transferAmount: number;
  referenceCode: string;
}) {
  // Matching logic in handler:
  // - `referenceCode` is used to build refs and also to compute event_id.
  // - `content` is used for extra refs (IN AN ... regex).
  return {
    gateway: "sepay-test",
    transferType: "in",
    transferAmount,
    content: `IN AN ${referenceCode}`,
    referenceCode,
  };
}

test("SePay webhook route-level: happy path + amount mismatch + replay", { skip: !canRun }, async () => {
  const supabaseService = createClient(supabaseUrl!, serviceRoleKey!);
  const { client: supabaseAuthed, userId } = await signInAsTestUser();

  const safeBaseUrl = stripTrailingSlash(baseUrl!);

  // 1) Seed two orders so we can test amount mismatch separately.
  const seedOrder = async () => {
    const { data, error } = await supabaseAuthed.rpc("create_checkout_order", {
      p_document_id: documentId!,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      orderId: String((row as any).order_id ?? ""),
      totalAmount: Number((row as any).total_amount ?? 0),
    };
  };

  const orderOk = await seedOrder();
  const orderMismatch = await seedOrder();

  assert.ok(orderOk.orderId, "orderOk.orderId must exist");
  assert.ok(orderMismatch.orderId, "orderMismatch.orderId must exist");

  // 2) HAPPY PATH
  const okPrefix = toUpperHexPrefix(orderOk.orderId);
  const okPayload = buildSePayPayload({
    transferAmount: orderOk.totalAmount,
    referenceCode: okPrefix,
  });

  const eventIdOk = `sepay_ref:${okPrefix}`;

  const r1 = await fetch(`${safeBaseUrl}/api/webhook/sepay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Apikey ${webhookApiKey}`,
    },
    body: JSON.stringify(okPayload),
  });
  assert.equal(r1.status, 200, `expected 200, got ${r1.status}`);

  // DB contract assertions
  const { data: webhookOkRow, error: webhookOkErr } = await supabaseService
    .from("webhook_events")
    .select("status,error_message")
    .eq("provider", "sepay")
    .eq("event_id", eventIdOk)
    .maybeSingle();
  assert.ifError(webhookOkErr);
  assert.equal(webhookOkRow?.status, "processed");
  assert.equal(webhookOkRow?.error_message, null);

  const { data: permOkRows, error: permOkErr } = await supabaseService
    .from("permissions")
    .select("granted_at")
    .eq("user_id", userId)
    .eq("document_id", documentId!)
    .maybeSingle();
  assert.ifError(permOkErr);
  assert.ok(permOkRows?.granted_at, "permissions row should exist");
  const grantedAt1 = String(permOkRows?.granted_at);

  const { data: orderOkRow, error: orderOkErr } = await supabaseService
    .from("orders")
    .select("status")
    .eq("id", orderOk.orderId)
    .maybeSingle();
  assert.ifError(orderOkErr);
  assert.equal(orderOkRow?.status, "completed");

  // 3) REPLAY (same payload => should_processing=false => HTTP 200, no extra grant)
  const r2 = await fetch(`${safeBaseUrl}/api/webhook/sepay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Apikey ${webhookApiKey}`,
    },
    body: JSON.stringify(okPayload),
  });
  assert.equal(r2.status, 200, `expected replay 200, got ${r2.status}`);

  const { data: webhookOkRow2, error: webhookOkErr2 } = await supabaseService
    .from("webhook_events")
    .select("status,error_message")
    .eq("provider", "sepay")
    .eq("event_id", eventIdOk)
    .maybeSingle();
  assert.ifError(webhookOkErr2);
  assert.equal(webhookOkRow2?.status, "processed");
  assert.equal(webhookOkRow2?.error_message, null);

  const { data: permOkRows2, error: permOkErr2 } = await supabaseService
    .from("permissions")
    .select("granted_at")
    .eq("user_id", userId)
    .eq("document_id", documentId!)
    .maybeSingle();
  assert.ifError(permOkErr2);
  const grantedAt2 = String(permOkRows2?.granted_at);
  assert.equal(grantedAt2, grantedAt1, "replay should not change granted_at");

  // 4) AMOUNT MISMATCH (must return 400 + webhook_events.error.amount_mismatch)
  const mismatchPrefix = toUpperHexPrefix(orderMismatch.orderId);
  const mismatchPayload = buildSePayPayload({
    transferAmount: orderMismatch.totalAmount + 1,
    referenceCode: mismatchPrefix,
  });
  const eventIdMismatch = `sepay_ref:${mismatchPrefix}`;

  const r3 = await fetch(`${safeBaseUrl}/api/webhook/sepay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Apikey ${webhookApiKey}`,
    },
    body: JSON.stringify(mismatchPayload),
  });
  assert.equal(r3.status, 400, `expected 400 for amount mismatch, got ${r3.status}`);

  const { data: webhookMismatchRow, error: webhookMismatchErr } = await supabaseService
    .from("webhook_events")
    .select("status,error_message")
    .eq("provider", "sepay")
    .eq("event_id", eventIdMismatch)
    .maybeSingle();
  assert.ifError(webhookMismatchErr);
  assert.equal(webhookMismatchRow?.status, "error");
  assert.equal(webhookMismatchRow?.error_message, "amount_mismatch");

  const { data: orderMismatchRow, error: orderMismatchErr } = await supabaseService
    .from("orders")
    .select("status")
    .eq("id", orderMismatch.orderId)
    .maybeSingle();
  assert.ifError(orderMismatchErr);
  assert.notEqual(orderMismatchRow?.status, "completed");

  const { data: permMismatchRow, error: permMismatchErr } = await supabaseService
    .from("permissions")
    .select("granted_at")
    .eq("user_id", userId)
    .eq("document_id", documentId!)
    .maybeSingle();
  assert.ifError(permMismatchErr);
  // Mismatch should not "complete" the order, so it must not grant/update permissions.
  const grantedAtMismatch = permMismatchRow ? String(permMismatchRow.granted_at) : null;
  assert.equal(grantedAtMismatch, grantedAt2, "amount mismatch should not change granted_at");
});

