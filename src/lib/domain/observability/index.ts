import "server-only";

import { createSupabaseObservabilityAdminRepository } from "@/lib/domain/observability/adapters/supabase";
import type { ObservabilityAdminRepository } from "@/lib/domain/observability/ports";

export type { ObservabilityAdminRepository } from "@/lib/domain/observability/ports";
export { createSupabaseObservabilityAdminRepository } from "@/lib/domain/observability/adapters/supabase";

export function createObservabilityAdminRepository(): ObservabilityAdminRepository {
  return createSupabaseObservabilityAdminRepository();
}
