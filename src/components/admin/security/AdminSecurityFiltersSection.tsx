import type { SecurityLogFilters } from "@/lib/admin/security-dashboard.types";

export default function AdminSecurityFiltersSection({
  filters,
  exporting,
  onApplyFilters,
  onExportByAction,
  onPatchQuery,
}: {
  filters: SecurityLogFilters;
  exporting: "access" | "security" | null;
  onApplyFilters: () => void;
  onExportByAction: (_kind: "access" | "security") => void;
  onPatchQuery: (_patch: Record<string, string | null>) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-3 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-semantic-heading">Bộ lọc điều tra</h2>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          defaultValue={filters.from}
          onBlur={(e) => onPatchQuery({ from: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="from ISO"
        />
        <input
          defaultValue={filters.to}
          onBlur={(e) => onPatchQuery({ to: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="to ISO"
        />
        <input
          defaultValue={filters.correlationId}
          onBlur={(e) => onPatchQuery({ correlation_id: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="correlation_id"
        />
        <input
          defaultValue={filters.userId}
          onBlur={(e) => onPatchQuery({ user_id: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="user_id"
        />
        <input
          defaultValue={filters.documentId}
          onBlur={(e) => onPatchQuery({ document_id: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="document_id"
        />
        <input
          defaultValue={filters.ipAddress}
          onBlur={(e) => onPatchQuery({ ip: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="ip_address"
        />
        <select
          defaultValue={filters.severity}
          onChange={(e) => onPatchQuery({ severity: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="all">severity: all</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <select
          defaultValue={filters.status}
          onChange={(e) => onPatchQuery({ status: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="all">status: all</option>
          <option value="success">success</option>
          <option value="blocked">blocked</option>
        </select>
        <input
          type="number"
          min={10}
          max={200}
          defaultValue={filters.pageSize}
          onBlur={(e) => onPatchQuery({ page_size: e.currentTarget.value })}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          placeholder="page size"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onApplyFilters} className="rounded bg-slate-700 px-2 py-1 text-xs text-white">
          Áp dụng bộ lọc
        </button>
        <button
          type="button"
          onClick={() => onExportByAction("access")}
          disabled={exporting !== null}
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Export Access (Action)
        </button>
        <button
          type="button"
          onClick={() => onExportByAction("security")}
          disabled={exporting !== null}
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Export Security (Action)
        </button>
      </div>
    </section>
  );
}
