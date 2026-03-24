import Link from "next/link";
import { UserX } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { CursorPagination, SecurityLogRow } from "@/lib/admin/security-dashboard.types";

export default function AdminSecuritySecurityLogsSection({
  logs,
  securityPagination,
  exportSecurityUrl,
  withQuery,
  revoking,
  onRevokeSession,
  onTemporaryBan,
}: {
  logs: SecurityLogRow[];
  securityPagination: CursorPagination;
  exportSecurityUrl: string;
  withQuery: (_patch: Record<string, string | null>) => string;
  revoking: string | null;
  onRevokeSession: (_userId: string) => void;
  onTemporaryBan: (_userId: string) => void;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
        <UserX className="h-4 w-4" />
        Nhật ký an ninh (Security Logs)
      </h2>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <Link className="rounded bg-slate-700 px-2 py-1 text-white" href={exportSecurityUrl}>
          Export CSV (Route)
        </Link>
        {securityPagination.prevCursor ? (
          <Link
            href={withQuery({ security_cursor: securityPagination.prevCursor, security_dir: "prev" })}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
          >
            Trang trước
          </Link>
        ) : null}
        {securityPagination.nextCursor ? (
          <Link
            href={withQuery({ security_cursor: securityPagination.nextCursor, security_dir: "next" })}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
          >
            Trang sau
          </Link>
        ) : null}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
              <th className="px-3 py-1.5 text-left font-medium">User</th>
              <th className="px-3 py-1.5 text-left font-medium">Sự kiện</th>
              <th className="px-3 py-1.5 text-left font-medium">Mức</th>
              <th className="px-3 py-1.5 text-left font-medium">IP</th>
              <th className="px-3 py-1.5 text-left font-medium">Correlation</th>
              <th className="w-32 px-2 py-1.5 font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {logs.map((log) => (
              <tr
                key={log.id}
                className={
                  log.severity === "high"
                    ? "bg-red-50/50 dark:bg-red-900/10"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                }
              >
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatDate(log.created_at)}</td>
                <td className="px-3 py-1.5 font-mono">{log.user_id?.slice(0, 8) ?? "—"}...</td>
                <td className="px-3 py-1.5">{log.event_type}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={
                      log.severity === "high"
                        ? "text-red-600 dark:text-red-400"
                        : log.severity === "medium"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-600 dark:text-slate-400"
                    }
                  >
                    {log.severity}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono">{log.ip_address ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono">
                  {log.correlation_id ? (
                    <Link href={withQuery({ correlation_id: log.correlation_id })} className="underline">
                      {log.correlation_id.slice(0, 8)}...
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {log.severity === "high" && log.user_id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onRevokeSession(log.user_id!)}
                        disabled={revoking === log.user_id}
                        className="rounded bg-red-600 px-2 py-0.5 text-[11px] text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Thu hồi
                      </button>
                      <button
                        type="button"
                        onClick={() => onTemporaryBan(log.user_id!)}
                        className="rounded bg-slate-600 px-2 py-0.5 text-[11px] text-white hover:bg-slate-700"
                      >
                        Khóa tạm 24h
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="py-5 text-center text-xs text-slate-500">Chưa có log.</p>}
      </div>
    </section>
  );
}
