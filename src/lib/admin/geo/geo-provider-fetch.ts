import type { GeoPoint } from "@/lib/admin/ip-geo-resolver";

function buildProviderUrl(base: string, ip: string, key?: string): string {
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(ip)}${key ? `?apiKey=${encodeURIComponent(key)}` : ""}`;
}

function toGeoPoint(ip: string, json: Record<string, unknown>, provider: string): GeoPoint {
  const lat = Number(json.latitude ?? json.lat ?? NaN);
  const lng = Number(json.longitude ?? json.lon ?? json.lng ?? NaN);
  return {
    ip,
    countryCode: String(json.country_code ?? json.countryCode ?? "") || null,
    countryName: String(json.country_name ?? json.countryName ?? "") || null,
    city: String(json.city ?? "") || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    status: "resolved",
    provider,
  };
}

export async function fetchGeoFromProvider({
  ip,
  baseUrl,
  apiKey,
  provider,
}: {
  ip: string;
  baseUrl?: string;
  apiKey?: string;
  provider: string;
}): Promise<GeoPoint | null> {
  if (!baseUrl) return null;
  const res = await fetch(buildProviderUrl(baseUrl, ip, apiKey), { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  return toGeoPoint(ip, json, provider);
}
