import type { PricingConfigV1 } from "@/lib/config/appConfigSchema";
import type { PrintColor, PrintSides } from "@/lib/orders/printOptions";

export type ResolvePricePerPageInput = {
  paperSize: string;
  gsm: string;
  color: PrintColor;
  sides: PrintSides;
  pricing: PricingConfigV1;
  /** Khi thiếu base hợp lệ — dùng [lib/config/public.ts](lib/config/public.ts) */
  fallbackPricePerPage: number;
};

/**
 * Làm tròn số nguyên VNĐ/trang sau khi nhân hệ số (override thì là giá cuối, không nhân mult).
 */
function roundVndPerPage(n: number): number {
  return Math.round(n);
}

function normKey(s: string): string {
  return s.trim();
}

/**
 * Thuật toán §4.3 tài liệu APP-ADMIN-SETTINGS-PRICING-PLAN.md
 */
export function resolvePricePerPage(input: ResolvePricePerPageInput): number {
  const { pricing, paperSize, gsm, color, sides, fallbackPricePerPage } = input;
  const p = normKey(paperSize);
  const g = normKey(gsm);

  const o = pricing.overridePerPage[p]?.[g]?.[color]?.[sides];
  if (
    o != null &&
    typeof o === "number" &&
    Number.isFinite(o) &&
    o >= 0
  ) {
    return roundVndPerPage(o);
  }

  const base = pricing.basePerPageByPaper[p]?.[g];
  if (
    typeof base === "number" &&
    Number.isFinite(base) &&
    base >= 0
  ) {
    const mult =
      pricing.multByColor[color] * pricing.multBySides[sides];
    return roundVndPerPage(base * mult);
  }

  const mult =
    pricing.multByColor[color] * pricing.multBySides[sides];
  console.warn(
    `[pricing] Thiếu base cho khổ=${p} gsm=${g}; dùng fallback=${fallbackPricePerPage} × mult=${mult}`,
  );
  return roundVndPerPage(fallbackPricePerPage * mult);
}
