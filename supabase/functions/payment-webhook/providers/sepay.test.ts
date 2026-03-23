// SePay webhook provider: parse payload, order refs, event id, amount, transfer type.
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { sepayWebhookProvider, type SePayPayload } from "./sepay.ts";

Deno.test("parsePayload returns ok with valid JSON", () => {
  const body = JSON.stringify({ transferType: "in", transferAmount: 100000, referenceCode: "VQR-abc123" });
  const result = sepayWebhookProvider.parsePayload(body);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.payload.transferType, "in");
    assertEquals(result.payload.transferAmount, 100000);
    assertEquals(result.payload.referenceCode, "VQR-abc123");
  }
});

Deno.test("parsePayload returns error for invalid JSON", () => {
  const result = sepayWebhookProvider.parsePayload("not json {");
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.error, "Invalid JSON body");
});

Deno.test("extractOrderReferences collects referenceCode, VQR-, D2S-, UUID", () => {
  const payload: SePayPayload = {
    referenceCode: "VQR-XY123456",
    content: "Thanh toan D2S-abc12345 va uuid 550e8400-e29b-41d4-a716-446655440000",
  };
  const refs = sepayWebhookProvider.extractOrderReferences(payload);
  assertEquals(refs.includes("VQR-XY123456"), true);
  assertEquals(refs.some((r) => r.startsWith("D2S-")), true);
  assertEquals(refs.includes("550e8400-e29b-41d4-a716-446655440000"), true);
});

Deno.test("extractOrderReferences normalizes VQR/D2S to uppercase", () => {
  const payload: SePayPayload = { referenceCode: "vqr-low123", description: "d2s-xyz12345" };
  const refs = sepayWebhookProvider.extractOrderReferences(payload);
  assertEquals(refs.some((r) => r === "VQR-LOW123"), true);
  assertEquals(refs.some((r) => r === "D2S-XYZ12345"), true);
});

Deno.test("resolveEventId uses payload.id when present", () => {
  const payload: SePayPayload = { id: 999 };
  const refs: string[] = [];
  const hash = "a".repeat(64);
  assertEquals(sepayWebhookProvider.resolveEventId(payload, refs, hash), "sepay:999");
});

Deno.test("resolveEventId uses referenceCode when no id", () => {
  const payload: SePayPayload = { referenceCode: "VQR-ORDER1" };
  const refs = ["VQR-ORDER1"];
  const hash = "a".repeat(64);
  assertEquals(sepayWebhookProvider.resolveEventId(payload, refs, hash), "sepay_ref:VQR-ORDER1");
});

Deno.test("resolveEventId falls back to refs[0] and hash when no id/ref", () => {
  const payload: SePayPayload = {};
  const refs = ["VQR-FALL"];
  const hash = "deadbeef1234567890";
  assertEquals(sepayWebhookProvider.resolveEventId(payload, refs, hash), "fallback_ref:VQR-FALL:deadbeef12345678");
});

Deno.test("resolveEventId falls back to hash only when no refs", () => {
  const payload: SePayPayload = {};
  const refs: string[] = [];
  const hash = "deadbeef1234567890abcdef";
  assertEquals(sepayWebhookProvider.resolveEventId(payload, refs, hash), "fallback_hash:deadbeef1234567890abcdef");
});

Deno.test("normalizeOrderRef returns null for empty", () => {
  assertEquals(sepayWebhookProvider.normalizeOrderRef(""), null);
  assertEquals(sepayWebhookProvider.normalizeOrderRef(null), null);
  assertEquals(sepayWebhookProvider.normalizeOrderRef("   "), null);
});

Deno.test("isIncomingTransfer true for transferType in", () => {
  assertEquals(sepayWebhookProvider.isIncomingTransfer({ transferType: "in" }), true);
  assertEquals(sepayWebhookProvider.isIncomingTransfer({ transferType: "IN" }), true);
});

Deno.test("isIncomingTransfer false for out or missing", () => {
  assertEquals(sepayWebhookProvider.isIncomingTransfer({ transferType: "out" }), false);
  assertEquals(sepayWebhookProvider.isIncomingTransfer({}), false);
});

Deno.test("extractAmount returns VND number", () => {
  assertEquals(sepayWebhookProvider.extractAmount({ transferAmount: 100000 }), 100000);
  assertEquals(sepayWebhookProvider.extractAmount({ transferAmount: 99.5 }), 100);
});

Deno.test("extractAmount returns null for missing or invalid", () => {
  assertEquals(sepayWebhookProvider.extractAmount({}), null);
  assertEquals(sepayWebhookProvider.extractAmount({ transferAmount: "x" }), null);
});
