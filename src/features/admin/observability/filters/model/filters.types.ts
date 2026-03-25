export const OBSERVABILITY_PRESETS = [
  "incident",
  "webhook-errors",
  "secure-document-access-blocked",
  "reader-watermark-degraded",
  "document-pipeline",
  "custom",
] as const;

export const OBSERVABILITY_WINDOWS = ["1h", "6h", "24h", "7d"] as const;
export const OBSERVABILITY_SEVERITIES = ["all", "info", "warn", "error"] as const;
export const OBSERVABILITY_DIRECTIONS = ["next", "prev"] as const;

export const OBSERVABILITY_SOURCE_OPTIONS = [
  "all",
  "next.reader",
  "db.alerts",
  "db.document_lifecycle",
  "db.maintenance",
  "edge.payment_webhook",
  "edge.get_secure_link",
] as const;

export type ObservabilityPreset = (typeof OBSERVABILITY_PRESETS)[number];
export type ObservabilityWindow = (typeof OBSERVABILITY_WINDOWS)[number];
export type ObservabilitySeverity = (typeof OBSERVABILITY_SEVERITIES)[number];
export type ObservabilityDirection = (typeof OBSERVABILITY_DIRECTIONS)[number];
export type ObservabilitySource = (typeof OBSERVABILITY_SOURCE_OPTIONS)[number];
export type ObservabilityEventType = "all" | string;

export type ObservabilityFilterInput = {
  preset?: string | string[];
  window?: string | string[];
  severity?: string | string[];
  source?: string | string[];
  event_type?: string | string[];
  alerts_cursor?: string | string[];
  alerts_dir?: string | string[];
  alerts_page?: string | string[];
  runs_page?: string | string[];
  alerts_page_size?: string | string[];
  runs_page_size?: string | string[];
  export_limit?: string | string[];
};

export type ObservabilityFilterState = {
  preset: ObservabilityPreset;
  window: ObservabilityWindow;
  severity: ObservabilitySeverity;
  source: ObservabilitySource;
  eventType: ObservabilityEventType;
  alertsCursor: string;
  alertsDirection: ObservabilityDirection;
  alertsPage: string;
  runsPage: string;
  alertsPageSize: string;
  runsPageSize: string;
  exportLimit: string;
};

export type ObservabilitySignedPayload = {
  preset: ObservabilityPreset;
  window: ObservabilityWindow;
  severity: ObservabilitySeverity;
  source: ObservabilitySource;
  event_type: string;
  alerts_cursor: string;
  alerts_dir: ObservabilityDirection;
  alerts_page: string;
  runs_page: string;
  alerts_page_size: string;
  runs_page_size: string;
  export_limit: string;
  share_exp: string;
};

export const DEFAULT_OBSERVABILITY_FILTERS: ObservabilityFilterState = {
  preset: "custom",
  window: "24h",
  severity: "all",
  source: "all",
  eventType: "all",
  alertsCursor: "",
  alertsDirection: "next",
  alertsPage: "1",
  runsPage: "1",
  alertsPageSize: "20",
  runsPageSize: "20",
  exportLimit: "2000",
};

type ObservabilityPresetDefaults = Pick<
  ObservabilityFilterState,
  "window" | "severity" | "source" | "eventType"
>;

export const PRESET_DEFAULTS_MAP: Record<ObservabilityPreset, ObservabilityPresetDefaults> = {
  incident: { window: "24h", severity: "error", source: "all", eventType: "all" },
  "webhook-errors": { window: "24h", severity: "error", source: "edge.payment_webhook", eventType: "all" },
  "secure-document-access-blocked": { window: "24h", severity: "all", source: "edge.get_secure_link", eventType: "blocked" },
  "reader-watermark-degraded": {
    window: "24h",
    severity: "warn",
    source: "next.reader",
    eventType: "watermark_degraded_fallback",
  },
  "document-pipeline": { window: "24h", severity: "all", source: "db.document_lifecycle", eventType: "pipeline_tick" },
  custom: { window: "24h", severity: "all", source: "all", eventType: "all" },
};

export function isObservabilityPreset(value: string): value is ObservabilityPreset {
  return OBSERVABILITY_PRESETS.includes(value as ObservabilityPreset);
}

export function isObservabilityWindow(value: string): value is ObservabilityWindow {
  return OBSERVABILITY_WINDOWS.includes(value as ObservabilityWindow);
}

export function isObservabilitySeverity(value: string): value is ObservabilitySeverity {
  return OBSERVABILITY_SEVERITIES.includes(value as ObservabilitySeverity);
}

export function isObservabilitySource(value: string): value is ObservabilitySource {
  return OBSERVABILITY_SOURCE_OPTIONS.includes(value as ObservabilitySource);
}

export function isObservabilityDirection(value: string): value is ObservabilityDirection {
  return OBSERVABILITY_DIRECTIONS.includes(value as ObservabilityDirection);
}

export function resolveObservabilityPreset(value: string): ObservabilityPreset {
  if (value === "secure-link-blocked") return "secure-document-access-blocked";
  return isObservabilityPreset(value) ? value : DEFAULT_OBSERVABILITY_FILTERS.preset;
}

export function getPresetDefaults(preset: ObservabilityPreset): ObservabilityPresetDefaults {
  return PRESET_DEFAULTS_MAP[preset];
}

export function resolveObservabilityWindow(value: string): ObservabilityWindow {
  return isObservabilityWindow(value) ? value : DEFAULT_OBSERVABILITY_FILTERS.window;
}

export function resolveObservabilitySeverity(value: string): ObservabilitySeverity {
  return isObservabilitySeverity(value) ? value : DEFAULT_OBSERVABILITY_FILTERS.severity;
}

export function resolveObservabilitySource(value: string): ObservabilitySource {
  return isObservabilitySource(value) ? value : DEFAULT_OBSERVABILITY_FILTERS.source;
}

export function resolveObservabilityDirection(value: string): ObservabilityDirection {
  return isObservabilityDirection(value) ? value : DEFAULT_OBSERVABILITY_FILTERS.alertsDirection;
}
