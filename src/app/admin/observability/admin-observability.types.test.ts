import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  DEFAULT_OBSERVABILITY_FILTERS,
  getPresetDefaults,
  resolveObservabilityDirection,
  resolveObservabilityPreset,
  resolveObservabilitySeverity,
  resolveObservabilitySource,
  resolveObservabilityWindow,
} from "@/features/admin/observability/filters/model/filters.types";

test("observability filter defaults stay stable", () => {
  assert.equal(DEFAULT_OBSERVABILITY_FILTERS.preset, "custom");
  assert.equal(DEFAULT_OBSERVABILITY_FILTERS.window, "24h");
  assert.equal(DEFAULT_OBSERVABILITY_FILTERS.severity, "all");
  assert.equal(DEFAULT_OBSERVABILITY_FILTERS.source, "all");
  assert.equal(DEFAULT_OBSERVABILITY_FILTERS.alertsDirection, "next");
});

test("preset defaults are mapped correctly", () => {
  const webhookErrors = getPresetDefaults("webhook-errors");
  assert.equal(webhookErrors.window, "24h");
  assert.equal(webhookErrors.severity, "error");
  assert.equal(webhookErrors.source, "edge.payment_webhook");

  const secureLinkBlocked = getPresetDefaults("secure-link-blocked");
  assert.equal(secureLinkBlocked.eventType, "blocked");
});

test("resolvers clamp unknown values to defaults", () => {
  assert.equal(resolveObservabilityPreset("unknown"), "custom");
  assert.equal(resolveObservabilityWindow("bad-window"), "24h");
  assert.equal(resolveObservabilitySeverity("fatal"), "all");
  assert.equal(resolveObservabilitySource("other.source"), "all");
  assert.equal(resolveObservabilityDirection("forward"), "next");
});
