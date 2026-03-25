import { z } from "zod";

import { DELIVERY_CITY, DELIVERY_WARDS } from "@/lib/config/orderForm";
import { FREESHIP_THRESHOLD_VND } from "@/lib/config/business";
import type { BindingType } from "@/lib/orders/printJobSpec";
import {
  BINDING_LABEL,
  BINDING_OPTIONS,
  PAPER_GSM_OPTIONS,
  PAPER_SIZES,
  PRINT_JOB_KIND_LABEL,
  PRINT_JOB_KIND_OPTIONS,
} from "@/lib/orders/printJobSpec";
import { SHIPPING_FEE_DELIVERY } from "@/lib/orders/delivery";

/** Phí đóng gáy mặc định (VNĐ / 1 cuốn) — mọi loại = 0. */
export function defaultBindingFeeVnd(): Record<BindingType, number> {
  return {
    spring_metal: 0,
    spring_plastic: 0,
    glue: 0,
  };
}

/** Pricing hybrid — [docs/APP-ADMIN-SETTINGS-PRICING-PLAN.md](docs/APP-ADMIN-SETTINGS-PRICING-PLAN.md) §5 */
export type PricingConfigV1 = {
  v: 1;
  basePerPageByPaper: Record<string, Record<string, number>>;
  multByColor: { bw: number; color: number };
  multBySides: { double: number; single: number };
  /** Phí đóng gáy sách (VNĐ cho 1 cuốn, nhân theo số bản). */
  bindingFeeVnd: Record<BindingType, number>;
  overridePerPage: Partial<
    Record<
      string,
      Partial<
        Record<
          string,
          Partial<Record<"bw" | "color", Partial<Record<"double" | "single", number>>>>
        >
      >
    >
  >;
};

export type CatalogConfigV1 = {
  v: 1;
  paperSizes: string[];
  gsmOptions: string[];
  bindingOptions: { value: string; label: string }[];
  printJobKindOptions: { value: string; label: string }[];
};

export type DeliveryConfigV1 = {
  v: 1;
  freeshipThresholdVnd: number;
  shippingFeeDelivery: number;
  wards: string[];
  city: string;
};

export type AppConfigV1 = {
  v: 1;
  pricing: PricingConfigV1;
  catalog: CatalogConfigV1;
  delivery: DeliveryConfigV1;
};

const bindingValueSchema = z.enum(["spring_metal", "spring_plastic", "glue"]);
const printJobKindValueSchema = z.enum(["document", "book"]);

export const pricingConfigV1Schema = z.object({
  v: z.literal(1),
  basePerPageByPaper: z.record(
    z.string(),
    z.record(z.string(), z.number().nonnegative()),
  ),
  multByColor: z.object({
    bw: z.number().positive(),
    color: z.number().positive(),
  }),
  multBySides: z.object({
    double: z.number().positive(),
    single: z.number().positive(),
  }),
  bindingFeeVnd: z
    .object({
      spring_metal: z.number().nonnegative(),
      spring_plastic: z.number().nonnegative(),
      glue: z.number().nonnegative(),
    })
    .default({ spring_metal: 0, spring_plastic: 0, glue: 0 }),
  overridePerPage: z.record(z.string(), z.unknown()).optional().default({}),
});

export const catalogConfigV1Schema = z.object({
  v: z.literal(1),
  paperSizes: z.array(z.string().min(1)).min(1),
  gsmOptions: z.array(z.string().min(1)).min(1),
  bindingOptions: z
    .array(
      z.object({
        value: bindingValueSchema,
        label: z.string().min(1),
      }),
    )
    .min(1),
  printJobKindOptions: z
    .array(
      z.object({
        value: printJobKindValueSchema,
        label: z.string().min(1),
      }),
    )
    .min(1),
});

export const deliveryConfigV1Schema = z.object({
  v: z.literal(1),
  freeshipThresholdVnd: z.number().nonnegative(),
  shippingFeeDelivery: z.number().nonnegative(),
  wards: z.array(z.string().min(1)).min(1),
  city: z.string().min(1),
});

/** Parse JSON DB trước khi merge catalog/delivery mặc định. */
const appConfigFromDbSchema = z.object({
  v: z.literal(1),
  pricing: pricingConfigV1Schema,
  catalog: catalogConfigV1Schema.optional(),
  delivery: deliveryConfigV1Schema.optional(),
});

export function defaultCatalogConfig(): CatalogConfigV1 {
  return {
    v: 1,
    paperSizes: [...PAPER_SIZES],
    gsmOptions: [...PAPER_GSM_OPTIONS],
    bindingOptions: BINDING_OPTIONS.map((value) => ({
      value,
      label: BINDING_LABEL[value],
    })),
    printJobKindOptions: PRINT_JOB_KIND_OPTIONS.map((value) => ({
      value,
      label: PRINT_JOB_KIND_LABEL[value],
    })),
  };
}

export function defaultDeliveryConfig(): DeliveryConfigV1 {
  return {
    v: 1,
    freeshipThresholdVnd: FREESHIP_THRESHOLD_VND,
    shippingFeeDelivery: SHIPPING_FEE_DELIVERY,
    wards: [...DELIVERY_WARDS],
    city: DELIVERY_CITY,
  };
}

function assertPricingMatchesCatalog(app: AppConfigV1): void {
  const { pricing, catalog } = app;
  const papers = new Set(catalog.paperSizes);
  const gsms = new Set(catalog.gsmOptions);
  for (const paper of Object.keys(pricing.basePerPageByPaper)) {
    if (!papers.has(paper)) {
      throw new Error(
        `basePerPageByPaper có khổ "${paper}" không có trong catalog.paperSizes.`,
      );
    }
    const row = pricing.basePerPageByPaper[paper]!;
    for (const gsm of Object.keys(row)) {
      if (!gsms.has(gsm)) {
        throw new Error(
          `basePerPageByPaper["${paper}"] có gsm "${gsm}" không có trong catalog.gsmOptions.`,
        );
      }
    }
  }
}

/**
 * Chuẩn hóa cấu hình từ DB hoặc PATCH: luôn có catalog + delivery;
 * kiểm tra khổ/gsm trong bảng giá ⊆ catalog.
 */
export function normalizeAppConfig(raw: unknown): AppConfigV1 {
  const parsed = appConfigFromDbSchema.parse(raw);
  const catalog = parsed.catalog ?? defaultCatalogConfig();
  const delivery = parsed.delivery ?? defaultDeliveryConfig();
  const app: AppConfigV1 = {
    v: 1,
    pricing: parsed.pricing as PricingConfigV1,
    catalog,
    delivery,
  };
  assertPricingMatchesCatalog(app);
  return app;
}

/** @deprecated Dùng normalizeAppConfig */
export function parseAppConfigFromDb(raw: unknown): AppConfigV1 {
  return normalizeAppConfig(raw);
}

export const appConfigV1Schema = z
  .object({
    v: z.literal(1),
    pricing: pricingConfigV1Schema,
    catalog: catalogConfigV1Schema,
    delivery: deliveryConfigV1Schema,
  })
  .superRefine((data, ctx) => {
    try {
      assertPricingMatchesCatalog(data as AppConfigV1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    }
  });

/** Seed runtime: lưới base theo catalog (hoặc mặc định). */
export function fullGridPricingConfigFallback(
  pricePerPage: number,
  catalog?: CatalogConfigV1,
): PricingConfigV1 {
  const cat = catalog ?? defaultCatalogConfig();
  const gsm: Record<string, number> = {};
  for (const g of cat.gsmOptions) {
    gsm[g] = pricePerPage;
  }
  const basePerPageByPaper: Record<string, Record<string, number>> = {};
  for (const sz of cat.paperSizes) {
    basePerPageByPaper[sz] = { ...gsm };
  }
  return {
    v: 1,
    basePerPageByPaper,
    /** Khớp §4.1 APP-ADMIN-SETTINGS-PRICING-PLAN — admin có thể chỉnh trong Settings. */
    multByColor: { bw: 1, color: 1.5 },
    multBySides: { double: 1, single: 0.8 },
    bindingFeeVnd: defaultBindingFeeVnd(),
    overridePerPage: {},
  };
}

const OVERRIDE_COLORS = ["bw", "color"] as const;
const OVERRIDE_SIDES = ["double", "single"] as const;

/** Gán giá override cho mỗi ô (màu×mặt) chưa có số hợp lệ = round(base × mult). */
export function applyMultOverridesToEmptyCells(
  pricing: PricingConfigV1,
): PricingConfigV1 {
  const override = JSON.parse(
    JSON.stringify(pricing.overridePerPage ?? {}),
  ) as Record<string, Record<string, Record<string, Record<string, number>>>>;

  for (const [paper, row] of Object.entries(pricing.basePerPageByPaper)) {
    for (const [gsm, base] of Object.entries(row)) {
      if (typeof base !== "number" || !Number.isFinite(base)) continue;
      for (const color of OVERRIDE_COLORS) {
        for (const side of OVERRIDE_SIDES) {
          const cur = override[paper]?.[gsm]?.[color]?.[side];
          if (
            cur != null &&
            typeof cur === "number" &&
            Number.isFinite(cur) &&
            cur >= 0
          ) {
            continue;
          }
          const mult =
            pricing.multByColor[color] * pricing.multBySides[side];
          const val = Math.round(base * mult);
          if (!override[paper]) override[paper] = {};
          if (!override[paper][gsm]) override[paper][gsm] = {};
          if (!override[paper][gsm][color]) override[paper][gsm][color] = {};
          override[paper][gsm][color][side] = val;
        }
      }
    }
  }
  return { ...pricing, overridePerPage: override };
}

/**
 * Ghi đè mọi ô trong `overridePerPage` theo `round(base × multByColor × multBySides)`
 * cho từng khổ/gsm trong `basePerPageByPaper`.
 * Dùng khi đã có ô cũ (vd. toàn 500) — {@link applyMultOverridesToEmptyCells} sẽ không sửa ô đã có số.
 */
export function recomputeOverridePerPageFromBaseMult(
  pricing: PricingConfigV1,
): PricingConfigV1 {
  const override: Record<
    string,
    Record<string, Record<string, Record<string, number>>>
  > = {};

  for (const [paper, row] of Object.entries(pricing.basePerPageByPaper)) {
    for (const [gsm, base] of Object.entries(row)) {
      if (typeof base !== "number" || !Number.isFinite(base)) continue;
      for (const color of OVERRIDE_COLORS) {
        for (const side of OVERRIDE_SIDES) {
          const mult =
            pricing.multByColor[color] * pricing.multBySides[side];
          const val = Math.round(base * mult);
          if (!override[paper]) override[paper] = {};
          if (!override[paper][gsm]) override[paper][gsm] = {};
          if (!override[paper][gsm][color]) override[paper][gsm][color] = {};
          override[paper][gsm][color][side] = val;
        }
      }
    }
  }
  return { ...pricing, overridePerPage: override };
}
