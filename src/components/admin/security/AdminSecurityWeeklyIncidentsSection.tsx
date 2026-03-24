import { formatDate } from "@/lib/date";
import type { SecurityIncidentRow, WeeklyFalsePositiveStats } from "@/lib/admin/security-dashboard.types";

export default function AdminSecurityWeeklyIncidentsSection({
  weeklyStats,
  incidents,
  onReviewIncident,
}: {
  weeklyStats: WeeklyFalsePositiveStats;
  incidents: SecurityIncidentRow[];
  onReviewIncident: (_incidentId: string, _reviewStatus: "confirmed_risk" | "false_positive") => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-semantic-heading">Weekly false-positive dashboard</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
        <div className="rounded border border-line bg-white p-2 dark:bg-slate-900">
          <div className="text-slate-500">Week start</div>
          <div>{formatDate(weeklyStats.weekStartIso)}</div>
        </div>
        <div className="rounded border border-line bg-white p-2 dark:bg-slate-900">
          <div className="text-slate-500">Incidents</div>
          <div>{weeklyStats.totalIncidents}</div>
        </div>
        <div className="rounded border border-line bg-white p-2 dark:bg-slate-900">
          <div className="text-slate-500">Confirmed</div>
          <div>{weeklyStats.confirmedRisk}</div>
        </div>
        <div className="rounded border border-line bg-white p-2 dark:bg-slate-900">
          <div className="text-slate-500">Manual false-positive</div>
          <div>{weeklyStats.manualFalsePositive}</div>
        </div>
        <div className="rounded border border-line bg-white p-2 dark:bg-slate-900">
          <div className="text-slate-500">Proxy false-positive</div>
          <div>{weeklyStats.proxyFalsePositive}</div>
        </div>
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Time</th>
              <th className="px-3 py-1.5 text-left font-medium">User</th>
              <th className="px-3 py-1.5 text-left font-medium">Score</th>
              <th className="px-3 py-1.5 text-left font-medium">Status</th>
              <th className="px-3 py-1.5 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td className="px-3 py-1.5">{formatDate(incident.detected_at)}</td>
                <td className="px-3 py-1.5 font-mono">{incident.user_id?.slice(0, 8) ?? "—"}...</td>
                <td className="px-3 py-1.5">{incident.risk_score}</td>
                <td className="px-3 py-1.5">{incident.review_status}</td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded bg-emerald-600 px-2 py-0.5 text-white"
                      onClick={() => onReviewIncident(incident.id, "confirmed_risk")}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="rounded bg-amber-600 px-2 py-0.5 text-white"
                      onClick={() => onReviewIncident(incident.id, "false_positive")}
                    >
                      False+
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 ? <p className="py-3 text-center text-xs text-slate-500">Chưa có incident.</p> : null}
      </div>
    </section>
  );
}
