import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRiskBenchmarkStats } from "../security-risk.ts";

type BenchmarkDeps = {
  computeRiskBenchmarkStats: typeof computeRiskBenchmarkStats;
};

export async function getSecurityBenchmarkMetrics({
  supabase,
  fromIso,
  toIso,
  threshold,
  dependencies = { computeRiskBenchmarkStats },
}: {
  supabase: SupabaseClient;
  fromIso: string;
  toIso: string;
  threshold: number;
  dependencies?: BenchmarkDeps;
}) {
  const stats = await dependencies.computeRiskBenchmarkStats({
    supabase,
    fromIso,
    toIso,
    threshold,
  });
  return {
    stats,
    interpretation: {
      proxyPrecisionDelta: Number((stats.newRuleProxyPrecision - stats.oldRuleProxyPrecision).toFixed(4)),
      manualPrecisionDelta: Number((stats.newRuleManualPrecision - stats.oldRuleManualPrecision).toFixed(4)),
      candidateDelta: stats.newRuleCandidateCount - stats.oldRuleCandidateCount,
    },
  };
}
