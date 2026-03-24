import { AlertTriangle } from "lucide-react";
import type { HighRiskUser } from "@/lib/admin/security-dashboard.types";

export default function AdminSecurityHighRiskSection({
  highRiskUsers,
  revoking,
  panicUserId,
  onRevokeSession,
  onTemporaryBan,
  onPanic,
}: {
  highRiskUsers: HighRiskUser[];
  revoking: string | null;
  panicUserId: string | null;
  onRevokeSession: (_userId: string) => void;
  onTemporaryBan: (_userId: string) => void;
  onPanic: (_userId: string) => void;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-semantic-heading">
        <AlertTriangle className="h-4 w-4" />
        High-risk users (Risk score v1)
      </h2>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {highRiskUsers.length === 0 ? (
          <p className="text-xs text-slate-500">Không có.</p>
        ) : (
          highRiskUsers.map((risk) => (
            <div
              key={`${risk.userId}-${risk.correlationId ?? "none"}`}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-900/50 dark:bg-red-900/20"
            >
              <span className="font-mono text-xs">{risk.userId.slice(0, 8)}...</span>
              <span className="rounded bg-red-700 px-2 py-0.5 text-[11px] text-white">score {risk.score}</span>
              <span className="text-[11px] uppercase">{risk.band}</span>
              <button
                type="button"
                onClick={() => onRevokeSession(risk.userId)}
                disabled={revoking === risk.userId}
                className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Thu hồi phiên
              </button>
              <button
                type="button"
                onClick={() => onTemporaryBan(risk.userId)}
                className="rounded bg-slate-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-700"
              >
                Khóa tạm 24h
              </button>
              <button
                type="button"
                onClick={() => onPanic(risk.userId)}
                disabled={panicUserId === risk.userId}
                className="rounded bg-red-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-900 disabled:opacity-50"
                title="Panic: khóa cứng tài khoản, thu hồi quyền, xóa phiên/thiết bị"
              >
                Panic
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
