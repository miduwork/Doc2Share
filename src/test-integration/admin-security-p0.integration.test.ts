import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const superEmail = process.env.TEST_SUPER_ADMIN_EMAIL;
const superPassword = process.env.TEST_SUPER_ADMIN_PASSWORD;
const supportEmail = process.env.TEST_SUPPORT_AGENT_EMAIL;
const supportPassword = process.env.TEST_SUPPORT_AGENT_PASSWORD;

const canRun = Boolean(
  url && anonKey && serviceRoleKey && superEmail && superPassword && supportEmail && supportPassword
);

async function signIn(email: string, password: string) {
  const client = createClient(url!, anonKey!);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("signIn failed: missing user");
  return { client, userId: user.id };
}

test("P0: temporary ban semantics uses banned_until window", { skip: !canRun }, async () => {
  const service = createClient(url!, serviceRoleKey!);
  const { userId: targetUserId } = await signIn(supportEmail!, supportPassword!);

  const bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: setError } = await service
    .from("profiles")
    .update({ is_active: true, banned_until: bannedUntil })
    .eq("id", targetUserId);
  assert.ifError(setError);

  const { data: row, error: readError } = await service
    .from("profiles")
    .select("is_active, banned_until")
    .eq("id", targetUserId)
    .single();
  assert.ifError(readError);
  assert.equal(row.is_active, true);
  assert.equal(typeof row.banned_until, "string");
  assert.ok(new Date(row.banned_until as string).getTime() > Date.now());

  const { error: cleanupError } = await service
    .from("profiles")
    .update({ banned_until: new Date(Date.now() - 1000).toISOString(), is_active: true })
    .eq("id", targetUserId);
  assert.ifError(cleanupError);
});

test("P0: panic_user_atomic rolls back on simulated failure", { skip: !canRun }, async () => {
  const service = createClient(url!, serviceRoleKey!);
  const { client: superClient, userId: actorId } = await signIn(superEmail!, superPassword!);
  const { userId: targetUserId } = await signIn(supportEmail!, supportPassword!);

  const deviceId = `panic-test-device-${Date.now()}`;
  const sessionId = `panic-test-session-${Date.now()}`;
  const reason = `panic-rollback-${Date.now()}`;

  const { error: setupDeviceError } = await service.from("device_logs").upsert(
    {
      user_id: targetUserId,
      device_id: deviceId,
      device_info: {},
      last_login: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" }
  );
  assert.ifError(setupDeviceError);

  const { error: setupSessionError } = await service.from("active_sessions").upsert({
    session_id: sessionId,
    user_id: targetUserId,
    device_id: deviceId,
    created_at: new Date().toISOString(),
  });
  assert.ifError(setupSessionError);

  const { error: panicError } = await superClient.rpc("panic_user_atomic", {
    p_user_id: targetUserId,
    p_actor_id: actorId,
    p_reason: reason,
    p_metadata: { simulate_error: true },
  });
  assert.ok(panicError, "panic_user_atomic should fail when simulate_error=true");

  const [{ data: profile }, { data: sessions }, { data: devices }, { data: audits }] = await Promise.all([
    service.from("profiles").select("is_active").eq("id", targetUserId).single(),
    service.from("active_sessions").select("session_id").eq("session_id", sessionId),
    service.from("device_logs").select("id").eq("user_id", targetUserId).eq("device_id", deviceId),
    service
      .from("admin_security_actions")
      .select("id")
      .eq("action_type", "panic")
      .eq("target_user_id", targetUserId)
      .eq("reason", reason),
  ]);

  assert.equal(profile?.is_active, true, "profile update must roll back");
  assert.equal((sessions ?? []).length, 1, "session delete must roll back");
  assert.equal((devices ?? []).length, 1, "device delete must roll back");
  assert.equal((audits ?? []).length, 0, "audit insert must roll back");

  await service.from("active_sessions").delete().eq("session_id", sessionId);
  await service.from("device_logs").delete().eq("user_id", targetUserId).eq("device_id", deviceId);
});

test("P0: panic_user_atomic writes audit on success", { skip: !canRun }, async () => {
  const service = createClient(url!, serviceRoleKey!);
  const { client: superClient, userId: actorId } = await signIn(superEmail!, superPassword!);
  const { userId: targetUserId } = await signIn(supportEmail!, supportPassword!);

  const reason = `panic-success-${Date.now()}`;
  await service.from("profiles").update({ is_active: true, banned_until: null }).eq("id", targetUserId);

  const { error: panicError } = await superClient.rpc("panic_user_atomic", {
    p_user_id: targetUserId,
    p_actor_id: actorId,
    p_reason: reason,
    p_metadata: { source: "integration_test" },
  });
  assert.ifError(panicError);

  const { data: auditRows, error: auditError } = await service
    .from("admin_security_actions")
    .select("id, action_type, target_user_id, actor_user_id, reason")
    .eq("action_type", "panic")
    .eq("target_user_id", targetUserId)
    .eq("actor_user_id", actorId)
    .eq("reason", reason);
  assert.ifError(auditError);
  assert.equal((auditRows ?? []).length, 1);

  await service.from("profiles").update({ is_active: true }).eq("id", targetUserId);
});
