import type { Dispatch, SetStateAction } from "react";
import type { AppConfigV1 } from "@/lib/config/appConfigSchema";

export type AdminSettingsTabId = "pricing" | "catalog" | "delivery";

export type AdminSettingsPricingTabProps = {
  config: AppConfigV1;
  setConfig: Dispatch<SetStateAction<AppConfigV1 | null>>;
  overrideJsonError: string | null;
  setOverrideJsonError: Dispatch<SetStateAction<string | null>>;
  onApplyMults: () => void;
  onRecomputeAllOverrides: () => void;
};

export type AdminSettingsCatalogTabProps = {
  config: AppConfigV1;
  setConfig: Dispatch<SetStateAction<AppConfigV1 | null>>;
};

export type AdminSettingsDeliveryTabProps = AdminSettingsCatalogTabProps;
