import { test } from "node:test";
import { strict as assert } from "node:assert";

const baseUrl = process.env.SECURE_PDF_TEST_BASE_URL;
const cookie = process.env.SECURE_PDF_TEST_COOKIE;
const documentId = process.env.SECURE_PDF_TEST_DOCUMENT_ID;
const deviceId = process.env.SECURE_PDF_TEST_DEVICE_ID;

const canRun = Boolean(baseUrl && cookie && documentId && deviceId);

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

  assert.equal(res.status, 200, `unexpected status: ${res.status}`);
  assert.equal(res.headers.get("content-type"), "application/pdf");

  const wmShort = res.headers.get("x-d2s-wm-short");
  const wmDocShort = res.headers.get("x-d2s-wm-doc-short");
  const wmIssuedAtBucket = res.headers.get("x-d2s-wm-issued-at-bucket");
  const wmVersion = res.headers.get("x-d2s-wm-version");

  assert.match(wmShort ?? "", /^[A-Z2-7]{8}$/);
  assert.match(wmDocShort ?? "", /^[A-Z2-9]{8}$/);
  assert.match(wmIssuedAtBucket ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
  assert.equal(wmVersion, "v1");
});
