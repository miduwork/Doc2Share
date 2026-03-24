import type { RunsSectionViewModel } from "@/features/admin/observability/dashboard/model/dashboard.types";
import { toQueryString } from "@/features/admin/observability/shared/query-string";
import { formatCount, formatTime } from "@/features/admin/observability/shared/formatters";

interface Props {
  viewModel: RunsSectionViewModel;
}

export default function ObservabilityMaintenanceRunsSection({ viewModel }: Props) {
  const { runs, runsTotal, runsTotalPages, runsPage, runsExportHref, baseFilters } = viewModel;
  return (
    <section className="mt-5 reveal-section">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-semantic-heading">Maintenance Runs</h2>
        <a href={runsExportHref} className="btn-secondary px-3 py-1.5 text-xs">
          Export CSV (runs)
        </a>
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Started</th>
              <th className="px-3 py-1.5 text-left font-medium">Trigger</th>
              <th className="px-3 py-1.5 text-left font-medium">Status</th>
              <th className="px-3 py-1.5 text-right font-medium">Alerts</th>
              <th className="px-3 py-1.5 text-right font-medium">Deleted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatTime(run.started_at)}</td>
                <td className="px-3 py-1.5">{run.triggered_by}</td>
                <td className="px-3 py-1.5">
                  <span className={run.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {run.success ? "success" : "failed"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">{run.alerts_count}</td>
                <td className="px-3 py-1.5 text-right">
                  {formatCount(
                    Number(run.access_deleted ?? 0) +
                      Number(run.security_deleted ?? 0) +
                      Number(run.observability_deleted ?? 0) +
                      Number(run.webhook_deleted ?? 0)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 && (
          <p className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">Chưa có maintenance run nào.</p>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <span>
          Page {runsPage}/{runsTotalPages} • Total {formatCount(runsTotal)}
        </span>
        <div className="flex gap-1.5">
          <a
            href={`/admin/observability?${toQueryString({ ...baseFilters, runs_page: String(Math.max(1, runsPage - 1)) })}`}
            className={`btn-secondary px-2.5 py-1 text-xs ${runsPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Prev
          </a>
          <a
            href={`/admin/observability?${toQueryString({
              ...baseFilters,
              runs_page: String(Math.min(runsTotalPages, runsPage + 1)),
            })}`}
            className={`btn-secondary px-2.5 py-1 text-xs ${runsPage >= runsTotalPages ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </a>
        </div>
      </div>
    </section>
  );
}
