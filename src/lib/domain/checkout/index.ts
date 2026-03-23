import "server-only";

import { createSupabaseCheckoutRepository } from "@/lib/domain/checkout/adapters/supabase";
import type { CheckoutRepository } from "@/lib/domain/checkout/ports";

export type { CheckoutRepository, CreateCheckoutOrderResult, CheckoutOrderMeta, CheckoutOrderStatus } from "@/lib/domain/checkout/ports";
export { createSupabaseCheckoutRepository } from "@/lib/domain/checkout/adapters/supabase";

export function createCheckoutRepository(): CheckoutRepository {
  return createSupabaseCheckoutRepository();
}
