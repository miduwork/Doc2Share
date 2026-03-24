import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { getObservabilityDashboardData } from "@/features/admin/observability/dashboard/server/getObservabilityDashboardData";
import type { ObservabilitySearchParams } from "@/features/admin/observability/dashboard/model/dashboard.types";
import ObservabilityPageView from "@/components/admin/observability/ObservabilityPageView";

export default async function AdminObservabilityPage({ searchParams }: { searchParams?: ObservabilitySearchParams }) {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const data = await getObservabilityDashboardData({ supabase, searchParams });

  return <ObservabilityPageView data={data} />;
}
