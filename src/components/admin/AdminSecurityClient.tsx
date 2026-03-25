"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  forceLogoutSession as forceLogoutSessionAction,
  panicUser,
  reviewSecurityIncident,
  revokeSessionAndDevices,
  temporaryBanUser,
} from "@/app/admin/security/actions";
import { exportAccessLogsCsv, exportSecurityLogsCsv } from "@/app/admin/security/export-actions";
import type {
  AccessLogRow,
  ActiveSessionRow,
  CursorPagination,
  SecurityExportUrls,
  SecurityIncidentRow,
  SecurityLogFilters,
  SecurityLogRow,
  GeoPoint,
  HighRiskUser,
  WeeklyFalsePositiveStats,
  RiskBenchmarkStats,
} from "@/lib/admin/security-dashboard.types";
import AdminSecurityFiltersSection from "@/components/admin/security/AdminSecurityFiltersSection";
import AdminSecurityGeoSection from "@/components/admin/security/AdminSecurityGeoSection";
import AdminSecurityHighRiskSection from "@/components/admin/security/AdminSecurityHighRiskSection";
import AdminSecurityWeeklyIncidentsSection from "@/components/admin/security/AdminSecurityWeeklyIncidentsSection";
import AdminSecuritySessionsSection from "@/components/admin/security/AdminSecuritySessionsSection";
import AdminSecurityAccessLogsSection from "@/components/admin/security/AdminSecurityAccessLogsSection";
import AdminSecuritySecurityLogsSection from "@/components/admin/security/AdminSecuritySecurityLogsSection";
import AdminSecurityBenchmarkSection from "@/components/admin/security/AdminSecurityBenchmarkSection";
import AdminSecurityForensicSection from "@/components/admin/security/AdminSecurityForensicSection";
import type { SecurityWorkspace } from "@/lib/admin/security-workspace";

export default function AdminSecurityClient({
  workspace = "overview",
  logs,
  highRiskUsers,
  accessLogs,
  activeSessions,
  geoPoints,
  weeklyStats,
  incidents,
  filters,
  accessPagination,
  securityPagination,
  exportUrls,
  benchmark = null,
}: {
  workspace?: SecurityWorkspace;
  logs?: SecurityLogRow[];
  highRiskUsers?: HighRiskUser[];
  accessLogs?: AccessLogRow[];
  activeSessions?: ActiveSessionRow[];
  geoPoints?: GeoPoint[];
  weeklyStats?: WeeklyFalsePositiveStats;
  incidents?: SecurityIncidentRow[];
  filters?: SecurityLogFilters;
  accessPagination?: CursorPagination;
  securityPagination?: CursorPagination;
  exportUrls?: SecurityExportUrls;
  benchmark?: {
    stats: RiskBenchmarkStats;
    interpretation: { proxyPrecisionDelta: number; manualPrecisionDelta: number; candidateDelta: number };
  } | null;
}) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [panicUserId, setPanicUserId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"access" | "security" | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const withQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    return `${pathname}?${next.toString()}`;
  };

  const resetCursorParams = () => {
    const next = new URLSearchParams(searchParams.toString());
    ["access_cursor", "access_dir", "security_cursor", "security_dir"].forEach((k) => next.delete(k));
    router.push(`${pathname}?${next.toString()}`);
  };

  async function revokeSession(userId: string) {
    setRevoking(userId);
    const result = await revokeSessionAndDevices(userId);
    setRevoking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Đã thu hồi phiên và thiết bị");
    router.refresh();
  }

  async function temporaryBan(userId: string) {
    const reason = window.prompt("Lý do khóa tạm 24h (không bắt buộc):") ?? undefined;
    const result = await temporaryBanUser(userId, reason);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Đã khóa tạm tài khoản 24h");
    router.refresh();
  }

  async function panic(userId: string) {
    const reason = window.prompt("Nhập lý do Panic (bắt buộc):");
    if (!reason || !reason.trim()) {
      toast.error("Cần nhập lý do trước khi Panic.");
      return;
    }
    setPanicUserId(userId);
    const result = await panicUser(userId, reason.trim());
    setPanicUserId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Panic hoàn tất");
    router.refresh();
  }

  async function forceLogoutSession(sessionId: string) {
    const result = await forceLogoutSessionAction(sessionId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Đã đăng xuất phiên");
    router.refresh();
  }

  const normalizedFilters: SecurityLogFilters =
    filters ??
    ({
      from: "",
      to: "",
      severity: "all",
      status: "all",
      userId: "",
      documentId: "",
      ipAddress: "",
      correlationId: "",
      pageSize: 50,
      accessCursor: "",
      accessDir: "next",
      securityCursor: "",
      securityDir: "next",
    } as SecurityLogFilters);
  const normalizedAccessPagination = accessPagination ?? { nextCursor: null, prevCursor: null };
  const normalizedSecurityPagination = securityPagination ?? { nextCursor: null, prevCursor: null };
  const normalizedExportUrls = exportUrls ?? { access: "#", security: "#" };

  async function exportByAction(kind: "access" | "security") {
    setExporting(kind);
    const baseFilters = {
      from: normalizedFilters.from,
      to: normalizedFilters.to,
      severity: normalizedFilters.severity,
      status: normalizedFilters.status,
      user_id: normalizedFilters.userId,
      document_id: normalizedFilters.documentId,
      ip: normalizedFilters.ipAddress,
      correlation_id: normalizedFilters.correlationId,
      page_size: String(normalizedFilters.pageSize),
    };
    const result =
      kind === "access" ? await exportAccessLogsCsv(baseFilters) : await exportSecurityLogsCsv(baseFilters);
    setExporting(null);
    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Export thất bại." : result.error);
      return;
    }
    const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã export CSV.");
  }

  async function reviewIncident(incidentId: string, reviewStatus: "confirmed_risk" | "false_positive") {
    const notes = window.prompt("Ghi chú review (không bắt buộc):") ?? undefined;
    const result = await reviewSecurityIncident({ incidentId, reviewStatus, notes });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Đã cập nhật trạng thái incident.");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-5">
      {workspace === "logs" ? (
        <AdminSecurityFiltersSection
          filters={normalizedFilters}
          exporting={exporting}
          onApplyFilters={resetCursorParams}
          onExportByAction={exportByAction}
          onPatchQuery={(patch) => router.push(withQuery(patch))}
        />
      ) : null}
      {workspace === "geo" ? <AdminSecurityGeoSection geoPoints={geoPoints ?? []} /> : null}
      {workspace === "overview" ? (
        <>
          <AdminSecurityHighRiskSection
            highRiskUsers={highRiskUsers ?? []}
            revoking={revoking}
            panicUserId={panicUserId}
            onRevokeSession={revokeSession}
            onTemporaryBan={temporaryBan}
            onPanic={panic}
          />
          <AdminSecurityWeeklyIncidentsSection
            weeklyStats={
              weeklyStats ?? {
                weekStartIso: "",
                totalIncidents: 0,
                confirmedRisk: 0,
                manualFalsePositive: 0,
                proxyFalsePositive: 0,
              }
            }
            incidents={incidents ?? []}
            onReviewIncident={reviewIncident}
          />
          <AdminSecuritySessionsSection activeSessions={activeSessions ?? []} onForceLogoutSession={forceLogoutSession} />
        </>
      ) : null}
      {workspace === "logs" ? (
        <>
          <AdminSecurityAccessLogsSection
            accessLogs={accessLogs ?? []}
            accessPagination={normalizedAccessPagination}
            exportAccessUrl={normalizedExportUrls.access}
            withQuery={withQuery}
          />
          <AdminSecuritySecurityLogsSection
            logs={logs ?? []}
            securityPagination={normalizedSecurityPagination}
            exportSecurityUrl={normalizedExportUrls.security}
            withQuery={withQuery}
            revoking={revoking}
            onRevokeSession={revokeSession}
            onTemporaryBan={temporaryBan}
          />
        </>
      ) : null}
      {workspace === "benchmark" ? <AdminSecurityBenchmarkSection benchmark={benchmark} /> : null}
      {workspace === "forensic" ? <AdminSecurityForensicSection /> : null}
    </div>
  );
}
