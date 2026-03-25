import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildWatermarkGrid, getAdaptiveWatermarkPaint } from "@/lib/watermark/watermark-overlay";

const sampleWatermark = {
  wmShort: "A7K9M2QX",
  wmDocShort: "DOC89K2A",
  wmIssuedAtBucket: "2026-03-24T10:11:00Z",
  wmVersion: "v1" as const,
};

test("buildWatermarkGrid is deterministic", () => {
  const first = buildWatermarkGrid(sampleWatermark, 10);
  const second = buildWatermarkGrid(sampleWatermark, 10);
  assert.deepEqual(first, second);
  assert.equal(first.length, 10);
});

test("buildWatermarkGrid varies when token changes", () => {
  const a = buildWatermarkGrid(sampleWatermark, 10);
  const b = buildWatermarkGrid({ ...sampleWatermark, wmShort: "Z9X8W7V6" }, 10);
  assert.notDeepEqual(a, b);
});

test("getAdaptiveWatermarkPaint chooses contrast by luma", () => {
  assert.equal(getAdaptiveWatermarkPaint(0.9).color, "#0f172a");
  assert.equal(getAdaptiveWatermarkPaint(0.2).color, "#e2e8f0");
});
