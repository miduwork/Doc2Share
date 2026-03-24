import { test } from "node:test";
import { strict as assert } from "node:assert";
import { getSecurityBenchmarkMetrics } from "./security-benchmark-metrics.service.ts";

test("getSecurityBenchmarkMetrics returns stats and delta interpretation", async () => {
  const result = await getSecurityBenchmarkMetrics({
    supabase: {} as any,
    fromIso: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    toIso: new Date().toISOString(),
    threshold: 70,
    dependencies: {
      computeRiskBenchmarkStats: async () => ({
        fromIso: "a",
        toIso: "b",
        threshold: 70,
        oldRuleCandidateCount: 10,
        newRuleCandidateCount: 12,
        oldRuleProxyPrecision: 0.2,
        newRuleProxyPrecision: 0.5,
        oldRuleManualPrecision: 0.3,
        newRuleManualPrecision: 0.4,
      }),
    },
  });

  assert.equal(typeof result.stats.newRuleCandidateCount, "number");
  assert.equal(typeof result.interpretation.proxyPrecisionDelta, "number");
  assert.equal(typeof result.interpretation.manualPrecisionDelta, "number");
});
