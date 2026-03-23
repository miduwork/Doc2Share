import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyDiagnosticsPayload } from "@/lib/diagnostics-signature";
import type {
  CapacityRow,
  LatestRunAlertItem,
  MaintenanceRow,
  MetricRow,
  ObservabilityPageData,
  ObservabilitySearchParams,
} from "./types";
import { OBSERVABILITY_SOURCE_OPTIONS } from "./observability-constants";
import {
  clampInt,
  fetchAlertsByCursor,
  getPresetDefaults,
  getSinceIso,
  pickSingle,
  toQueryString,
} from "./utils";

export async function loadObservabilityPageData(
  supabase: SupabaseClient,
  searchParams?: ObservabilitySearchParams
): Promise<ObservabilityPageData> {
  const selectedPresetRaw = pickSingle(searchParams?.preset, "custom");
  const selectedPreset = ["incident", "webhook-errors", "secure-link-blocked", "document-pipeline", "custom"].includes(
    selectedPresetRaw
  )
    ? selectedPresetRaw
    : "custom";

  const presetDefaults = getPresetDefaults(selectedPreset);
  const selectedWindow = pickSingle(searchParams?.window, presetDefaults.window);
  const selectedSeverity = pickSingle(searchParams?.severity, presetDefaults.severity);
  const selectedSource = pickSingle(searchParams?.source, presetDefaults.source);
  const selectedEventType = pickSingle(searchParams?.event_type, presetDefaults.eventType);
  const alertsCursor = pickSingle(searchParams?.alerts_cursor, "");
  const alertsDir = pickSingle(searchParams?.alerts_dir, "next") === "prev" ? "prev" : "next";
  const alertsPageSize = clampInt(pickSingle(searchParams?.alerts_page_size, "20"), 10, 100, 20);
  const runsPageSize = clampInt(pickSingle(searchParams?.runs_page_size, "20"), 10, 100, 20);
  const runsPage = clampInt(pickSingle(searchParams?.runs_page, "1"), 1, 99999, 1);
  const exportLimit = clampInt(pickSingle(searchParams?.export_limit, "2000"), 100, 10000, 2000);
  const shareExp = pickSingle(searchParams?.share_exp, "");
  const shareSig = pickSingle(searchParams?.share_sig, "");
  const sinceIso = getSinceIso(selectedWindow);
  const signedPayload = {
    preset: selectedPreset,
    window: selectedWindow,
    severity: selectedSeverity,
    source: selectedSource,
    event_type: selectedEventType,
    alerts_cursor: alertsCursor,
    alerts_dir: alertsDir,
    alerts_page: "1",
    runs_page: String(runsPage),
    alerts_page_size: String(alertsPageSize),
    runs_page_size: String(runsPageSize),
    export_limit: String(exportLimit),
    share_exp: shareExp,
  };
  const diagnosticsSecret = process.env.DIAGNOSTICS_SHARE_SECRET;
  const signedLinkValid =
    Boolean(shareExp && shareSig && diagnosticsSecret) &&
    Number(shareExp) > Math.floor(Date.now() / 1000) &&
    verifyDiagnosticsPayload(signedPayload, shareSig, diagnosticsSecret as string);

  const [
    metricsRes,
    capacityRes,
    runsRes,
    alertsCursorRes,
    eventTypesRes,
    pipelineQueuedRes,
    pipelineProcessingRes,
    pipelineFailedRes,
  ] = await Promise.all([
    supabase.from("observability_metrics_24h").select("*").limit(1).maybeSingle(),
    supabase.from("backend_capacity_overview").select("*"),
    supabase
      .from("backend_maintenance_runs")
      .select(
        "id, started_at, finished_at, triggered_by, success, alerts_count, access_deleted, security_deleted, observability_deleted, webhook_deleted, details",
        { count: "exact" }
      )
      .order("started_at", { ascending: false })
      .range((runsPage - 1) * runsPageSize, runsPage * runsPageSize - 1),
    fetchAlertsByCursor({
      supabase,
      sinceIso,
      severity: selectedSeverity,
      source: selectedSource,
      eventType: selectedEventType,
      pageSize: alertsPageSize,
      cursor: alertsCursor,
      direction: alertsDir,
    }),
    supabase.from("observability_events").select("event_type").order("created_at", { ascending: false }).limit(300),
    supabase.from("document_processing_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("document_processing_jobs").select("id", { count: "exact", head: true }).eq("status", "processing"),
    supabase.from("document_processing_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const pipelineQueued = pipelineQueuedRes.count ?? 0;
  const pipelineProcessing = pipelineProcessingRes.count ?? 0;
  const pipelineFailed = pipelineFailedRes.count ?? 0;

  const metrics = (metricsRes.data as MetricRow | null) ?? null;
  const capacityRows = (capacityRes.data as CapacityRow[] | null) ?? [];
  const runs = (runsRes.data as MaintenanceRow[] | null) ?? [];
  const runsTotal = runsRes.count ?? 0;
  const runsTotalPages = Math.max(1, Math.ceil(runsTotal / runsPageSize));
  const eventTypeRows = (eventTypesRes.data as Array<{ event_type: string | null }> | null) ?? [];

  const latestRunAlerts = (runs[0]?.details?.alerts as LatestRunAlertItem[] | undefined) ?? [];

  const sourceOptions = [...OBSERVABILITY_SOURCE_OPTIONS];
  const eventTypeOptions = [
    "all",
    ...Array.from(
      new Set(
        eventTypeRows
          .map((row) => row.event_type)
          .filter((v): v is string => Boolean(v))
      )
    ),
  ];

  const baseFilters = {
    preset: selectedPreset,
    window: selectedWindow,
    severity: selectedSeverity,
    source: selectedSource,
    event_type: selectedEventType,
    alerts_cursor: alertsCursor,
    alerts_dir: alertsDir,
    alerts_page: "1",
    runs_page: String(runsPage),
    alerts_page_size: String(alertsPageSize),
    runs_page_size: String(runsPageSize),
    export_limit: String(exportLimit),
  };

  const alertsExportHref = `/admin/observability/export/alerts?${toQueryString({
    preset: selectedPreset,
    window: selectedWindow,
    severity: selectedSeverity,
    source: selectedSource,
    event_type: selectedEventType,
    limit: String(exportLimit),
    alerts_cursor: alertsCursor,
    alerts_dir: alertsDir,
    export_limit: String(exportLimit),
    ...(shareExp ? { share_exp: shareExp } : {}),
    ...(shareSig ? { share_sig: shareSig } : {}),
  })}`;

  const runsExportHref = `/admin/observability/export/maintenance?${toQueryString({
    preset: selectedPreset,
    limit: String(exportLimit),
    window: selectedWindow,
    severity: selectedSeverity,
    source: selectedSource,
    event_type: selectedEventType,
    alerts_cursor: alertsCursor,
    alerts_dir: alertsDir,
    export_limit: String(exportLimit),
    ...(shareExp ? { share_exp: shareExp } : {}),
    ...(shareSig ? { share_sig: shareSig } : {}),
  })}`;

  return {
    selectedPreset,
    selectedWindow,
    selectedSeverity,
    selectedSource,
    selectedEventType,
    alertsCursor,
    alertsDir,
    alertsPageSize,
    runsPageSize,
    runsPage,
    exportLimit,
    shareExp,
    shareSig,
    signedLinkValid,
    metrics,
    capacityRows,
    runs,
    runsTotal,
    runsTotalPages,
    alertsCursorResult: {
      items: alertsCursorRes.items,
      nextCursor: alertsCursorRes.nextCursor,
      prevCursor: alertsCursorRes.prevCursor,
    },
    pipelineQueued,
    pipelineProcessing,
    pipelineFailed,
    sourceOptions,
    eventTypeOptions,
    latestRunAlerts,
    baseFilters,
    alertsExportHref,
    runsExportHref,
  };
}
