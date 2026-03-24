import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeoPoint } from "@/lib/admin/ip-geo-resolver";
import { isPrivateOrUnknownIp } from "./ip-address.ts";
import { fetchGeoFromProvider } from "./geo-provider-fetch.ts";
import { buildGeoCacheUpsertRows, loadGeoCacheRows, upsertGeoCacheBatch } from "./ip-geo-cache.ops.ts";

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (_item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResult = await Promise.all(chunk.map(mapper));
    results.push(...chunkResult);
  }
  return results;
}

export async function resolveGeoPoints({
  supabase,
  ips,
  ttlHours = 24,
  concurrency = 6,
}: {
  supabase: SupabaseClient;
  ips: string[];
  ttlHours?: number;
  concurrency?: number;
}): Promise<GeoPoint[]> {
  const normalizedIps = Array.from(new Set(ips.map((ip) => ip?.trim()).filter(Boolean) as string[]));
  const now = new Date();
  const nowIso = now.toISOString();
  const ttlIso = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  if (normalizedIps.length === 0) return [];

  const cacheRows = await loadGeoCacheRows(supabase, normalizedIps);
  const cacheMap = new Map(cacheRows.map((row: any) => [row.ip, row]));
  const results: GeoPoint[] = [];
  const missIps: string[] = [];

  for (const ip of normalizedIps) {
    if (isPrivateOrUnknownIp(ip)) {
      results.push({
        ip,
        countryCode: null,
        countryName: null,
        city: null,
        lat: null,
        lng: null,
        status: "unknown",
        provider: null,
      });
      continue;
    }
    const cached = cacheMap.get(ip);
    if (cached && cached.expires_at && new Date(cached.expires_at) > now) {
      results.push({
        ip,
        countryCode: cached.country_code ?? null,
        countryName: cached.country_name ?? null,
        city: cached.city ?? null,
        lat: cached.lat ?? null,
        lng: cached.lng ?? null,
        status: cached.status ?? "unknown",
        provider: cached.provider ?? null,
      });
      continue;
    }
    missIps.push(ip);
  }

  const resolvedMisses = await mapWithConcurrency(missIps, Math.max(1, concurrency), async (ip) => {
    const primary = await fetchGeoFromProvider({
      ip,
      baseUrl: process.env.GEO_PRIMARY_URL,
      apiKey: process.env.GEO_PRIMARY_KEY,
      provider: "primary",
    });
    if (primary) return primary;
    const secondary = await fetchGeoFromProvider({
      ip,
      baseUrl: process.env.GEO_SECONDARY_URL,
      apiKey: process.env.GEO_SECONDARY_KEY,
      provider: "secondary",
    });
    if (secondary) return secondary;
    return {
      ip,
      countryCode: null,
      countryName: null,
      city: null,
      lat: null,
      lng: null,
      status: "unknown" as const,
      provider: null,
    };
  });

  results.push(...resolvedMisses);
  await upsertGeoCacheBatch({
    supabase,
    rows: buildGeoCacheUpsertRows({ points: resolvedMisses, nowIso, ttlIso }),
  });
  return results;
}
