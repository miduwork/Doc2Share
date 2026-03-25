import type { WatermarkDisplayPayload } from "@/lib/watermark/watermark-contract";

export type WatermarkPoint = {
  xPercent: number;
  yPercent: number;
  rotationDeg: number;
};

export type WatermarkPaintStyle = {
  color: string;
  opacity: number;
};

function tokenSeed(token: string): number {
  let seed = 0;
  for (let i = 0; i < token.length; i += 1) {
    seed = (seed * 31 + token.charCodeAt(i)) >>> 0;
  }
  return seed || 1;
}

function seededRandom(seedRef: { current: number }): number {
  seedRef.current = (1664525 * seedRef.current + 1013904223) >>> 0;
  return seedRef.current / 0xffffffff;
}

export function buildWatermarkGrid(watermark: WatermarkDisplayPayload, count = 10): WatermarkPoint[] {
  const seedRef = { current: tokenSeed(watermark.wmShort) };
  const cols = 4;
  const rows = Math.ceil(count / cols);
  const points: WatermarkPoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (points.length >= count) break;
      const baseX = ((col + 0.5) * 100) / cols;
      const baseY = ((row + 0.5) * 100) / rows;
      const jitterX = (seededRandom(seedRef) - 0.5) * 8;
      const jitterY = (seededRandom(seedRef) - 0.5) * 7;
      const rotationOptions = [-28, -21, -14];
      const rotationDeg = rotationOptions[Math.floor(seededRandom(seedRef) * rotationOptions.length)] ?? -21;
      points.push({
        xPercent: Math.max(8, Math.min(92, baseX + jitterX)),
        yPercent: Math.max(10, Math.min(90, baseY + jitterY)),
        rotationDeg,
      });
    }
  }
  return points;
}

export function getAdaptiveWatermarkPaint(sampleLuma: number): WatermarkPaintStyle {
  if (sampleLuma >= 0.55) {
    return { color: "#0f172a", opacity: 0.24 };
  }
  return { color: "#e2e8f0", opacity: 0.2 };
}
