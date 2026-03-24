import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeoPoint } from "@/lib/admin/ip-geo-resolver";

export async function loadGeoCacheRows(supabase: SupabaseClient, ips: string[]) {
  const { data } = await supabase.from("ip_geo_cache").select("*").in("ip", ips);
  return data ?? [];
}

export function buildGeoCacheUpsertRows({
  points,
  nowIso,
  ttlIso,
}: {
  points: GeoPoint[];
  nowIso: string;
  ttlIso: string;
}) {
  return points.map((point) => ({
    ip: point.ip,
    country_code: point.countryCode,
    country_name: point.countryName,
    city: point.city,
    lat: point.lat,
    lng: point.lng,
    provider: point.provider,
    status: point.status,
    last_error: point.status === "resolved" ? null : "geo_provider_unavailable",
    resolved_at: nowIso,
    expires_at: ttlIso,
    updated_at: nowIso,
  }));
}

export async function upsertGeoCacheBatch({
  supabase,
  rows,
}: {
  supabase: SupabaseClient;
  rows: ReturnType<typeof buildGeoCacheUpsertRows>;
}) {
  if (rows.length === 0) return;
  await supabase.from("ip_geo_cache").upsert(rows);
}
