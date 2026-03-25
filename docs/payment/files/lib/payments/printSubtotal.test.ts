import { describe, expect, it } from "vitest";

import {
  defaultBindingFeeVnd,
  type PricingConfigV1,
} from "@/lib/config/appConfigSchema";

import {
  computeBookPrintBreakdown,
  computePrintSubtotalForOrder,
} from "./printSubtotal";

const testPricing: PricingConfigV1 = {
  v: 1,
  basePerPageByPaper: {
    A4: { 80: 500 },
  },
  multByColor: { bw: 1, color: 1.5 },
  multBySides: { double: 1, single: 0.8 },
  bindingFeeVnd: defaultBindingFeeVnd(),
  overridePerPage: {},
};

const fallback = 999;

describe("computePrintSubtotalForOrder", () => {
  it("document: một lần lookup × totalPages × copies", () => {
    const subtotal = computePrintSubtotalForOrder({
      orderSpec: {
        v: 1,
        kind: "document",
        paperSize: "A4",
        paperGsm: "80",
        pageScope: "all",
      },
      totalPages: 10,
      copies: 2,
      printColor: "bw",
      printSides: "double",
      pricing: testPricing,
      fallbackPricePerPage: fallback,
    });
    // 500 × 1 × 1 × 10 × 2
    expect(subtotal).toBe(10_000);
  });

  it("book: tổng = ruột + bìa (hai lookup)", () => {
    const orderSpec = {
      v: 1 as const,
      kind: "book" as const,
      paperSize: "A4",
      body: {
        pages: 10,
        gsm: "80",
        printColor: "bw" as const,
        printSides: "double" as const,
      },
      cover: {
        pages: 2,
        gsm: "80",
        printColor: "color" as const,
      },
      binding: "glue" as const,
    };

    const parts = computeBookPrintBreakdown({
      orderSpec,
      copies: 2,
      pricing: testPricing,
      fallbackPricePerPage: fallback,
    });
    // ruột: 500 × 10 × 2 = 10_000
    expect(parts.bodySubtotal).toBe(10_000);
    // bìa: (500×1.5) × 2 × 2 = 3000
    expect(parts.coverSubtotal).toBe(3000);
    expect(parts.bindingSubtotal).toBe(0);

    const subtotal = computePrintSubtotalForOrder({
      orderSpec,
      totalPages: 12,
      copies: 2,
      printColor: "bw",
      printSides: "double",
      pricing: testPricing,
      fallbackPricePerPage: fallback,
    });
    expect(subtotal).toBe(
      parts.bodySubtotal + parts.coverSubtotal + parts.bindingSubtotal,
    );
    expect(subtotal).toBe(13_000);
  });

  it("book: phí đóng gáy × số bản cộng vào subtotal", () => {
    const pricing: PricingConfigV1 = {
      ...testPricing,
      bindingFeeVnd: {
        spring_metal: 0,
        spring_plastic: 12_000,
        glue: 0,
      },
    };
    const orderSpec = {
      v: 1 as const,
      kind: "book" as const,
      paperSize: "A4",
      body: {
        pages: 1,
        gsm: "80",
        printColor: "bw" as const,
        printSides: "double" as const,
      },
      cover: {
        pages: 1,
        gsm: "80",
        printColor: "bw" as const,
      },
      binding: "spring_plastic" as const,
    };
    const parts = computeBookPrintBreakdown({
      orderSpec,
      copies: 3,
      pricing,
      fallbackPricePerPage: fallback,
    });
    expect(parts.bindingSubtotal).toBe(36_000);
    expect(
      computePrintSubtotalForOrder({
        orderSpec,
        totalPages: 2,
        copies: 3,
        printColor: "bw",
        printSides: "double",
        pricing,
        fallbackPricePerPage: fallback,
      }),
    ).toBe(parts.bodySubtotal + parts.coverSubtotal + parts.bindingSubtotal);
  });
});

describe("computeBookPrintBreakdown", () => {
  it("khớp từng thành phần khi override khác nhau", () => {
    const pricingWithOverrides: PricingConfigV1 = {
      ...testPricing,
      bindingFeeVnd: defaultBindingFeeVnd(),
      overridePerPage: {
        A4: {
          "80": {
            bw: { double: 100 },
            color: { double: 400 },
          },
        },
      },
    };
    const orderSpec = {
      v: 1 as const,
      kind: "book" as const,
      paperSize: "A4",
      body: {
        pages: 3,
        gsm: "80",
        printColor: "bw" as const,
        printSides: "double" as const,
      },
      cover: {
        pages: 1,
        gsm: "80",
        printColor: "color" as const,
      },
      binding: "glue" as const,
    };
    const parts = computeBookPrintBreakdown({
      orderSpec,
      copies: 1,
      pricing: pricingWithOverrides,
      fallbackPricePerPage: fallback,
    });
    expect(parts.bodySubtotal).toBe(300);
    expect(parts.coverSubtotal).toBe(400);
  });
});
