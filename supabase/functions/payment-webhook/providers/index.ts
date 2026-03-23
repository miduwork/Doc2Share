import type { WebhookProvider } from "./types.ts";
import { sepayWebhookProvider, type SePayPayload } from "./sepay.ts";

export type SupportedWebhookPayload = SePayPayload;

const providers: Record<string, WebhookProvider<SupportedWebhookPayload>> = {
  [sepayWebhookProvider.id]: sepayWebhookProvider as WebhookProvider<SupportedWebhookPayload>,
};

export function resolveWebhookProvider(): WebhookProvider<SupportedWebhookPayload> {
  const configured = (Deno.env.get("PAYMENT_PROVIDER") ?? "sepay").toLowerCase();
  return providers[configured] ?? providers.sepay;
}
