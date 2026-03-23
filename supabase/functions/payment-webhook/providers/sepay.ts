import type { WebhookProvider } from "./types.ts";
import {
  parsePayload as coreParsePayload,
  extractOrderReferences,
  resolveEventId,
  isIncomingTransfer,
  extractAmount,
  normalizeOrderRef as coreNormalizeOrderRef,
  type SePayPayload,
} from "./sepay-core.ts";

export type { SePayPayload };

export const sepayWebhookProvider: WebhookProvider<SePayPayload> = {
  id: "sepay",
  getAuthSecret() {
    return Deno.env.get("WEBHOOK_SEPAY_API_KEY") ?? "";
  },
  isAuthorized(request: Request, secret: string) {
    const authorization = request.headers.get("authorization") ?? "";
    return authorization === `Apikey ${secret}` || authorization === secret;
  },
  parsePayload(rawBody: string) {
    const result = coreParsePayload(rawBody);
    if (result.ok) return { ok: true as const, payload: result.payload };
    return { ok: false as const, error: result.error };
  },
  isIncomingTransfer(payload: SePayPayload) {
    return isIncomingTransfer(payload);
  },
  extractOrderReferences(payload: SePayPayload) {
    return extractOrderReferences(payload);
  },
  resolveEventId(payload: SePayPayload, refs: string[], payloadHash: string) {
    return resolveEventId(payload, refs, payloadHash);
  },
  extractAmount(payload: SePayPayload) {
    return extractAmount(payload);
  },
  normalizeOrderRef(value: string | null | undefined) {
    return coreNormalizeOrderRef(value);
  },
  buildRawWebhookMetadata(rawBody: string, payload: SePayPayload) {
    return {
      raw: rawBody,
      at: new Date().toISOString(),
      provider: "sepay",
      sepay_id: payload.id ?? null,
      reference_code: payload.referenceCode ?? null,
    };
  },
};
