export interface WebhookProvider<Payload> {
  id: string;
  getAuthSecret(): string;
  isAuthorized(request: Request, secret: string): boolean;
  parsePayload(rawBody: string): { ok: true; payload: Payload } | { ok: false; error: string };
  isIncomingTransfer(payload: Payload): boolean;
  extractOrderReferences(payload: Payload): string[];
  resolveEventId(payload: Payload, refs: string[], payloadHash: string): string;
  extractAmount(payload: Payload): number | null;
  normalizeOrderRef(value: string | null | undefined): string | null;
  buildRawWebhookMetadata(rawBody: string, payload: Payload): Record<string, unknown>;
}
