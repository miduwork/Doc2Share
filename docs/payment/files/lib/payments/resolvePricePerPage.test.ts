import { describe, it, expect, vi, afterEach } from "vitest";

import {
  defaultBindingFeeVnd,
  type PricingConfigV1,
} from "@/lib/config/appConfigSchema";

import { resolvePricePerPage } from "./resolvePricePerPage";

function basePricing(overrides: Partial<PricingConfigV1> = {}): PricingConfigV1 {
  return {
    v: 1,
    basePerPageByPaper: {
      A4: { "80": 500 },
    },
    multByColor: { bw: 1, color: 1.5 },
    multBySides: { double: 1, single: 0.8 },
    bindingFeeVnd: defaultBindingFeeVnd(),
    overridePerPage: {},
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolvePricePerPage", () => {
  it("uses override as final price without mult", () => {
    const pricing = basePricing({
      overridePerPage: {
        A4: {
          "80": { color: { double: 900 } },
        },
      },
    });
    expect(
      resolvePricePerPage({
        paperSize: "A4",
        gsm: "80",
        color: "color",
        sides: "double",
        pricing,
        fallbackPricePerPage: 1,
      }),
    ).toBe(900);
  });

  it("multiplies base by color and sides when no override", () => {
    const pricing = basePricing();
    expect(
      resolvePricePerPage({
        paperSize: "A4",
        gsm: "80",
        color: "color",
        sides: "single",
        pricing,
        fallbackPricePerPage: 1,
      }),
    ).toBe(Math.round(500 * 1.5 * 0.8));
  });

  it("warns and uses fallback × mult when base missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pricing = basePricing({ basePerPageByPaper: {} });
    expect(
      resolvePricePerPage({
        paperSize: "A4",
        gsm: "80",
        color: "color",
        sides: "single",
        pricing,
        fallbackPricePerPage: 777,
      }),
    ).toBe(Math.round(777 * 1.5 * 0.8));
    expect(warn).toHaveBeenCalled();
  });

  it("trims paper/gsm keys so lookup matches admin JSON", () => {
    const pricing = basePricing();
    expect(
      resolvePricePerPage({
        paperSize: " A4 ",
        gsm: " 80 ",
        color: "bw",
        sides: "double",
        pricing,
        fallbackPricePerPage: 1,
      }),
    ).toBe(500);
  });
});
