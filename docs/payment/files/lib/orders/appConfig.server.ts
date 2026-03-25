import type { SupabaseClient } from "@supabase/supabase-js";

import { getFreeshipHintText } from "@/lib/config/business";
import type { AppConfigV1, PricingConfigV1 } from "@/lib/config/appConfigSchema";
import {
  defaultCatalogConfig,
  defaultDeliveryConfig,
  fullGridPricingConfigFallback,
  normalizeAppConfig,
} from "@/lib/config/appConfigSchema";
import type { PublicAppConfigV1 } from "@/lib/config/publicAppConfig";
import { publicConfig } from "@/lib/config/public";
import { createAdminClient } from "@/lib/supabase/admin";

function fallbackAppConfig(): AppConfigV1 {
  const catalog = defaultCatalogConfig();
  const delivery = defaultDeliveryConfig();
  return {
    v: 1,
    pricing: fullGridPricingConfigFallback(publicConfig.pricePerPage, catalog),
    catalog,
    delivery,
  };
}

export async function loadNormalizedAppConfigForOrder(
  supabase: SupabaseClient,
): Promise<{ app: AppConfigV1 }> {
  const row = await selectAppConfigRow(supabase);
  if (row.error || row.config == null) {
    console.warn(
      "[app_config] Không đọc được config, dùng fallback env:",
      row.error?.message,
    );
    return { app: fallbackAppConfig() };
  }
  try {
    return { app: normalizeAppConfig(row.config) };
  } catch (e) {
    console.warn("[app_config] Parse JSON lỗi, dùng fallback env:", e);
    return { app: fallbackAppConfig() };
  }
}

export async function loadPricingConfigForOrder(
  supabase: SupabaseClient,
): Promise<{ pricing: PricingConfigV1 }> {
  const { app } = await loadNormalizedAppConfigForOrder(supabase);
  return { pricing: app.pricing };
}

export async function getPublicAppConfig(): Promise<PublicAppConfigV1> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle();

  let app: AppConfigV1;
  if (!error && data?.config != null) {
    try {
      app = normalizeAppConfig(data.config);
    } catch {
      app = fallbackAppConfig();
    }
  } else {
    app = fallbackAppConfig();
  }

  return {
    v: app.v,
    pricing: app.pricing,
    catalog: {
      paperSizes: app.catalog.paperSizes,
      gsmOptions: app.catalog.gsmOptions,
      bindingOptions: app.catalog.bindingOptions,
      printJobKindOptions: app.catalog.printJobKindOptions,
    },
    delivery: {
      freeshipThresholdVnd: app.delivery.freeshipThresholdVnd,
      shippingFeeDelivery: app.delivery.shippingFeeDelivery,
      wards: app.delivery.wards,
      city: app.delivery.city,
      hint: getFreeshipHintText(app.delivery.freeshipThresholdVnd),
    },
  };
}

async function selectAppConfigRow(
  supabase: SupabaseClient,
): Promise<
  | { config: unknown; error: null }
  | { config: null; error: { message: string } }
> {
  const { data, error } = await supabase
    .from("app_config")
    .select("config, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return { config: null, error: { message: error.message } };
  }
  if (data == null || data.config == null) {
    return { config: null, error: { message: "Không có dòng app_config." } };
  }
  return { config: data.config, error: null };
}

export async function getAppConfigForAdmin(): Promise<
  | { ok: true; config: AppConfigV1; updatedAt: string }
  | { ok: false; message: string }
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("config, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (data == null || data.config == null) {
    return { ok: false, message: "Chưa có cấu hình (app_config)." };
  }
  try {
    const config = normalizeAppConfig(data.config);
    return {
      ok: true,
      config,
      updatedAt: data.updated_at,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `JSON không hợp lệ: ${msg}` };
  }
}

export async function updateAppConfig(
  config: unknown,
): Promise<
  | { ok: true; config: AppConfigV1; updatedAt: string }
  | { ok: false; message: string }
> {
  let parsed: AppConfigV1;
  try {
    parsed = normalizeAppConfig(config);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_config")
    .update({ config: parsed })
    .eq("id", 1)
    .select("config, updated_at")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (data == null || data.config == null) {
    return { ok: false, message: "Cập nhật thất bại (không trả dòng)." };
  }
  try {
    const next = normalizeAppConfig(data.config);
    return { ok: true, config: next, updatedAt: data.updated_at };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
