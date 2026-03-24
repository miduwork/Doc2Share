import { test } from "node:test";
import { strict as assert } from "node:assert";
import { runObservabilityMaintenanceCommand } from "./observability-maintenance.command.ts";

function createBaseDeps() {
  const calls = {
    webhook: 0,
    revalidate: 0,
    warned: 0,
  };
  const deps = {
    repository: {
      runBackendMaintenanceManual: async () => ({ runId: "run-1", alertsCount: 2, deletedTotal: 10 }),
      getMaintenanceRunDetails: async () => ({ details: { alerts: [{ id: "a1" }] } }),
    },
    revalidate: async () => {
      calls.revalidate += 1;
    },
    readConfig: () => ({ webhookUrl: "https://example.test/webhook", webhookSecret: "sec" }),
    postWebhook: async () => {
      calls.webhook += 1;
      return { ok: true, responseText: "" };
    },
    nowIso: () => "2026-01-01T00:00:00.000Z",
    logWarn: () => {
      calls.warned += 1;
    },
  };
  return { deps, calls };
}

test("runObservabilityMaintenanceCommand succeeds and revalidates", async () => {
  const { deps, calls } = createBaseDeps();
  const result = await runObservabilityMaintenanceCommand(deps as any);
  assert.equal(result.message.includes("Deleted: 10"), true);
  assert.equal(calls.webhook, 1);
  assert.equal(calls.revalidate, 1);
});

test("runObservabilityMaintenanceCommand passes contract values into webhook body", async () => {
  const { deps } = createBaseDeps();
  let webhookBody = "";
  deps.repository.runBackendMaintenanceManual = async () => ({
    runId: "run-contract",
    alertsCount: 3,
    deletedTotal: 77,
  });
  deps.repository.getMaintenanceRunDetails = async () => ({
    details: { alerts: [{ alert_key: "k1" }] },
  });
  deps.postWebhook = async ({ body }) => {
    webhookBody = body;
    return { ok: true, responseText: "" };
  };

  const result = await runObservabilityMaintenanceCommand(deps as any);
  const parsed = JSON.parse(webhookBody);
  assert.equal(parsed.run_id, "run-contract");
  assert.equal(parsed.alerts_count, 3);
  assert.equal(Array.isArray(parsed.alerts), true);
  assert.equal(result.message.includes("Deleted: 77"), true);
  assert.equal(result.message.includes("Alerts: 3"), true);
});

test("runObservabilityMaintenanceCommand swallows webhook failures", async () => {
  const { deps, calls } = createBaseDeps();
  deps.postWebhook = async () => ({ ok: false, responseText: "bad" });
  const result = await runObservabilityMaintenanceCommand(deps as any);
  assert.equal(result.message.includes("Alerts: 2"), true);
  assert.equal(calls.warned, 1);
  assert.equal(calls.revalidate, 1);
});

test("runObservabilityMaintenanceCommand handles missing details.alerts gracefully", async () => {
  const { deps } = createBaseDeps();
  deps.repository.runBackendMaintenanceManual = async () => ({
    runId: "run-no-alerts-array",
    alertsCount: 1,
    deletedTotal: 5,
  });
  deps.repository.getMaintenanceRunDetails = async () => ({ details: null as any });

  let webhookBody = "";
  deps.postWebhook = async ({ body }) => {
    webhookBody = body;
    return { ok: true, responseText: "" };
  };

  const result = await runObservabilityMaintenanceCommand(deps as any);
  const parsed = JSON.parse(webhookBody);
  assert.equal(Array.isArray(parsed.alerts), true);
  assert.equal(parsed.alerts.length, 0);
  assert.equal(result.message.includes("Deleted: 5"), true);
  assert.equal(result.message.includes("Alerts: 1"), true);
});
