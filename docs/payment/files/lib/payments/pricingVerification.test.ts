/**
 * Tự kiểm tra công thức giá (§4.3): so sánh kết quả runtime với công thức tham chiếu.
 * Chạy: npm run test:pricing
 */
import { describe, expect, it } from "vitest";

import type { PricingConfigV1 } from "@/lib/config/appConfigSchema";
import {
  defaultBindingFeeVnd,
  defaultCatalogConfig,
  defaultDeliveryConfig,
  fullGridPricingConfigFallback,
  recomputeOverridePerPageFromBaseMult,
} from "@/lib/config/appConfigSchema";
import { buildOrderPayload } from "@/lib/orders/createOrder";
import { computePrintSubtotalForOrder } from "@/lib/payments/printSubtotal";
import { resolvePricePerPage } from "@/lib/payments/resolvePricePerPage";
import { grandTotalFromPrintSubtotal } from "@/lib/payments/pricing";

function refPpp(
  base: number,
  pricing: PricingConfigV1,
  color: "bw" | "color",
  sides: "double" | "single",
): number {
  return Math.round(
    base * pricing.multByColor[color] * pricing.multBySides[sides],
  );
}

describe("pricingVerification — công thức tham chiếu khớp resolvePricePerPage", () => {
  const pricing: PricingConfigV1 = {
    v: 1,
    basePerPageByPaper: { A4: { "80": 500 } },
    multByColor: { bw: 1, color: 1.2 },
    multBySides: { double: 1, single: 1.75 },
    bindingFeeVnd: defaultBindingFeeVnd(),
    overridePerPage: {},
  };

  it.each([
    ["bw", "double", refPpp(500, pricing, "bw", "double")],
    ["bw", "single", refPpp(500, pricing, "bw", "single")],
    ["color", "double", refPpp(500, pricing, "color", "double")],
    ["color", "single", refPpp(500, pricing, "color", "single")],
  ] as const)("A4/80 %s %s", (color, sides, expected) => {
    expect(
      resolvePricePerPage({
        paperSize: "A4",
        gsm: "80",
        color,
        sides,
        pricing,
        fallbackPricePerPage: 999,
      }),
    ).toBe(expected);
  });
});

describe("pricingVerification — override đầy đủ từ recompute = cùng kết quả với base×mult", () => {
  const base: PricingConfigV1 = {
    v: 1,
    basePerPageByPaper: { A4: { "80": 400 } },
    multByColor: { bw: 1, color: 2 },
    multBySides: { double: 1, single: 0.5 },
    bindingFeeVnd: defaultBindingFeeVnd(),
    overridePerPage: {},
  };
  const withOverrides = recomputeOverridePerPageFromBaseMult(base);

  it.each([
    ["bw", "double"],
    ["bw", "single"],
    ["color", "double"],
    ["color", "single"],
  ] as const)("ô override khớp ref cho %s %s", (color, sides) => {
    const withoutOv = resolvePricePerPage({
      paperSize: "A4",
      gsm: "80",
      color,
      sides,
      pricing: base,
      fallbackPricePerPage: 1,
    });
    const withOv = resolvePricePerPage({
      paperSize: "A4",
      gsm: "80",
      color,
      sides,
      pricing: withOverrides,
      fallbackPricePerPage: 1,
    });
    expect(withOv).toBe(withoutOv);
    expect(withOv).toBe(refPpp(400, base, color, sides));
  });
});

describe("pricingVerification — buildOrderPayload khớp computePrintSubtotal + ship", () => {
  const catalog = defaultCatalogConfig();
  const pricing = fullGridPricingConfigFallback(500, catalog);
  const delivery = defaultDeliveryConfig();

  it("tài liệu: tổng = subtotal in + ship", () => {
    const printSubtotal = computePrintSubtotalForOrder({
      orderSpec: {
        v: 1,
        kind: "document",
        paperSize: "A4",
        paperGsm: "80",
        pageScope: "all",
      },
      totalPages: 5,
      copies: 2,
      printColor: "bw",
      printSides: "double",
      pricing,
      fallbackPricePerPage: 500,
    });
    const grand = grandTotalFromPrintSubtotal(printSubtotal, "delivery", {
      freeshipThresholdVnd: delivery.freeshipThresholdVnd,
      shippingFeeDelivery: delivery.shippingFeeDelivery,
    });

    const row = buildOrderPayload({
      id: "00000000-0000-4000-8000-000000000099",
      customerName: "T",
      phone: "1",
      note: "",
      fileName: "f.pdf",
      fileUrl: "https://example.com/f.pdf",
      totalPages: 5,
      copies: 2,
      deliveryMethod: "delivery",
      deliveryDetail: "a",
      deliveryDistrict: "b",
      printColor: "bw",
      printSides: "double",
      orderSpec: {
        v: 1,
        kind: "document",
        paperSize: "A4",
        paperGsm: "80",
        pageScope: "all",
      },
      pricing,
      deliveryConfig: delivery,
      fallbackPricePerPage: 500,
    });

    expect(row.total_price).toBe(grand.total);
    expect(row.shipping_fee).toBe(grand.shippingFee);
  });
});

describe("pricingVerification — fullGridPricingConfigFallback: mọi gsm cùng base env", () => {
  it("mọi gsm trong catalog đều có cùng base = pricePerPage", () => {
    const cat = defaultCatalogConfig();
    const p = fullGridPricingConfigFallback(777, cat);
    for (const paper of cat.paperSizes) {
      for (const gsm of cat.gsmOptions) {
        expect(p.basePerPageByPaper[paper]?.[gsm]).toBe(777);
      }
    }
  });
});
