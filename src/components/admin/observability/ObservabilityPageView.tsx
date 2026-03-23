import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { ObservabilityPageData } from "@/app/admin/observability/types";
import CopyDiagnosticsLinkButton from "@/components/admin/observability/CopyDiagnosticsLinkButton";
import RunMaintenanceButton from "@/components/admin/observability/RunMaintenanceButton";
import ObservabilityAlertsSection from "@/components/admin/observability/ObservabilityAlertsSection";
import ObservabilityCapacitySection from "@/components/admin/observability/ObservabilityCapacitySection";
import ObservabilityKpiSection from "@/components/admin/observability/ObservabilityKpiSection";
import ObservabilityMaintenanceRunsSection from "@/components/admin/observability/ObservabilityMaintenanceRunsSection";

interface Props {
  data: ObservabilityPageData;
}

export default function ObservabilityPageView({ data }: Props) {
  const alertEvents = data.alertsCursorResult.items;

  return (
    <div>
      <AdminPageHeader
        title="Observability & Ops"
        description="Giám sát backend, cảnh báo và lịch sử bảo trì — không cần query SQL thủ công"
        actions={
          <>
            <CopyDiagnosticsLinkButton
              preset={data.selectedPreset}
              windowValue={data.selectedWindow}
              severity={data.selectedSeverity}
              source={data.selectedSource}
              eventType={data.selectedEventType}
              alertsCursor={data.alertsCursor}
              alertsDir={data.alertsDir}
              alertsPage={1}
              runsPage={data.runsPage}
              alertsPageSize={data.alertsPageSize}
              runsPageSize={data.runsPageSize}
              exportLimit={data.exportLimit}
            />
            <RunMaintenanceButton />
          </>
        }
      />
      {data.shareExp ? (
        <p
          className={`mb-1.5 mt-0.5 text-xs ${data.signedLinkValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
        >
          {data.signedLinkValid
            ? "Signed diagnostics link hợp lệ (chưa hết hạn)."
            : "Signed diagnostics link không hợp lệ hoặc đã hết hạn."}
        </p>
      ) : null}

      <ObservabilityKpiSection
        metrics={data.metrics}
        pipelineQueued={data.pipelineQueued}
        pipelineProcessing={data.pipelineProcessing}
        pipelineFailed={data.pipelineFailed}
      />

      <ObservabilityAlertsSection
        selectedPreset={data.selectedPreset}
        selectedWindow={data.selectedWindow}
        selectedSeverity={data.selectedSeverity}
        selectedSource={data.selectedSource}
        selectedEventType={data.selectedEventType}
        alertsPageSize={data.alertsPageSize}
        runsPageSize={data.runsPageSize}
        exportLimit={data.exportLimit}
        baseFilters={data.baseFilters}
        alertsExportHref={data.alertsExportHref}
        sourceOptions={data.sourceOptions}
        eventTypeOptions={data.eventTypeOptions}
        latestRunAlerts={data.latestRunAlerts}
        alertEvents={alertEvents}
        alertsCursorResult={data.alertsCursorResult}
      />

      <ObservabilityCapacitySection capacityRows={data.capacityRows} />

      <ObservabilityMaintenanceRunsSection
        runs={data.runs}
        runsTotal={data.runsTotal}
        runsTotalPages={data.runsTotalPages}
        runsPage={data.runsPage}
        runsExportHref={data.runsExportHref}
        baseFilters={data.baseFilters}
      />
    </div>
  );
}
