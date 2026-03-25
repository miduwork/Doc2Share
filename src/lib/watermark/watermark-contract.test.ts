import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildDegradedWatermarkDisplayPayload,
  hashDocumentShort,
  toIssuedAtBucket,
  toIssuedAtBucketLabel,
} from "@/lib/watermark/watermark-contract";

test("toIssuedAtBucket rounds to minute bucket", () => {
  const bucket = toIssuedAtBucket(new Date("2026-03-24T10:11:59.999Z"));
  assert.equal(bucket, "2026-03-24T10:11:00Z");
});

test("toIssuedAtBucketLabel returns HH:mm", () => {
  assert.equal(toIssuedAtBucketLabel("2026-03-24T10:11:00Z"), "10:11");
});

test("hashDocumentShort is deterministic and 6-8 chars", () => {
  const a = hashDocumentShort("29aa0e80-905a-49f7-ac82-f2f1d8c00635", 8);
  const b = hashDocumentShort("29aa0e80-905a-49f7-ac82-f2f1d8c00635", 8);
  const c = hashDocumentShort("f8d6f2d9-f790-45ba-8688-6a2059a0fbd4", 8);

  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 8);
  assert.match(a, /^[A-Z2-9]+$/);
});

test("buildDegradedWatermarkDisplayPayload is deterministic for same minute", () => {
  const now = new Date("2026-03-24T10:11:59.999Z");
  const a = buildDegradedWatermarkDisplayPayload({
    documentId: "29aa0e80-905a-49f7-ac82-f2f1d8c00635",
    deviceId: "dev-001",
    now,
  });
  const b = buildDegradedWatermarkDisplayPayload({
    documentId: "29aa0e80-905a-49f7-ac82-f2f1d8c00635",
    deviceId: "dev-001",
    now,
  });
  assert.deepEqual(a, b);
  assert.match(a.wmShort, /^[A-Z2-7]{8}$/);
});
