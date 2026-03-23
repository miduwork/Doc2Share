import type { CapacityRow } from "@/app/admin/observability/types";
import { formatBytes, formatCount, formatTime } from "@/app/admin/observability/utils";

interface Props {
  capacityRows: CapacityRow[];
}

export default function ObservabilityCapacitySection({ capacityRows }: Props) {
  return (
    <section className="mt-5 reveal-section">
      <h2 className="text-sm font-semibold text-semantic-heading">Backend Capacity</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Table</th>
              <th className="px-3 py-1.5 text-right font-medium">Total</th>
              <th className="px-3 py-1.5 text-right font-medium">Rows (est)</th>
              <th className="px-3 py-1.5 text-right font-medium">Dead rows</th>
              <th className="px-3 py-1.5 text-left font-medium">Last autovacuum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {capacityRows.map((row) => (
              <tr key={row.table_name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-1.5 font-mono">{row.table_name}</td>
                <td className="px-3 py-1.5 text-right">{formatBytes(row.total_bytes)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(row.est_live_rows)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(row.est_dead_rows)}</td>
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatTime(row.last_autovacuum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {capacityRows.length === 0 && (
          <p className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">Chưa có dữ liệu capacity.</p>
        )}
      </div>
    </section>
  );
}
