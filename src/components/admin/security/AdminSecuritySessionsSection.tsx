import { LogOut, Users } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { ActiveSessionRow } from "@/lib/admin/security-dashboard.types";

export default function AdminSecuritySessionsSection({
  activeSessions,
  onForceLogoutSession,
}: {
  activeSessions: ActiveSessionRow[];
  onForceLogoutSession: (_sessionId: string) => void;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
        <Users className="h-4 w-4" />
        Quản lý phiên
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Phiên đang hoạt động — ép đăng xuất từ xa.</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">User</th>
              <th className="px-3 py-1.5 text-left font-medium">IP</th>
              <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
              <th className="w-20 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {activeSessions.map((s) => (
              <tr key={s.session_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-1.5 font-mono">{s.user_id.slice(0, 8)}...</td>
                <td className="px-3 py-1.5 font-mono">{s.ip_address ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatDate(s.created_at)}</td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onForceLogoutSession(s.session_id)}
                    className="rounded bg-slate-600 px-2 py-0.5 text-[11px] text-white hover:bg-slate-700"
                  >
                    <LogOut className="inline h-3 w-3" /> Đăng xuất
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activeSessions.length === 0 && <p className="py-5 text-center text-xs text-slate-500">Chưa có phiên nào.</p>}
      </div>
    </section>
  );
}
