import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { getSecurityBenchmarkMetrics } from "@/lib/admin/benchmark/security-benchmark-metrics.service";
import { parseBenchmarkRouteQuery } from "@/lib/admin/benchmark/benchmark-route-query";

type BenchmarkRouteDeps = {
  requireSuperAdminContext: typeof requireSuperAdminContext;
  createServiceRoleClient: typeof createServiceRoleClient;
  getSecurityBenchmarkMetrics: typeof getSecurityBenchmarkMetrics;
};

const defaultDeps: BenchmarkRouteDeps = {
  requireSuperAdminContext,
  createServiceRoleClient,
  getSecurityBenchmarkMetrics,
};

export async function runBenchmarkRoute(req: Request, deps: BenchmarkRouteDeps = defaultDeps) {
  const guard = await deps.requireSuperAdminContext();
  if (!guard.ok) return new NextResponse("Forbidden", { status: 403 });

  const { fromIso, toIso, threshold } = parseBenchmarkRouteQuery(req.url);

  const service = deps.createServiceRoleClient();
  const result = await deps.getSecurityBenchmarkMetrics({
    supabase: service as any,
    fromIso,
    toIso,
    threshold,
  });

  return NextResponse.json({
    ok: true,
    stats: result.stats,
    interpretation: result.interpretation,
  });
}
