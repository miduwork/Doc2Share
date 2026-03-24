import type { SupabaseClient } from "@supabase/supabase-js";
import { getObservabilityDashboardData } from "@/features/admin/observability/dashboard/server/getObservabilityDashboardData";
import type { ObservabilityPageData, ObservabilitySearchParams } from "@/features/admin/observability/dashboard/model/dashboard.types";

export async function loadObservabilityPageData(
  supabase: SupabaseClient,
  searchParams?: ObservabilitySearchParams
): Promise<ObservabilityPageData> {
  return getObservabilityDashboardData({ supabase, searchParams });
}
