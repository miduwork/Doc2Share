/**
 * Integration: register_webhook_event idempotency.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (e.g. Supabase local).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceRoleKey);

test("idempotency: first call should_process true, second duplicate", { skip: !canRun }, async () => {
  const supabase = createClient(url!, serviceRoleKey!);
  const eventId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const hash = "h-" + eventId;

  const { data: r1, error: e1 } = await supabase.rpc("register_webhook_event", {
    p_provider: "sepay",
    p_event_id: eventId,
    p_payload_hash: hash,
    p_request_id: "r1",
  });
  assert.ifError(e1);
  const row1 = Array.isArray(r1) ? r1[0] : r1;
  assert.equal((row1 as { should_process?: boolean })?.should_process, true);

  const { data: r2, error: e2 } = await supabase.rpc("register_webhook_event", {
    p_provider: "sepay",
    p_event_id: eventId,
    p_payload_hash: hash,
    p_request_id: "r2",
  });
  assert.ifError(e2);
  const row2 = Array.isArray(r2) ? r2[0] : r2;
  assert.equal((row2 as { should_process?: boolean })?.should_process, false);
});

test("idempotency: same event_id different hash returns hash_mismatch", { skip: !canRun }, async () => {
  const supabase = createClient(url!, serviceRoleKey!);
  const eventId = `test-mm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await supabase.rpc("register_webhook_event", {
    p_provider: "sepay",
    p_event_id: eventId,
    p_payload_hash: "hash-a",
    p_request_id: "r1",
  });

  const { data: r2, error: e2 } = await supabase.rpc("register_webhook_event", {
    p_provider: "sepay",
    p_event_id: eventId,
    p_payload_hash: "hash-b",
    p_request_id: "r2",
  });
  assert.ifError(e2);
  const row2 = Array.isArray(r2) ? r2[0] : r2;
  assert.equal((row2 as { should_process?: boolean })?.should_process, false);
  assert.equal((row2 as { current_status?: string })?.current_status, "hash_mismatch");
});
