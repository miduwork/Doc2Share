import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.SECURE_PDF_TEST_BASE_URL;
const cookie = process.env.SECURE_PDF_TEST_COOKIE;
const documentId = process.env.SECURE_PDF_TEST_DOCUMENT_ID;
const deviceId = process.env.SECURE_PDF_TEST_DEVICE_ID;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunDb = Boolean(supabaseUrl && serviceRoleKey);

const canRun = Boolean(baseUrl && cookie && documentId && deviceId);

async function waitForAccessLogsCount(params: {
  correlationId: string;
  maxAttempts: number;
  expected: number;
  supabase: ReturnType<typeof createClient>;
}) {
  for (let i = 0; i < params.maxAttempts; i += 1) {
    const { data, error } = await params.supabase
      .from("access_logs")
      .select("id")
      .eq("correlation_id", params.correlationId)
      .eq("action", "secure_pdf")
      .eq("status", "success");

    assert.ifError(error);
    const count = (data ?? []).length;
    if (count === params.expected) return count;
    await new Promise((r) => setTimeout(r, 200));
  }

  return null;
}

test("secure-pdf returns watermark tracing headers (e2e route check)", { skip: !canRun }, async () => {
  const res = await fetch(`${baseUrl}/api/secure-pdf`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookie!,
    },
    body: JSON.stringify({
      document_id: documentId,
      device_id: deviceId,
    }),
  });

  // P0: secure-pdf never returns vector PDF; it forces SSW (image mode).
  assert.equal(res.status, 403, `unexpected status: ${res.status}`);

  const requestId = res.headers.get("x-d2s-request-id");
  assert.ok(requestId, "secure-pdf must return X-D2S-Request-ID");

  const isHighValueHeader = res.headers.get("x-d2s-is-high-value");
  assert.equal(isHighValueHeader, "true");

  const wmShort = res.headers.get("x-d2s-wm-short");
  assert.match(wmShort ?? "", /^[A-Z2-7]{8}$/);

  // Then load page image in SSW mode.
  const imgRes = await fetch(`${baseUrl}/api/secure-document-image`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookie!,
    },
    body: JSON.stringify({
      document_id: documentId,
      device_id: deviceId,
      page: 1,
      secure_pdf_request_id: requestId,
    }),
  });

  assert.equal(imgRes.status, 200, `unexpected image status: ${imgRes.status}`);
  assert.equal(imgRes.headers.get("content-type"), "image/png");

  const imgRequestId = imgRes.headers.get("x-d2s-request-id");
  assert.ok(imgRequestId, "secure-document-image must return X-D2S-Request-ID");

  const imgWmShort = imgRes.headers.get("x-d2s-wm-short");
  const forensic = imgRes.headers.get("x-d2s-forensic");

  assert.match(imgWmShort ?? "", /^[A-Z2-7]{8}$/);
  assert.match(forensic ?? "", /^D2S:/);

  // P1: image mode must not double-count secure_pdf success.
  if (canRunDb) {
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    // 1) secure-pdf open doc => exactly 1 success row for its requestId
    const securePdfCount = await waitForAccessLogsCount({
      correlationId: requestId,
      maxAttempts: 5,
      expected: 1,
      supabase,
    });
    assert.equal(securePdfCount, 1, "secure-pdf should insert access_logs success exactly once");

    // 2) secure-document-image page render should not create any secure_pdf success row
    const { data, error } = await supabase
      .from("access_logs")
      .select("id")
      .eq("correlation_id", imgRequestId)
      .eq("action", "secure_pdf")
      .eq("status", "success");
    assert.ifError(error);
    assert.equal((data ?? []).length, 0, "secure-document-image must not double-count secure_pdf success");
  }
});
