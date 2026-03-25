import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildAccessLogMetadata } from "@/lib/access-log";

test("buildAccessLogMetadata includes watermark forensic fields", () => {
  const metadata = buildAccessLogMetadata({
    userId: "u1",
    documentId: "d1",
    status: "success",
    ipAddress: "127.0.0.1",
    requestId: "req-1",
    correlationId: "corr-1",
    latencyMs: 123,
    watermark: {
      wmId: "8a9b1f6e11f0cb8f5a8e8dcf03f5d7d2",
      wmShort: "A7K9M2QX",
      wmDocShort: "DOC8K2QX",
      wmIssuedAtBucket: "2026-03-24T10:11:00Z",
      wmVersion: "v1",
    },
  });

  assert.equal(metadata.wm_id, "8a9b1f6e11f0cb8f5a8e8dcf03f5d7d2");
  assert.equal(metadata.wm_short, "A7K9M2QX");
  assert.equal(metadata.wm_doc_short, "DOC8K2QX");
  assert.equal(metadata.wm_issued_at_bucket, "2026-03-24T10:11:00Z");
  assert.equal(metadata.wm_version, "v1");
});
