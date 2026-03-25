import type { PricingConfigV1 } from "@/lib/config/appConfigSchema";

/** Payload GET /api/public/config — không chứa secret. */
export type PublicAppConfigV1 = {
  v: 1;
  pricing: PricingConfigV1;
  catalog: {
    paperSizes: string[];
    gsmOptions: string[];
    bindingOptions: { value: string; label: string }[];
    printJobKindOptions: { value: string; label: string }[];
  };
  delivery: {
    freeshipThresholdVnd: number;
    shippingFeeDelivery: number;
    wards: string[];
    city: string;
    hint: string;
  };
};
