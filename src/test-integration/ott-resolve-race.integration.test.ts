/**
 * P1: OTT resolver race test (one-time signed URL).
 *
 * Goal: prove that 2 concurrent requests using the same OTT token result in:
 * - exactly one successful redirect (302)
 * - the other request fails as "already used" (410) or "invalid/expired" (403)
 *
 * Requires:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SECURE_PDF_TEST_DOCUMENT_ID (a document with a valid private_documents.file_path)
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const documentId = process.env.SECURE_PDF_TEST_DOCUMENT_ID;

const canRun = Boolean(supabaseUrl && serviceRoleKey && documentId);

function buildResolveOttUrl(baseUrl: string, nonce: string): string {
  const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (trimmed.includes(".supabase.co")) {
    // Match how `get-secure-link` computes it in Deno.
    return trimmed.replace(
      ".supabase.co",
      ".supabase.co/functions/v1/resolve-ott"
    ) + `?token=${nonce}`;
  }
  // Local Supabase functions typically live under /functions/v1/.
  return `${trimmed}/functions/v1/resolve-ott?token=${nonce}`;
}

test("P1: resolve-ott atomic one-time behavior under concurrency", { skip: !canRun }, async () => {
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  const nonce = crypto.randomUUID();

  // Pick any existing user_id from profiles to satisfy ott_nonces.user_id FK.
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  assert.ifError(profileErr);
  assert.ok(profileRow?.id, "must find at least one profile row");

  const userId = String(profileRow.id);

  // Resolve documents.file_path for storage_path.
  const { data: docRow, error: docErr } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId!)
    .maybeSingle();
  assert.ifError(docErr);
  assert.ok(docRow?.file_path, "document must have file_path in DB");

  const filePath = String(docRow.file_path);

  const expiresAt = new Date(Date.now() + 30_000).toISOString();

  // Insert ott nonce (used=false).
  const { error: ottInsertErr } = await supabase.from("ott_nonces").insert({
    id: nonce,
    user_id: userId,
    document_id: documentId!,
    storage_path: filePath,
    used: false,
    expires_at: expiresAt,
  });
  assert.ifError(ottInsertErr);

  const resolveOttUrl = buildResolveOttUrl(supabaseUrl!, nonce);

  const req1 = fetch(resolveOttUrl, { method: "GET", redirect: "manual" });
  const req2 = fetch(resolveOttUrl, { method: "GET", redirect: "manual" });

  const [r1, r2] = await Promise.all([req1, req2]);

  const statuses = [r1.status, r2.status].sort();
  const is302 = (r: Response) => r.status === 302 && r.headers.get("location");

  const oneSuccess = (is302(r1) && r2.status !== 302) || (is302(r2) && r1.status !== 302);
  assert.ok(oneSuccess, `expected exactly one 302 redirect, got statuses: ${statuses.join(",")}`);

  // The other request should be a used/failed token.
  const otherStatus = is302(r1) ? r2.status : r1.status;
  assert.ok(otherStatus === 410 || otherStatus === 403, `unexpected other status: ${otherStatus}`);
});

