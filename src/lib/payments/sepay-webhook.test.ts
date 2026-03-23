import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  parsePayload,
  extractOrderReferences,
  resolveEventId,
  normalizeOrderRef,
  isIncomingTransfer,
  extractAmount,
  type SePayPayload,
} from "./sepay-webhook.ts";

test("parsePayload returns ok with valid JSON", () => {
  const body = JSON.stringify({ transferType: "in", transferAmount: 100000, referenceCode: "VQR-abc123" });
  const result = parsePayload(body);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.transferType, "in");
    assert.equal(result.payload.transferAmount, 100000);
    assert.equal(result.payload.referenceCode, "VQR-abc123");
  }
});

test("parsePayload returns error for invalid JSON", () => {
  const result = parsePayload("not json {");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Invalid JSON body");
});

test("extractOrderReferences collects referenceCode, VQR-, D2S-, UUID", () => {
  const payload: SePayPayload = {
    referenceCode: "VQR-XY123456",
    content: "Thanh toan D2S-abc12345 va uuid 550e8400-e29b-41d4-a716-446655440000",
  };
  const refs = extractOrderReferences(payload);
  assert.ok(refs.includes("VQR-XY123456"));
  assert.ok(refs.some((r) => r.startsWith("D2S-")));
  assert.ok(refs.includes("550e8400-e29b-41d4-a716-446655440000"));
});

test("extractOrderReferences normalizes VQR/D2S to uppercase", () => {
  const payload: SePayPayload = { referenceCode: "vqr-low123", description: "d2s-xyz12345" };
  const refs = extractOrderReferences(payload);
  assert.ok(refs.some((r) => r === "VQR-LOW123"));
  assert.ok(refs.some((r) => r === "D2S-XYZ12345"));
});

test("extractOrderReferences recognizes app-user-order format D2S-XXXX-YYYY", () => {
  const payload: SePayPayload = {
    content: "Chuyen khoan D2S-A1B2-C3D4E5F6 thanh toan tai lieu",
    description: "D2S-A1B2-C3D4E5F6",
  };
  const refs = extractOrderReferences(payload);
  assert.ok(refs.includes("D2S-A1B2-C3D4E5F6"), "refs should include full D2S-XXXX-YYYY: " + JSON.stringify(refs));
});

test("resolveEventId uses payload.id when present", () => {
  const payload: SePayPayload = { id: 999 };
  assert.equal(resolveEventId(payload, [], "a".repeat(64)), "sepay:999");
});

test("resolveEventId uses referenceCode when no id", () => {
  const payload: SePayPayload = { referenceCode: "VQR-ORDER1" };
  assert.equal(resolveEventId(payload, ["VQR-ORDER1"], "a".repeat(64)), "sepay_ref:VQR-ORDER1");
});

test("resolveEventId falls back to refs[0] and hash when no id/ref", () => {
  const payload: SePayPayload = {};
  assert.equal(
    resolveEventId(payload, ["VQR-FALL"], "deadbeef1234567890"),
    "fallback_ref:VQR-FALL:deadbeef12345678"
  );
});

test("resolveEventId falls back to hash only when no refs", () => {
  const payload: SePayPayload = {};
  assert.equal(
    resolveEventId(payload, [], "deadbeef1234567890abcdef"),
    "fallback_hash:deadbeef1234567890abcdef"
  );
});

test("normalizeOrderRef returns null for empty", () => {
  assert.equal(normalizeOrderRef(""), null);
  assert.equal(normalizeOrderRef(null), null);
  assert.equal(normalizeOrderRef("   "), null);
});

test("isIncomingTransfer true for transferType in", () => {
  assert.equal(isIncomingTransfer({ transferType: "in" }), true);
  assert.equal(isIncomingTransfer({ transferType: "IN" }), true);
});

test("isIncomingTransfer false for out or missing", () => {
  assert.equal(isIncomingTransfer({ transferType: "out" }), false);
  assert.equal(isIncomingTransfer({}), false);
});

test("extractAmount returns VND number", () => {
  assert.equal(extractAmount({ transferAmount: 100000 }), 100000);
  assert.equal(extractAmount({ transferAmount: 99.5 }), 100);
});

test("extractAmount returns null for missing or invalid", () => {
  assert.equal(extractAmount({}), null);
  assert.equal(extractAmount({ transferAmount: "x" } as SePayPayload), null);
});
