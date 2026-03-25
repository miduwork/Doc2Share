import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { MetricRow, ObservabilityBaseFilters } from "../../../app/admin/observability/types.ts";
import { buildObservabilitySectionViewModels } from "./section-view-models.ts";

test("buildObservabilitySectionViewModels maps section contracts with minimal props", () => {
  const baseFilters: ObservabilityBaseFilters = {
    preset: "custom",
    window: "24h",
    severity: "all",
    source: "all",
    event_type: "all",
    alerts_cursor: "",
    alerts_dir: "next",
    alerts_page: "1",
    runs_page: "1",
    alerts_page_size: "20",
    runs_page_size: "20",
    export_limit: "2000",
  };

  const metrics: MetricRow = {
    events_24h: 10,
    errors_24h: 1,
    webhook_events_24h: 5,
    webhook_errors_24h: 0,
    secure_link_events_24h: 4,
    secure_link_blocked_24h: 0,
    webhook_avg_latency_ms_24h: 25,
    secure_link_avg_latency_ms_24h: 40,
    payment_webhook_access_logs_24h: 3,
  };

  const mapped = buildObservabilitySectionViewModels({
    metrics,
    watermarkDegraded24h: 4,
    pipelineQueued: 7,
    pipelineProcessing: 2,
    pipelineFailed: 1,
    alertsBase: {
      selectedPreset: "custom",
      selectedWindow: "24h",
      selectedSeverity: "all",
      selectedSource: "all",
      selectedEventType: "all",
      alertsPageSize: 20,
      runsPageSize: 20,
      exportLimit: 2000,
      baseFilters,
      alertsExportHref: "/admin/observability/export/alerts",
      sourceOptions: ["all"],
      eventTypeOptions: ["all", "blocked"],
      latestRunAlerts: [],
    },
    alertEvents: [
      {
        id: "e1",
        created_at: "2026-03-24T00:00:00.000Z",
        severity: "warn",
        source: "db.alerts",
        event_type: "threshold",
        metadata: null,
      },
    ],
    alertsPagination: { nextCursor: "next-1", prevCursor: null },
    capacityRows: [],
    runs: [],
    runsTotal: 0,
    runsTotalPages: 1,
    runsPage: 1,
    baseFilters,
    runsExportHref: "/admin/observability/export/maintenance",
  });

  assert.equal(mapped.kpi.pipeline.queued, 7);
  assert.equal(mapped.kpi.watermarkDegraded24h, 4);
  assert.equal(mapped.kpi.pipeline.processing, 2);
  assert.equal(mapped.kpi.pipeline.failed, 1);
  assert.equal(mapped.alerts.alertEvents.length, 1);
  assert.equal(mapped.alerts.pagination.nextCursor, "next-1");
  assert.equal(mapped.capacity.capacityRows.length, 0);
  assert.equal(mapped.runs.runsTotalPages, 1);
  assert.equal(mapped.runs.baseFilters.window, "24h");
});
