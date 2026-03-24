import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { ObservabilityPageData } from "@/features/admin/observability/dashboard/model/dashboard.types";
import CopyDiagnosticsLinkButton from "@/components/admin/observability/CopyDiagnosticsLinkButton";
import RunMaintenanceButton from "@/components/admin/observability/RunMaintenanceButton";
import ObservabilityAlertsSection from "@/features/admin/observability/alerts/components/ObservabilityAlertsSection";
import ObservabilityCapacitySection from "@/features/admin/observability/capacity/components/ObservabilityCapacitySection";
import ObservabilityKpiSection from "@/features/admin/observability/metrics/components/ObservabilityKpiSection";
import ObservabilityMaintenanceRunsSection from "@/features/admin/observability/maintenance/components/ObservabilityMaintenanceRunsSection";

interface Props {
  data: ObservabilityPageData;
}

export default function ObservabilityPageView({ data }: Props) {
  const { header, sections } = data;

  return (
    <div>
      <AdminPageHeader
        title="Observability & Ops"
        description="Giám sát backend, cảnh báo và lịch sử bảo trì — không cần query SQL thủ công"
        actions={
          <>
            <CopyDiagnosticsLinkButton
              preset={header.selectedPreset}
              windowValue={header.selectedWindow}
              severity={header.selectedSeverity}
              source={header.selectedSource}
              eventType={header.selectedEventType}
              alertsCursor={header.alertsCursor}
              alertsDir={header.alertsDir}
              alertsPage={1}
              runsPage={header.runsPage}
              alertsPageSize={header.alertsPageSize}
              runsPageSize={header.runsPageSize}
              exportLimit={header.exportLimit}
            />
            <RunMaintenanceButton />
          </>
        }
      />
      {header.shareExp ? (
        <p
          className={`mb-1.5 mt-0.5 text-xs ${header.signedLinkValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
        >
          {header.signedLinkValid
            ? "Signed diagnostics link hợp lệ (chưa hết hạn)."
            : "Signed diagnostics link không hợp lệ hoặc đã hết hạn."}
        </p>
      ) : null}

      <ObservabilityKpiSection viewModel={sections.kpi} />

      <ObservabilityAlertsSection viewModel={sections.alerts} />

      <ObservabilityCapacitySection viewModel={sections.capacity} />

      <ObservabilityMaintenanceRunsSection viewModel={sections.runs} />
    </div>
  );
}
