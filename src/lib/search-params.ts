/**
 * Shared helpers for parsing search params (e.g. Next.js searchParams or URLSearchParams).
 * Use a single source to avoid duplication across admin pages and API routes.
 */

/**
 * Normalize a value that may be string or string[] (e.g. from searchParams) to a single string.
 */
export function pickSingle(value: string | string[] | undefined, fallback: string): string {
  if (typeof value === "string" && value) return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return fallback;
}

/**
 * Parse a string as integer, clamp to [min, max], or return fallback if invalid.
 */
export function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
