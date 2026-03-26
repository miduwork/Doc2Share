import type { AlertsSectionViewModel } from "@/features/admin/observability/dashboard/model/dashboard.types";
import { toQueryString } from "@/features/admin/observability/shared/query-string";
import { formatTime, severityClass } from "@/features/admin/observability/shared/formatters";
import IncidentAutoRefresh from "@/components/admin/observability/IncidentAutoRefresh";

interface Props {
  viewModel: AlertsSectionViewModel;
}

export default function ObservabilityAlertsSection({ viewModel }: Props) {
  const {
    selectedPreset,
    selectedWindow,
    selectedSeverity,
    selectedSource,
    selectedEventType,
    alertsPageSize,
    runsPageSize,
    exportLimit,
    baseFilters,
    alertsExportHref,
    sourceOptions,
    eventTypeOptions,
    latestRunAlerts,
    alertEvents,
    pagination,
  } = viewModel;
  return (
    <section id="alerts-panel" className="mt-5 reveal-section">
      <h2 className="text-sm font-semibold text-semantic-heading">Alerts gần nhất</h2>
      <div className="mt-2 premium-panel rounded-xl p-3">
        <IncidentAutoRefresh enabled={selectedPreset === "incident"} intervalMs={45000} />
        <div className="mb-2 flex flex-wrap gap-1.5">
          <a
            href={`/admin/observability?${toQueryString({
              ...baseFilters,
              preset: "incident",
              window: "24h",
              severity: "error",
              source: "all",
              event_type: "all",
              alerts_cursor: "",
              alerts_dir: "next",
            })}#alerts-panel`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Preset: Incidents
          </a>
          <a
            href={`/admin/observability?${toQueryString({
              ...baseFilters,
              preset: "webhook-errors",
              window: "24h",
              severity: "error",
              source: "api.webhook_sepay",
              event_type: "all",
              alerts_cursor: "",
              alerts_dir: "next",
            })}#alerts-panel`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Preset: Webhook errors
          </a>
          <a
            href={`/admin/observability?${toQueryString({
              ...baseFilters,
              preset: "secure-document-access-blocked",
              window: "24h",
              severity: "all",
              source: "edge.get_secure_link",
              event_type: "blocked",
              alerts_cursor: "",
              alerts_dir: "next",
            })}#alerts-panel`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Preset: Secure document blocked
          </a>
          <a
            href={`/admin/observability?${toQueryString({
              ...baseFilters,
              preset: "document-pipeline",
              window: "24h",
              severity: "all",
              source: "db.document_lifecycle",
              event_type: "pipeline_tick",
              alerts_cursor: "",
              alerts_dir: "next",
            })}#alerts-panel`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Preset: Pipeline
          </a>
          <a
            href={`/admin/observability?${toQueryString({
              ...baseFilters,
              preset: "reader-watermark-degraded",
              window: "24h",
              severity: "warn",
              source: "next.reader",
              event_type: "watermark_degraded_fallback",
              alerts_cursor: "",
              alerts_dir: "next",
            })}#alerts-panel`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Preset: Watermark degraded
          </a>
        </div>
        <form className="mb-3 flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Thời gian</span>
            <select
              name="window"
              defaultValue={selectedWindow}
              className="input-premium min-w-32 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              <option value="1h">1 giờ</option>
              <option value="6h">6 giờ</option>
              <option value="24h">24 giờ</option>
              <option value="7d">7 ngày</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Source</span>
            <select
              name="source"
              defaultValue={selectedSource}
              className="input-premium min-w-40 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Event type</span>
            <select
              name="event_type"
              defaultValue={selectedEventType}
              className="input-premium min-w-40 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              {eventTypeOptions.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Severity</span>
            <select
              name="severity"
              defaultValue={selectedSeverity}
              className="input-premium min-w-32 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              <option value="all">Tất cả</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </label>
          <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
            Áp dụng
          </button>
          <input type="hidden" name="preset" value={selectedPreset} />
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Export limit</span>
            <select
              name="export_limit"
              defaultValue={String(exportLimit)}
              className="input-premium min-w-28 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              {[500, 1000, 2000, 5000, 10000].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Alerts/page</span>
            <select
              name="alerts_page_size"
              defaultValue={String(alertsPageSize)}
              className="input-premium min-w-20 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            <span className="mb-0.5 block">Runs/page</span>
            <select
              name="runs_page_size"
              defaultValue={String(runsPageSize)}
              className="input-premium min-w-20 py-1.5 text-sm bg-white dark:bg-slate-900"
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="alerts_page" value="1" />
          <input type="hidden" name="runs_page" value="1" />
          <input type="hidden" name="alerts_cursor" value="" />
          <input type="hidden" name="alerts_dir" value="next" />
          <a href={alertsExportHref} className="btn-secondary px-3 py-1.5 text-xs">
            Export CSV (alerts)
          </a>
        </form>
        {latestRunAlerts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Không có cảnh báo từ lần maintenance gần nhất.</p>
        ) : (
          <div className="space-y-1.5">
            {latestRunAlerts.map((a, idx) => (
              <div
                key={`${a.alert_key ?? "alert"}-${idx}`}
                className="rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-900/10"
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">{a.message ?? a.alert_key ?? "Alert"}</p>
                <p className="text-amber-700/80 dark:text-amber-200/80">
                  Level: {a.alert_level ?? "unknown"} | Metric: {a.metric_value ?? 0}/{a.threshold ?? 0} | Window:{" "}
                  {a.window_text ?? "n/a"}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
                <th className="px-3 py-1.5 text-left font-medium">Source</th>
                <th className="px-3 py-1.5 text-left font-medium">Event</th>
                <th className="px-3 py-1.5 text-left font-medium">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {alertEvents.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatTime(event.created_at)}</td>
                  <td className="px-3 py-1.5 font-mono">{event.source}</td>
                  <td className="px-3 py-1.5">{event.event_type}</td>
                  <td className="px-3 py-1.5">
                    <span className={severityClass(event.severity)}>{event.severity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alertEvents.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">Không có event khớp bộ lọc.</p>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>Page size {alertsPageSize}</span>
          <div className="flex gap-1.5">
            <a
              href={`/admin/observability?${toQueryString({
                ...baseFilters,
                alerts_cursor: pagination.prevCursor ?? "",
                alerts_dir: "prev",
              })}`}
              className={`btn-secondary px-2.5 py-1 text-xs ${!pagination.prevCursor ? "pointer-events-none opacity-50" : ""}`}
            >
              Newer
            </a>
            <a
              href={`/admin/observability?${toQueryString({
                ...baseFilters,
                alerts_cursor: pagination.nextCursor ?? "",
                alerts_dir: "next",
              })}`}
              className={`btn-secondary px-2.5 py-1 text-xs ${!pagination.nextCursor ? "pointer-events-none opacity-50" : ""}`}
            >
              Older
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
