import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveQuickPreviewVariant } from "./quick-preview-experiment.ts";

test("uses query param when provided", () => {
  const variant = resolveQuickPreviewVariant({ qpVariantParam: "B", cookieVariant: "A" });
  assert.equal(variant, "B");
});

test("falls back to cookie when query missing", () => {
  const variant = resolveQuickPreviewVariant({ cookieVariant: "B" });
  assert.equal(variant, "B");
});

test("defaults to A when no valid source", () => {
  const variant = resolveQuickPreviewVariant({ qpVariantParam: "invalid", cookieVariant: null });
  assert.equal(variant, "A");
});
