export type MetricRow = {
  events_24h: number;
  errors_24h: number;
  webhook_events_24h: number;
  webhook_errors_24h: number;
  secure_link_events_24h: number;
  secure_link_blocked_24h: number;
  webhook_avg_latency_ms_24h: number;
  secure_link_avg_latency_ms_24h: number;
  payment_webhook_access_logs_24h: number;
};

export type CapacityRow = {
  table_name: string;
  total_bytes: number;
  table_bytes: number;
  index_bytes: number;
  est_live_rows: number;
  est_dead_rows: number;
  last_autovacuum: string | null;
  last_autoanalyze: string | null;
};

export type MaintenanceRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  triggered_by: string;
  success: boolean;
  alerts_count: number;
  access_deleted: number;
  security_deleted: number;
  observability_deleted: number;
  webhook_deleted: number;
  details: { alerts?: unknown[] } | null;
};

export type AlertEventRow = {
  id: string;
  created_at: string;
  severity: "info" | "warn" | "error" | string;
  source: string;
  event_type: string;
  metadata: { alerts?: unknown[]; run_id?: string } | null;
};

export type ObservabilitySearchParams = {
  preset?: string | string[];
  window?: string | string[];
  severity?: string | string[];
  source?: string | string[];
  event_type?: string | string[];
  alerts_cursor?: string | string[];
  alerts_dir?: string | string[];
  runs_page?: string | string[];
  alerts_page_size?: string | string[];
  runs_page_size?: string | string[];
  export_limit?: string | string[];
  share_exp?: string | string[];
  share_sig?: string | string[];
};

export type LatestRunAlertItem = {
  alert_key?: string;
  alert_level?: string;
  metric_value?: number;
  threshold?: number;
  message?: string;
  window_text?: string;
};

export type AlertsCursorPageResult = {
  items: AlertEventRow[];
  nextCursor: string | null;
  prevCursor: string | null;
};

export type ObservabilityBaseFilters = {
  preset: string;
  window: string;
  severity: string;
  source: string;
  event_type: string;
  alerts_cursor: string;
  alerts_dir: string;
  alerts_page: string;
  runs_page: string;
  alerts_page_size: string;
  runs_page_size: string;
  export_limit: string;
};

/** Dữ liệu đã parse + fetch cho trang observability (server). */
export type ObservabilityPageData = {
  selectedPreset: string;
  selectedWindow: string;
  selectedSeverity: string;
  selectedSource: string;
  selectedEventType: string;
  alertsCursor: string;
  alertsDir: "prev" | "next";
  alertsPageSize: number;
  runsPageSize: number;
  runsPage: number;
  exportLimit: number;
  shareExp: string;
  shareSig: string;
  signedLinkValid: boolean;
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
  baseFilters: ObservabilityBaseFilters;
  alertsExportHref: string;
  runsExportHref: string;
};
