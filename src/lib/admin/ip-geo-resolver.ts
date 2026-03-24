export type GeoPoint = {
  ip: string;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  status: "resolved" | "unknown" | "error";
  provider: string | null;
};
export { resolveGeoPoints } from "./geo/resolve-geo-points.ts";
