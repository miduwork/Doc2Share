import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchRiskInputRows({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const now = Date.now();
  const iso24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const iso30m = new Date(now - 30 * 60 * 1000).toISOString();
  const iso10m = new Date(now - 10 * 60 * 1000).toISOString();

  const [{ data: recentDevices }, { data: access30m }, { data: access10m }, { data: recentSecurity }] = await Promise.all([
    supabase.from("device_logs").select("user_id, device_id, created_at").gte("created_at", iso24h),
    supabase
      .from("access_logs")
      .select("user_id, status, action, ip_address, correlation_id, created_at")
      .gte("created_at", iso30m),
    supabase
      .from("access_logs")
      .select("user_id, action, document_id, metadata, created_at")
      .gte("created_at", iso10m),
    supabase
      .from("security_logs")
      .select("user_id, event_type, correlation_id, created_at, metadata")
      .gte("created_at", iso30m),
  ]);

  return {
    recentDevices: recentDevices ?? [],
    access30m: access30m ?? [],
    access10m: access10m ?? [],
    recentSecurity: recentSecurity ?? [],
  };
}
