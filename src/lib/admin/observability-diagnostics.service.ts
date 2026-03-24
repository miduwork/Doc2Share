import { clampInt, pickSingle } from "../search-params.ts";
import {
  DEFAULT_OBSERVABILITY_FILTERS,
  getPresetDefaults,
  resolveObservabilityDirection,
  resolveObservabilityPreset,
  resolveObservabilitySeverity,
  resolveObservabilitySource,
  resolveObservabilityWindow,
  type ObservabilityFilterInput,
  type ObservabilitySignedPayload,
} from "@/features/admin/observability/filters/model/filters.types";
import { signDiagnosticsPayload, verifyDiagnosticsPayload } from "../diagnostics-signature.ts";

type ShareInput = ObservabilityFilterInput & {
  share_exp?: string | string[];
};

type BuildSignedPayloadOptions = {
  input?: ShareInput;
  fallbackExportLimit?: string;
};

export function buildObservabilitySignedPayload({
  input,
  fallbackExportLimit,
}: BuildSignedPayloadOptions): ObservabilitySignedPayload {
  const selectedPreset = resolveObservabilityPreset(pickSingle(input?.preset, DEFAULT_OBSERVABILITY_FILTERS.preset));
  const presetDefaults = getPresetDefaults(selectedPreset);

  const selectedWindow = resolveObservabilityWindow(pickSingle(input?.window, presetDefaults.window));
  const selectedSeverity = resolveObservabilitySeverity(pickSingle(input?.severity, presetDefaults.severity));
  const selectedSource = resolveObservabilitySource(pickSingle(input?.source, presetDefaults.source));
  const selectedEventType = pickSingle(input?.event_type, presetDefaults.eventType);
  const selectedAlertsDir = resolveObservabilityDirection(
    pickSingle(input?.alerts_dir, DEFAULT_OBSERVABILITY_FILTERS.alertsDirection)
  );
  const selectedRunsPage = clampInt(pickSingle(input?.runs_page, DEFAULT_OBSERVABILITY_FILTERS.runsPage), 1, 99999, 1);
  const selectedAlertsPageSize = clampInt(
    pickSingle(input?.alerts_page_size, DEFAULT_OBSERVABILITY_FILTERS.alertsPageSize),
    10,
    100,
    20
  );
  const selectedRunsPageSize = clampInt(
    pickSingle(input?.runs_page_size, DEFAULT_OBSERVABILITY_FILTERS.runsPageSize),
    10,
    100,
    20
  );
  const selectedExportLimit = clampInt(
    pickSingle(input?.export_limit, fallbackExportLimit ?? DEFAULT_OBSERVABILITY_FILTERS.exportLimit),
    100,
    10000,
    2000
  );

  return {
    preset: selectedPreset,
    window: selectedWindow,
    severity: selectedSeverity,
    source: selectedSource,
    event_type: selectedEventType,
    alerts_cursor: pickSingle(input?.alerts_cursor, DEFAULT_OBSERVABILITY_FILTERS.alertsCursor),
    alerts_dir: selectedAlertsDir,
    alerts_page: pickSingle(input?.alerts_page, DEFAULT_OBSERVABILITY_FILTERS.alertsPage),
    runs_page: String(selectedRunsPage),
    alerts_page_size: String(selectedAlertsPageSize),
    runs_page_size: String(selectedRunsPageSize),
    export_limit: String(selectedExportLimit),
    share_exp: pickSingle(input?.share_exp, ""),
  };
}

export function createObservabilityShareSignature({
  payload,
  secret,
}: {
  payload: ObservabilitySignedPayload;
  secret?: string;
}): string {
  const resolvedSecret = secret ?? process.env.DIAGNOSTICS_SHARE_SECRET;
  if (!resolvedSecret) {
    throw new Error("Missing DIAGNOSTICS_SHARE_SECRET");
  }
  return signDiagnosticsPayload(payload, resolvedSecret);
}

export function isObservabilityShareSignatureValid({
  payload,
  shareSig,
  secret,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
}: {
  payload: ObservabilitySignedPayload;
  shareSig: string;
  secret?: string;
  nowEpochSeconds?: number;
}): boolean {
  const resolvedSecret = secret ?? process.env.DIAGNOSTICS_SHARE_SECRET;
  if (!resolvedSecret || !payload.share_exp || !shareSig) return false;
  if (Number(payload.share_exp) <= nowEpochSeconds) return false;
  return verifyDiagnosticsPayload(payload, shareSig, resolvedSecret);
}
