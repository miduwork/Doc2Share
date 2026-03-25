import { test } from "node:test";
import { strict as assert } from "node:assert";
import { issueWatermark } from "@/lib/watermark/watermark-issuer";

test("issueWatermark creates expected v1 token fields", () => {
  const wm = issueWatermark("29aa0e80-905a-49f7-ac82-f2f1d8c00635", new Date("2026-03-24T10:11:59.999Z"));

  assert.equal(wm.wmVersion, "v1");
  assert.match(wm.wmId, /^[a-f0-9]{32}$/);
  assert.match(wm.wmShort, /^[A-Z2-7]{8}$/);
  assert.equal(wm.wmIssuedAtBucket, "2026-03-24T10:11:00Z");
  assert.equal(wm.wmDocShort.length, 8);
});
