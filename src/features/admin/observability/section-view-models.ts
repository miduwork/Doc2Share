import type {
  AlertsSectionViewModel,
  CapacitySectionViewModel,
  KpiSectionViewModel,
  ObservabilityBaseFilters,
  ObservabilityHeaderViewModel,
  RunsSectionViewModel,
} from "@/features/admin/observability/dashboard/model/dashboard.types";

type BuildSectionViewModelsInput = {
  metrics: KpiSectionViewModel["metrics"];
  watermarkDegraded24h: number;
  pipelineQueued: number;
  pipelineProcessing: number;
  pipelineFailed: number;
  alertsBase: Omit<AlertsSectionViewModel, "alertEvents" | "pagination">;
  alertEvents: AlertsSectionViewModel["alertEvents"];
  alertsPagination: AlertsSectionViewModel["pagination"];
  capacityRows: CapacitySectionViewModel["capacityRows"];
  runs: RunsSectionViewModel["runs"];
  runsTotal: RunsSectionViewModel["runsTotal"];
  runsTotalPages: RunsSectionViewModel["runsTotalPages"];
  runsPage: RunsSectionViewModel["runsPage"];
  baseFilters: ObservabilityBaseFilters;
  runsExportHref: string;
};

export function buildObservabilitySectionViewModels(input: BuildSectionViewModelsInput): {
  kpi: KpiSectionViewModel;
  alerts: AlertsSectionViewModel;
  capacity: CapacitySectionViewModel;
  runs: RunsSectionViewModel;
} {
  return {
    kpi: {
      metrics: input.metrics,
      watermarkDegraded24h: input.watermarkDegraded24h,
      pipeline: {
        queued: input.pipelineQueued,
        processing: input.pipelineProcessing,
        failed: input.pipelineFailed,
      },
    },
    alerts: {
      ...input.alertsBase,
      alertEvents: input.alertEvents,
      pagination: input.alertsPagination,
    },
    capacity: {
      capacityRows: input.capacityRows,
    },
    runs: {
      runs: input.runs,
      runsTotal: input.runsTotal,
      runsTotalPages: input.runsTotalPages,
      runsPage: input.runsPage,
      baseFilters: input.baseFilters,
      runsExportHref: input.runsExportHref,
    },
  };
}

export function buildObservabilityHeaderViewModel(input: ObservabilityHeaderViewModel): ObservabilityHeaderViewModel {
  return input;
}
