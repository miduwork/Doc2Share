import type { HighRiskUser } from "@/lib/admin/security-risk";

export const RISK_WEIGHTS = {
  newDevices24h: 20,
  distinctIps30m: 20,
  blockedSuccessRatio: 25,
  distinctDocs10m: 20,
  rateLimitCount: 15,
} as const;

const NORMALIZED_SECURE_ACTIONS = new Set(["secure_pdf", "get_secure_link"]);

export function normalizeAccessAction(action: string | null | undefined): "secure_read" | "other" {
  const normalized = (action ?? "").trim().toLowerCase();
  return NORMALIZED_SECURE_ACTIONS.has(normalized) ? "secure_read" : "other";
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function bandFromScore(score: number): HighRiskUser["band"] {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function ratioPoints(blocked: number, success: number): number {
  const ratio = blocked / Math.max(1, success);
  if (ratio >= 2) return RISK_WEIGHTS.blockedSuccessRatio;
  if (ratio >= 1) return Math.round(RISK_WEIGHTS.blockedSuccessRatio * 0.7);
  if (ratio >= 0.5) return Math.round(RISK_WEIGHTS.blockedSuccessRatio * 0.35);
  return 0;
}

export function thresholdPoints(value: number, fullWeight: number, mediumAt: number, highAt: number): number {
  if (value >= highAt) return fullWeight;
  if (value >= mediumAt) return Math.round(fullWeight * 0.6);
  if (value > 0) return Math.round(fullWeight * 0.3);
  return 0;
}

export function safePrecision(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}
