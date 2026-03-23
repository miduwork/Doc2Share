import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import ObservabilityPageView from "@/components/admin/observability/ObservabilityPageView";
import type { ObservabilitySearchParams } from "./types";
import { loadObservabilityPageData } from "./load-observability-data";

export default async function AdminObservabilityPage({ searchParams }: { searchParams?: ObservabilitySearchParams }) {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const data = await loadObservabilityPageData(supabase, searchParams);

  return <ObservabilityPageView data={data} />;
}
