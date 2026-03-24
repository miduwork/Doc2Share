import Link from "next/link";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { AccessLogRow, CursorPagination } from "@/lib/admin/security-dashboard.types";

export default function AdminSecurityAccessLogsSection({
  accessLogs,
  accessPagination,
  exportAccessUrl,
  withQuery,
}: {
  accessLogs: AccessLogRow[];
  accessPagination: CursorPagination;
  exportAccessUrl: string;
  withQuery: (_patch: Record<string, string | null>) => string;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
        <FileText className="h-4 w-4" />
        Nhật ký truy cập (Access Logs)
      </h2>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <Link className="rounded bg-slate-700 px-2 py-1 text-white" href={exportAccessUrl}>
          Export CSV (Route)
        </Link>
        {accessPagination.prevCursor ? (
          <Link
            href={withQuery({ access_cursor: accessPagination.prevCursor, access_dir: "prev" })}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
          >
            Trang trước
          </Link>
        ) : null}
        {accessPagination.nextCursor ? (
          <Link
            href={withQuery({ access_cursor: accessPagination.nextCursor, access_dir: "next" })}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
          >
            Trang sau
          </Link>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">Ai đọc tài liệu gì, lúc nào, thiết bị nào.</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
              <th className="px-3 py-1.5 text-left font-medium">User</th>
              <th className="px-3 py-1.5 text-left font-medium">Document</th>
              <th className="px-3 py-1.5 text-left font-medium">Correlation</th>
              <th className="px-3 py-1.5 text-left font-medium">Trạng thái</th>
              <th className="px-3 py-1.5 text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {accessLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatDate(log.created_at)}</td>
                <td className="px-3 py-1.5 font-mono">{log.user_id?.slice(0, 8) ?? "—"}...</td>
                <td className="px-3 py-1.5 font-mono">{log.document_id?.slice(0, 8) ?? "—"}...</td>
                <td className="px-3 py-1.5 font-mono">{log.correlation_id?.slice(0, 8) ?? "—"}...</td>
                <td className="px-3 py-1.5">{log.status}</td>
                <td className="px-3 py-1.5 font-mono">{log.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {accessLogs.length === 0 && <p className="py-5 text-center text-xs text-slate-500">Chưa có log.</p>}
      </div>
    </section>
  );
}
