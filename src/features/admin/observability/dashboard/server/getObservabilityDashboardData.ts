import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_OBSERVABILITY_FILTERS,
  OBSERVABILITY_SOURCE_OPTIONS,
  type ObservabilityDirection,
  type ObservabilityPreset,
  type ObservabilitySeverity,
  type ObservabilitySignedPayload,
  type ObservabilitySource,
  type ObservabilityWindow,
} from "@/features/admin/observability/filters/model/filters.types";
import type {
  AlertsCursorPageResult,
  AlertsSectionViewModel,
  CapacityRow,
  LatestRunAlertItem,
  MaintenanceRow,
  MetricRow,
  ObservabilityPageData,
  ObservabilitySearchParams,
} from "@/features/admin/observability/dashboard/model/dashboard.types";
import { clampInt, pickSingle } from "@/lib/search-params";
import { fetchAlertsByCursor } from "@/features/admin/observability/alerts/server/fetchAlertsByCursor";
import { getSinceIso } from "@/features/admin/observability/shared/formatters";
import { toQueryString } from "@/features/admin/observability/shared/query-string";
import {
  buildObservabilitySignedPayload,
  isObservabilityShareSignatureValid,
} from "@/lib/admin/observability-diagnostics.service";
import { buildObservabilityHeaderViewModel, buildObservabilitySectionViewModels } from "@/features/admin/observability/section-view-models";

type ParsedObservabilityFilters = {
  selectedPreset: ObservabilityPreset;
  selectedWindow: ObservabilityWindow;
  selectedSeverity: ObservabilitySeverity;
  selectedSource: ObservabilitySource;
  selectedEventType: string;
  alertsCursor: string;
  alertsDir: ObservabilityDirection;
  alertsPageSize: number;
  runsPageSize: number;
  runsPage: number;
  exportLimit: number;
  shareExp: string;
  shareSig: string;
  sinceIso: string | null;
  signedPayload: ObservabilitySignedPayload;
};

type FetchedObservabilityRows = {
  metrics: MetricRow | null;
  capacityRows: CapacityRow[];
  runs: MaintenanceRow[];
  runsTotal: number;
  runsTotalPages: number;
  alertsCursorResult: AlertsCursorPageResult;
  pipelineQueued: number;
  pipelineProcessing: number;
  pipelineFailed: number;
  sourceOptions: string[];
  eventTypeOptions: string[];
  latestRunAlerts: LatestRunAlertItem[];
};

function parseObservabilityFilters(searchParams?: ObservabilitySearchParams): ParsedObservabilityFilters {
  const signedPayload = buildObservabilitySignedPayload({ input: searchParams });
  const selectedPreset = signedPayload.preset;
  const selectedWindow = signedPayload.window;
  const selectedSeverity = signedPayload.severity;
  const selectedSource = signedPayload.source;
  const selectedEventType = signedPayload.event_type;
  const alertsCursor = signedPayload.alerts_cursor;
  const alertsDir = signedPayload.alerts_dir;
  const alertsPageSize = clampInt(signedPayload.alerts_page_size, 10, 100, 20);
  const runsPageSize = clampInt(signedPayload.runs_page_size, 10, 100, 20);
  const runsPage = clampInt(signedPayload.runs_page, 1, 99999, 1);
  const exportLimit = clampInt(signedPayload.export_limit, 100, 10000, 2000);
  const shareExp = pickSingle(searchParams?.share_exp, "");
  const shareSig = pickSingle(searchParams?.share_sig, "");
  const sinceIso = getSinceIso(selectedWindow);

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
    sinceIso,
    signedPayload: {
      ...signedPayload,
      share_exp: shareExp,
    },
  };
}

async function fetchObservabilityDashboardRows(
  supabase: SupabaseClient,
  filters: ParsedObservabilityFilters
): Promise<FetchedObservabilityRows> {
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
      .range((filters.runsPage - 1) * filters.runsPageSize, filters.runsPage * filters.runsPageSize - 1),
    fetchAlertsByCursor({
      supabase,
      sinceIso: filters.sinceIso,
      severity: filters.selectedSeverity,
      source: filters.selectedSource,
      eventType: filters.selectedEventType,
      pageSize: filters.alertsPageSize,
      cursor: filters.alertsCursor,
      direction: filters.alertsDir,
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
  const runsTotalPages = Math.max(1, Math.ceil(runsTotal / filters.runsPageSize));
  const eventTypeRows = (eventTypesRes.data as Array<{ event_type: string | null }> | null) ?? [];
  const sourceOptions = [...OBSERVABILITY_SOURCE_OPTIONS];
  const eventTypeOptions = [
    "all",
    ...Array.from(new Set(eventTypeRows.map((row) => row.event_type).filter((v): v is string => Boolean(v)))),
  ];
  const latestRunAlerts = (runs[0]?.details?.alerts as LatestRunAlertItem[] | undefined) ?? [];

  return {
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
  };
}

function buildObservabilityExportHrefs(filters: ParsedObservabilityFilters): {
  alertsExportHref: string;
  runsExportHref: string;
} {
  const maybeShare = {
    ...(filters.shareExp ? { share_exp: filters.shareExp } : {}),
    ...(filters.shareSig ? { share_sig: filters.shareSig } : {}),
  };

  const alertsExportHref = `/admin/observability/export/alerts?${toQueryString({
    preset: filters.selectedPreset,
    window: filters.selectedWindow,
    severity: filters.selectedSeverity,
    source: filters.selectedSource,
    event_type: filters.selectedEventType,
    limit: String(filters.exportLimit),
    alerts_cursor: filters.alertsCursor,
    alerts_dir: filters.alertsDir,
    export_limit: String(filters.exportLimit),
    ...maybeShare,
  })}`;

  const runsExportHref = `/admin/observability/export/maintenance?${toQueryString({
    preset: filters.selectedPreset,
    limit: String(filters.exportLimit),
    window: filters.selectedWindow,
    severity: filters.selectedSeverity,
    source: filters.selectedSource,
    event_type: filters.selectedEventType,
    alerts_cursor: filters.alertsCursor,
    alerts_dir: filters.alertsDir,
    export_limit: String(filters.exportLimit),
    ...maybeShare,
  })}`;

  return { alertsExportHref, runsExportHref };
}

function assembleObservabilityPageData(
  filters: ParsedObservabilityFilters,
  rows: FetchedObservabilityRows,
  signedLinkValid: boolean,
  exportHrefs: { alertsExportHref: string; runsExportHref: string }
) {
  const baseFilters = {
    preset: filters.selectedPreset,
    window: filters.selectedWindow,
    severity: filters.selectedSeverity,
    source: filters.selectedSource,
    event_type: filters.selectedEventType,
    alerts_cursor: filters.alertsCursor,
    alerts_dir: filters.alertsDir,
    alerts_page: DEFAULT_OBSERVABILITY_FILTERS.alertsPage,
    runs_page: String(filters.runsPage),
    alerts_page_size: String(filters.alertsPageSize),
    runs_page_size: String(filters.runsPageSize),
    export_limit: String(filters.exportLimit),
  };

  const alertsBase: Omit<AlertsSectionViewModel, "alertEvents" | "pagination"> = {
    selectedPreset: filters.selectedPreset,
    selectedWindow: filters.selectedWindow,
    selectedSeverity: filters.selectedSeverity,
    selectedSource: filters.selectedSource,
    selectedEventType: filters.selectedEventType,
    alertsPageSize: filters.alertsPageSize,
    runsPageSize: filters.runsPageSize,
    exportLimit: filters.exportLimit,
    baseFilters,
    alertsExportHref: exportHrefs.alertsExportHref,
    sourceOptions: rows.sourceOptions,
    eventTypeOptions: rows.eventTypeOptions,
    latestRunAlerts: rows.latestRunAlerts,
  };

  const sections = buildObservabilitySectionViewModels({
    metrics: rows.metrics,
    pipelineQueued: rows.pipelineQueued,
    pipelineProcessing: rows.pipelineProcessing,
    pipelineFailed: rows.pipelineFailed,
    alertsBase,
    alertEvents: rows.alertsCursorResult.items,
    alertsPagination: {
      nextCursor: rows.alertsCursorResult.nextCursor,
      prevCursor: rows.alertsCursorResult.prevCursor,
    },
    capacityRows: rows.capacityRows,
    runs: rows.runs,
    runsTotal: rows.runsTotal,
    runsTotalPages: rows.runsTotalPages,
    runsPage: filters.runsPage,
    baseFilters,
    runsExportHref: exportHrefs.runsExportHref,
  });

  const header = buildObservabilityHeaderViewModel({
    selectedPreset: filters.selectedPreset,
    selectedWindow: filters.selectedWindow,
    selectedSeverity: filters.selectedSeverity,
    selectedSource: filters.selectedSource,
    selectedEventType: filters.selectedEventType,
    alertsCursor: filters.alertsCursor,
    alertsDir: filters.alertsDir,
    alertsPageSize: filters.alertsPageSize,
    runsPageSize: filters.runsPageSize,
    runsPage: filters.runsPage,
    exportLimit: filters.exportLimit,
    shareExp: filters.shareExp,
    shareSig: filters.shareSig,
    signedLinkValid,
  });

  return {
    header,
    sections,
  };
}

export async function getObservabilityDashboardData({
  supabase,
  searchParams,
}: {
  supabase: SupabaseClient;
  searchParams?: ObservabilitySearchParams;
}): Promise<ObservabilityPageData> {
  const filters = parseObservabilityFilters(searchParams);
  const signedLinkValid = isObservabilityShareSignatureValid({
    payload: filters.signedPayload,
    shareSig: filters.shareSig,
  });
  const rows = await fetchObservabilityDashboardRows(supabase, filters);
  const exportHrefs = buildObservabilityExportHrefs(filters);
  return assembleObservabilityPageData(filters, rows, signedLinkValid, exportHrefs);
}
