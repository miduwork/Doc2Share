import { sepayCheckoutProvider } from "@/lib/payments/providers/sepay";
import type { CheckoutPaymentProvider } from "@/lib/payments/providers/types";

const providers: Record<string, CheckoutPaymentProvider> = {
  [sepayCheckoutProvider.id]: sepayCheckoutProvider,
};

/** Allowlist for PAYMENT_PROVIDER env. Add new provider ids here when integrating. */
export const ALLOWED_PAYMENT_PROVIDER_IDS = ["sepay"] as const;

const DEFAULT_PROVIDER_ID = "sepay";

export function resolveCheckoutPaymentProvider(providerId?: string): CheckoutPaymentProvider {
  const raw = (providerId || process.env.PAYMENT_PROVIDER || DEFAULT_PROVIDER_ID).toLowerCase();
  const resolved = raw as string;
  const provider = providers[resolved];
  if (provider) return provider;
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn(
      `[payments] Unknown PAYMENT_PROVIDER "${resolved}"; allowed: ${ALLOWED_PAYMENT_PROVIDER_IDS.join(", ")}. Falling back to "${DEFAULT_PROVIDER_ID}".`
    );
  }
  return sepayCheckoutProvider;
}
