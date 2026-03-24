export function parseBenchmarkRouteQuery(urlString: string): {
  fromIso: string;
  toIso: string;
  threshold: number;
} {
  const url = new URL(urlString);
  const thresholdRaw = Number(url.searchParams.get("threshold") ?? "70");
  const threshold = Number.isFinite(thresholdRaw) ? Math.max(0, Math.min(100, Math.floor(thresholdRaw))) : 70;
  const toIso = url.searchParams.get("to") ?? new Date().toISOString();
  const fromIso = url.searchParams.get("from") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { fromIso, toIso, threshold };
}
