/**
 * Integration test: RLS least-privilege (super_admin can read webhook_events/security_logs;
 * support_agent cannot). Requires Supabase local with migrations applied and two test users
 * with profiles.role = 'admin', profiles.admin_role = 'super_admin' | 'support_agent'.
 *
 * Set SUPABASE_URL, SUPABASE_ANON_KEY, TEST_SUPER_ADMIN_EMAIL, TEST_SUPER_ADMIN_PASSWORD,
 * TEST_SUPPORT_AGENT_EMAIL, TEST_SUPPORT_AGENT_PASSWORD to run.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const superEmail = process.env.TEST_SUPER_ADMIN_EMAIL;
const superPassword = process.env.TEST_SUPER_ADMIN_PASSWORD;
const supportEmail = process.env.TEST_SUPPORT_AGENT_EMAIL;
const supportPassword = process.env.TEST_SUPPORT_AGENT_PASSWORD;

const canRun = Boolean(url && anonKey && superEmail && superPassword && supportEmail && supportPassword);

async function signIn(email: string, password: string) {
  const supabase = createClient(url!, anonKey!);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return supabase;
}

test("RLS: super_admin can SELECT from webhook_events", { skip: !canRun }, async () => {
  const client = await signIn(superEmail!, superPassword!);
  const { data: _data, error } = await client.from("webhook_events").select("id").limit(1);
  assert.ifError(error);
  assert.ok(Array.isArray(_data), "super_admin should get array (may be empty)");
});

test("RLS: support_agent gets no rows from webhook_events (policy denies)", { skip: !canRun }, async () => {
  const client = await signIn(supportEmail!, supportPassword!);
  const { data, error } = await client.from("webhook_events").select("id");
  assert.ifError(error);
  assert.equal(Array.isArray(data) ? data.length : 0, 0, "support_agent should see 0 rows");
});

test("RLS: super_admin can SELECT from security_logs", { skip: !canRun }, async () => {
  const client = await signIn(superEmail!, superPassword!);
  const { data, error } = await client.from("security_logs").select("id").limit(1);
  assert.ifError(error);
  assert.ok(Array.isArray(data), "super_admin should get array (may be empty)");
});

test("RLS: support_agent gets no rows from security_logs", { skip: !canRun }, async () => {
  const client = await signIn(supportEmail!, supportPassword!);
  const { data, error } = await client.from("security_logs").select("id");
  assert.ifError(error);
  assert.equal(Array.isArray(data) ? data.length : 0, 0, "support_agent should see 0 rows");
});

test("RLS: support_agent can SELECT from profiles (user manager)", { skip: !canRun }, async () => {
  const client = await signIn(supportEmail!, supportPassword!);
  const { data, error } = await client.from("profiles").select("id").limit(5);
  assert.ifError(error);
  assert.ok(Array.isArray(data), "support_agent should see profiles");
});
