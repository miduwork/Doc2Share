import type { SupabaseClient } from "@supabase/supabase-js";
import type { HighRiskUser } from "@/lib/admin/security-dashboard.types";

export async function syncSecurityIncidentsFromHighRiskUsers({
  service,
  highRiskUsers,
  dedupeWindowHours = 24,
}: {
  service: SupabaseClient;
  highRiskUsers: HighRiskUser[];
  dedupeWindowHours?: number;
}): Promise<void> {
  const existingIncidents = await service
    .from("security_incidents")
    .select("id, user_id, correlation_id")
    .gte("detected_at", new Date(Date.now() - dedupeWindowHours * 60 * 60 * 1000).toISOString());
  const existingKey = new Set(
    ((existingIncidents.data ?? []) as { user_id: string | null; correlation_id: string | null }[]).map(
      (row) => `${row.user_id ?? ""}|${row.correlation_id ?? ""}`
    )
  );

  for (const risk of highRiskUsers) {
    const key = `${risk.userId}|${risk.correlationId ?? ""}`;
    if (existingKey.has(key)) continue;
    await service.from("security_incidents").insert({
      correlation_id: risk.correlationId,
      user_id: risk.userId,
      risk_score: risk.score,
      risk_band: risk.band,
      detection_source: "risk_engine_v1",
      metadata: { factors: risk.factors },
    });
  }
}
