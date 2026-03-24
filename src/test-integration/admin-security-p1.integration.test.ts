import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceRoleKey);

test("P1: correlation_id links security/access/admin actions", { skip: !canRun }, async () => {
  const supabase = createClient(url!, serviceRoleKey!);
  const correlationId = `corr-${Date.now()}`;

  const [{ error: accessErr }, { error: securityErr }, { error: adminErr }] = await Promise.all([
    supabase.from("access_logs").insert({
      action: "secure_pdf",
      status: "blocked",
      correlation_id: correlationId,
      metadata: { correlation_id: correlationId },
    }),
    supabase.from("security_logs").insert({
      event_type: "file_access",
      severity: "medium",
      correlation_id: correlationId,
      metadata: { correlation_id: correlationId },
    }),
    supabase.from("admin_security_actions").insert({
      action_type: "revoke",
      correlation_id: correlationId,
      metadata: { correlation_id: correlationId },
    }),
  ]);
  assert.ifError(accessErr);
  assert.ifError(securityErr);
  assert.ifError(adminErr);

  const [{ data: accessRows }, { data: securityRows }, { data: adminRows }] = await Promise.all([
    supabase.from("access_logs").select("id").eq("correlation_id", correlationId),
    supabase.from("security_logs").select("id").eq("correlation_id", correlationId),
    supabase.from("admin_security_actions").select("id").eq("correlation_id", correlationId),
  ]);

  assert.equal((accessRows ?? []).length, 1);
  assert.equal((securityRows ?? []).length, 1);
  assert.equal((adminRows ?? []).length, 1);
});
