import type { HighRiskUser, RiskFactor } from "@/lib/admin/security-risk";
import { bandFromScore, clampScore, normalizeAccessAction, ratioPoints, RISK_WEIGHTS, thresholdPoints } from "./security-risk.scoring.ts";

export function aggregateHighRiskUsers({
  recentDevices,
  access30m,
  access10m,
  recentSecurity,
  threshold,
  limit,
}: {
  recentDevices: any[];
  access30m: any[];
  access10m: any[];
  recentSecurity: any[];
  threshold: number;
  limit: number;
}): HighRiskUser[] {
  const users = new Map<string, { factors: RiskFactor[]; score: number; correlationId: string | null }>();
  const deviceSetByUser = new Map<string, Set<string>>();
  for (const row of recentDevices) {
    const userId = (row as { user_id: string | null }).user_id;
    if (!userId) continue;
    const deviceId = (row as { device_id: string | null }).device_id ?? "";
    if (!deviceSetByUser.has(userId)) deviceSetByUser.set(userId, new Set());
    if (deviceId) deviceSetByUser.get(userId)?.add(deviceId);
  }

  const ipByUser = new Map<string, Set<string>>();
  const blockedByUser = new Map<string, number>();
  const successByUser = new Map<string, number>();
  for (const row of access30m) {
    const r = row as {
      user_id: string | null;
      status: string;
      action: string | null;
      ip_address: string | null;
      correlation_id: string | null;
    };
    if (!r.user_id) continue;
    if (normalizeAccessAction(r.action) !== "secure_read") continue;
    if (!ipByUser.has(r.user_id)) ipByUser.set(r.user_id, new Set());
    if (r.ip_address) ipByUser.get(r.user_id)?.add(r.ip_address);
    if (r.status === "blocked") blockedByUser.set(r.user_id, (blockedByUser.get(r.user_id) ?? 0) + 1);
    if (r.status === "success") successByUser.set(r.user_id, (successByUser.get(r.user_id) ?? 0) + 1);
    if (!users.has(r.user_id)) users.set(r.user_id, { factors: [], score: 0, correlationId: r.correlation_id ?? null });
  }

  const docByUser = new Map<string, Set<string>>();
  const rateLimitByUser = new Map<string, number>();
  for (const row of access10m) {
    const r = row as {
      user_id: string | null;
      action: string | null;
      document_id: string | null;
      metadata: Record<string, unknown> | null;
    };
    if (!r.user_id) continue;
    if (normalizeAccessAction(r.action) !== "secure_read") continue;
    if (!docByUser.has(r.user_id)) docByUser.set(r.user_id, new Set());
    if (r.document_id) docByUser.get(r.user_id)?.add(r.document_id);
    const reason = String((r.metadata ?? {}).reason ?? "");
    if (reason.includes("rate_limit")) rateLimitByUser.set(r.user_id, (rateLimitByUser.get(r.user_id) ?? 0) + 1);
    if (!users.has(r.user_id)) users.set(r.user_id, { factors: [], score: 0, correlationId: null });
  }

  for (const row of recentSecurity) {
    const r = row as { user_id: string | null; event_type: string; correlation_id: string | null };
    if (!r.user_id) continue;
    if (r.event_type === "ip_change") {
      const set = ipByUser.get(r.user_id) ?? new Set<string>();
      ipByUser.set(r.user_id, set);
    }
    if (!users.has(r.user_id)) users.set(r.user_id, { factors: [], score: 0, correlationId: r.correlation_id ?? null });
    const existing = users.get(r.user_id);
    if (existing && !existing.correlationId && r.correlation_id) existing.correlationId = r.correlation_id;
  }

  const results: HighRiskUser[] = [];
  for (const [userId, base] of Array.from(users.entries())) {
    const newDevices = deviceSetByUser.get(userId)?.size ?? 0;
    const distinctIps = ipByUser.get(userId)?.size ?? 0;
    const blocked = blockedByUser.get(userId) ?? 0;
    const success = successByUser.get(userId) ?? 0;
    const distinctDocs = docByUser.get(userId)?.size ?? 0;
    const rateLimitCount = rateLimitByUser.get(userId) ?? 0;
    const factors: RiskFactor[] = [
      { key: "new_devices_24h", value: newDevices, points: thresholdPoints(newDevices, RISK_WEIGHTS.newDevices24h, 2, 4) },
      { key: "distinct_ips_30m", value: distinctIps, points: thresholdPoints(distinctIps, RISK_WEIGHTS.distinctIps30m, 2, 4) },
      { key: "blocked_success_ratio", value: blocked / Math.max(1, success), points: ratioPoints(blocked, success) },
      { key: "distinct_docs_10m", value: distinctDocs, points: thresholdPoints(distinctDocs, RISK_WEIGHTS.distinctDocs10m, 3, 8) },
      { key: "rate_limit_count", value: rateLimitCount, points: thresholdPoints(rateLimitCount, RISK_WEIGHTS.rateLimitCount, 1, 3) },
    ];
    const score = clampScore(factors.reduce((sum, f) => sum + f.points, 0));
    if (score < threshold) continue;
    results.push({ userId, score, band: bandFromScore(score), factors, correlationId: base.correlationId });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
