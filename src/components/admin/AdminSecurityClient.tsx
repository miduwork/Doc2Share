"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MapPin, AlertTriangle, UserX, FileText, Users, LogOut } from "lucide-react";
import { formatDate } from "@/lib/date";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LogRow {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  created_at: string;
}

interface AccessLogRow {
  id: string;
  user_id: string | null;
  document_id: string | null;
  action: string;
  status: string;
  ip_address: string | null;
  device_id: string | null;
  created_at: string;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  created_at: string;
}

export default function AdminSecurityClient({
  logs,
  highRiskUserIds,
  accessLogs,
  activeSessions,
}: {
  logs: LogRow[];
  highRiskUserIds: string[];
  accessLogs: AccessLogRow[];
  activeSessions: SessionRow[];
}) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [panicUserId, setPanicUserId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function revokeSession(userId: string) {
    setRevoking(userId);
    const res1 = await supabase.from("active_sessions").delete().eq("user_id", userId);
    const res2 = await supabase.from("device_logs").delete().eq("user_id", userId);
    setRevoking(null);
    if (res1.error || res2.error) {
      toast.error(res1.error?.message || res2.error?.message || "Không thể thu hồi phiên");
      return;
    }
    toast.success("Đã thu hồi phiên và thiết bị");
    router.refresh();
  }

  async function temporaryBan(userId: string) {
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã khóa tài khoản");
    router.refresh();
  }

  async function panic(userId: string) {
    setPanicUserId(userId);
    const r1 = await supabase.from("permissions").delete().eq("user_id", userId);
    const r2 = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);
    const r3 = await supabase.from("active_sessions").delete().eq("user_id", userId);
    const r4 = await supabase.from("device_logs").delete().eq("user_id", userId);
    setPanicUserId(null);
    if (r1.error || r2.error || r3.error || r4.error) {
      toast.error(r1.error?.message || r2.error?.message || r3.error?.message || r4.error?.message || "Panic thất bại");
      return;
    }
    toast.success("Panic hoàn tất");
    router.refresh();
  }

  async function forceLogoutSession(sessionId: string) {
    const { error } = await supabase.from("active_sessions").delete().eq("session_id", sessionId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã đăng xuất phiên");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-5">
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
          <MapPin className="h-4 w-4" />
          Bản đồ IP (gợi ý)
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">Vị trí đăng nhập — cảnh báo khi IP thay đổi nhanh.</p>
        <div className="mt-2 flex h-36 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
          [ IP Map placeholder – cần API key bản đồ ]
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
          <AlertTriangle className="h-4 w-4" />
          Thiết bị nghi vấn (&gt;2 thiết bị)
        </h2>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {highRiskUserIds.length === 0 ? (
            <p className="text-xs text-slate-500">Không có.</p>
          ) : (
            highRiskUserIds.map((uid) => (
              <div
                key={uid}
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-900/50 dark:bg-red-900/20"
              >
                <span className="font-mono text-xs">{uid.slice(0, 8)}...</span>
                <button
                  type="button"
                  onClick={() => revokeSession(uid)}
                  disabled={revoking === uid}
                  className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Thu hồi phiên
                </button>
                <button
                  type="button"
                  onClick={() => temporaryBan(uid)}
                  className="rounded bg-slate-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-700"
                >
                  Khóa 24h
                </button>
                <button
                  type="button"
                  onClick={() => panic(uid)}
                  disabled={panicUserId === uid}
                  className="rounded bg-red-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-900 disabled:opacity-50"
                  title="Panic: Khóa tài khoản + thu hồi quyền + xóa phiên/thiết bị"
                >
                  Panic
                </button>
              </div>
            ))
          )}
        </div>
      </section>

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
                      onClick={() => forceLogoutSession(s.session_id)}
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

      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
          <FileText className="h-4 w-4" />
          Nhật ký truy cập (Access Logs)
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">Ai đọc tài liệu gì, lúc nào, thiết bị nào.</p>
        <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
                <th className="px-3 py-1.5 text-left font-medium">User</th>
                <th className="px-3 py-1.5 text-left font-medium">Document</th>
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
                  <td className="px-3 py-1.5">{log.status}</td>
                  <td className="px-3 py-1.5 font-mono">{log.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {accessLogs.length === 0 && <p className="py-5 text-center text-xs text-slate-500">Chưa có log.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
          <UserX className="h-4 w-4" />
          Nhật ký an ninh (Security Logs)
        </h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
                <th className="px-3 py-1.5 text-left font-medium">User</th>
                <th className="px-3 py-1.5 text-left font-medium">Sự kiện</th>
                <th className="px-3 py-1.5 text-left font-medium">Mức</th>
                <th className="px-3 py-1.5 text-left font-medium">IP</th>
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
                  <td className="px-2 py-1.5">
                    {log.severity === "high" && log.user_id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => revokeSession(log.user_id!)}
                          disabled={revoking === log.user_id}
                          className="rounded bg-red-600 px-2 py-0.5 text-[11px] text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Thu hồi
                        </button>
                        <button
                          type="button"
                          onClick={() => temporaryBan(log.user_id!)}
                          className="rounded bg-slate-600 px-2 py-0.5 text-[11px] text-white hover:bg-slate-700"
                        >
                          Khóa 24h
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
    </div>
  );
}
