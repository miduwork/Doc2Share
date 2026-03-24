import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeAccessAction,
  safePrecision,
} from "./risk/security-risk.scoring.ts";
import { fetchRiskInputRows } from "./risk/security-risk.queries.ts";
import { aggregateHighRiskUsers } from "./risk/security-risk.aggregate.ts";
export { normalizeAccessAction };

export type RiskFactor = {
  key: "new_devices_24h" | "distinct_ips_30m" | "blocked_success_ratio" | "distinct_docs_10m" | "rate_limit_count";
  value: number;
  points: number;
};

export type HighRiskUser = {
  userId: string;
  score: number;
  band: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  correlationId: string | null;
};

export type WeeklyFalsePositiveStats = {
  weekStartIso: string;
  totalIncidents: number;
  confirmedRisk: number;
  manualFalsePositive: number;
  proxyFalsePositive: number;
};

export type RiskBenchmarkStats = {
  fromIso: string;
  toIso: string;
  threshold: number;
  oldRuleCandidateCount: number;
  newRuleCandidateCount: number;
  oldRuleProxyPrecision: number;
  newRuleProxyPrecision: number;
  oldRuleManualPrecision: number;
  newRuleManualPrecision: number;
};


export async function computeHighRiskUsers({
  supabase,
  threshold = 70,
  limit = 20,
}: {
  supabase: SupabaseClient;
  threshold?: number;
  limit?: number;
}): Promise<HighRiskUser[]> {
  const inputs = await fetchRiskInputRows({ supabase });
  return aggregateHighRiskUsers({ ...inputs, threshold, limit });
}

export async function computeRiskBenchmarkStats({
  supabase,
  fromIso,
  toIso,
  threshold = 70,
}: {
  supabase: SupabaseClient;
  fromIso: string;
  toIso: string;
  threshold?: number;
}): Promise<RiskBenchmarkStats> {
  const [newCandidates, oldDeviceRows, blockedRows, labeledRows] = await Promise.all([
    computeHighRiskUsers({ supabase, threshold, limit: 1000 }),
    supabase.from("device_logs").select("user_id, device_id").gte("created_at", fromIso).lte("created_at", toIso),
    supabase
      .from("access_logs")
      .select("user_id, status, action")
      .eq("status", "blocked")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase
      .from("security_incidents")
      .select("user_id, review_status")
      .gte("detected_at", fromIso)
      .lte("detected_at", toIso),
  ]);

  const deviceByUser = new Map<string, Set<string>>();
  for (const row of (oldDeviceRows.data ?? []) as { user_id: string | null; device_id: string | null }[]) {
    if (!row.user_id || !row.device_id) continue;
    if (!deviceByUser.has(row.user_id)) deviceByUser.set(row.user_id, new Set());
    deviceByUser.get(row.user_id)?.add(row.device_id);
  }
  const oldRuleUsers = new Set(
    Array.from(deviceByUser.entries())
      .filter(([, deviceSet]) => deviceSet.size > 2)
      .map(([userId]) => userId)
  );
  const newRuleUsers = new Set(newCandidates.map((c) => c.userId));

  const blockedSecureUsers = new Set(
    ((blockedRows.data ?? []) as { user_id: string | null; action: string | null }[])
      .filter((r) => r.user_id && normalizeAccessAction(r.action) === "secure_read")
      .map((r) => r.user_id as string)
  );

  const labelsByUser = new Map<string, { confirmed: number; falsePositive: number }>();
  for (const row of (labeledRows.data ?? []) as { user_id: string | null; review_status: string }[]) {
    if (!row.user_id) continue;
    if (!labelsByUser.has(row.user_id)) labelsByUser.set(row.user_id, { confirmed: 0, falsePositive: 0 });
    const entry = labelsByUser.get(row.user_id)!;
    if (row.review_status === "confirmed_risk") entry.confirmed += 1;
    if (row.review_status === "false_positive") entry.falsePositive += 1;
  }

  const oldProxyTp = Array.from(oldRuleUsers).filter((userId) => blockedSecureUsers.has(userId)).length;
  const newProxyTp = Array.from(newRuleUsers).filter((userId) => blockedSecureUsers.has(userId)).length;

  const oldManual = Array.from(oldRuleUsers).reduce(
    (acc, userId) => {
      const labels = labelsByUser.get(userId);
      if (!labels) return acc;
      acc.confirmed += labels.confirmed;
      acc.falsePositive += labels.falsePositive;
      return acc;
    },
    { confirmed: 0, falsePositive: 0 }
  );
  const newManual = Array.from(newRuleUsers).reduce(
    (acc, userId) => {
      const labels = labelsByUser.get(userId);
      if (!labels) return acc;
      acc.confirmed += labels.confirmed;
      acc.falsePositive += labels.falsePositive;
      return acc;
    },
    { confirmed: 0, falsePositive: 0 }
  );

  return {
    fromIso,
    toIso,
    threshold,
    oldRuleCandidateCount: oldRuleUsers.size,
    newRuleCandidateCount: newRuleUsers.size,
    oldRuleProxyPrecision: safePrecision(oldProxyTp, oldRuleUsers.size),
    newRuleProxyPrecision: safePrecision(newProxyTp, newRuleUsers.size),
    oldRuleManualPrecision: safePrecision(oldManual.confirmed, oldManual.confirmed + oldManual.falsePositive),
    newRuleManualPrecision: safePrecision(newManual.confirmed, newManual.confirmed + newManual.falsePositive),
  };
}

export async function getWeeklyFalsePositiveStats({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<WeeklyFalsePositiveStats> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartIso = weekStart.toISOString();

  const { data: incidents } = await supabase
    .from("security_incidents")
    .select("id, review_status, correlation_id")
    .gte("detected_at", weekStartIso);
  const rows = (incidents ?? []) as { id: string; review_status: string; correlation_id: string | null }[];
  const totalIncidents = rows.length;
  const confirmedRisk = rows.filter((r) => r.review_status === "confirmed_risk").length;
  const manualFalsePositive = rows.filter((r) => r.review_status === "false_positive").length;
  const pendingCorrelations = rows
    .filter((r) => r.review_status === "pending" && r.correlation_id)
    .map((r) => r.correlation_id) as string[];

  let proxyFalsePositive = 0;
  if (pendingCorrelations.length > 0) {
    const { data: actions } = await supabase
      .from("admin_security_actions")
      .select("correlation_id")
      .in("correlation_id", pendingCorrelations);
    const acted = new Set((actions ?? []).map((a: { correlation_id: string | null }) => a.correlation_id).filter(Boolean));
    proxyFalsePositive = pendingCorrelations.filter((id) => !acted.has(id)).length;
  }

  return {
    weekStartIso,
    totalIncidents,
    confirmedRisk,
    manualFalsePositive,
    proxyFalsePositive,
  };
}
