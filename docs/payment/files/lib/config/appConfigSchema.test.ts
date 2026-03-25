import { describe, it, expect } from "vitest";

import {
  appConfigV1Schema,
  normalizeAppConfig,
  recomputeOverridePerPageFromBaseMult,
} from "./appConfigSchema";

const minimalPricingOnly = {
  v: 1,
  pricing: {
    v: 1,
    basePerPageByPaper: {
      A4: { "80": 500 },
    },
    multByColor: { bw: 1, color: 1 },
    multBySides: { double: 1, single: 1 },
    bindingFeeVnd: {
      spring_metal: 0,
      spring_plastic: 0,
      glue: 0,
    },
    overridePerPage: {},
  },
};

describe("normalizeAppConfig", () => {
  it("merges catalog and delivery when missing", () => {
    const n = normalizeAppConfig(minimalPricingOnly);
    expect(n.catalog.paperSizes).toContain("A4");
    expect(n.delivery.city.length).toBeGreaterThan(0);
    expect(n.pricing.basePerPageByPaper.A4?.["80"]).toBe(500);
  });

  it("rejects base paper not in merged catalog", () => {
    expect(() =>
      normalizeAppConfig({
        ...minimalPricingOnly,
        pricing: {
          ...minimalPricingOnly.pricing,
          basePerPageByPaper: { Z9: { "80": 1 } },
        },
      }),
    ).toThrow(/catalog/);
  });
});

describe("recomputeOverridePerPageFromBaseMult", () => {
  it("overwrites every cell from base × mult (not only empty)", () => {
    const pricing = {
      v: 1 as const,
      basePerPageByPaper: { A4: { "80": 500 } },
      multByColor: { bw: 1, color: 1.2 },
      multBySides: { double: 1, single: 1.75 },
      bindingFeeVnd: {
        spring_metal: 0,
        spring_plastic: 0,
        glue: 0,
      },
      overridePerPage: {
        A4: {
          "80": {
            bw: { double: 500, single: 500 },
            color: { double: 500, single: 500 },
          },
        },
      },
    };
    const next = recomputeOverridePerPageFromBaseMult(pricing);
    expect(next.overridePerPage.A4?.["80"]?.bw?.double).toBe(500);
    expect(next.overridePerPage.A4?.["80"]?.bw?.single).toBe(875);
    expect(next.overridePerPage.A4?.["80"]?.color?.double).toBe(600);
    expect(next.overridePerPage.A4?.["80"]?.color?.single).toBe(1050);
  });
});

describe("appConfigV1Schema", () => {
  it("accepts full config", () => {
    const full = normalizeAppConfig(minimalPricingOnly);
    const r = appConfigV1Schema.parse(full);
    expect(r.pricing.v).toBe(1);
  });

  it("rejects wrong top-level v", () => {
    const full = normalizeAppConfig(minimalPricingOnly);
    expect(() =>
      appConfigV1Schema.parse({ ...full, v: 2 as 1 }),
    ).toThrow();
  });
});
