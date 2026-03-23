import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  computeIsAdminCanReadAny,
  computeIsSuperAdmin,
  evaluateDeviceGate,
  evaluateDocumentPermission,
  evaluateSessionDevice,
  isProfileActive,
  wouldExceedHighFreqDistinctDocs,
  wouldExceedHourlySuccessLimit,
  parsePositiveIntEnv,
  SECURE_ACCESS_DEFAULTS,
} from "./secure-access-core.ts";

test("isProfileActive false for null or inactive", () => {
  assert.equal(isProfileActive(null), false);
  assert.equal(isProfileActive({ role: "student", admin_role: null, is_active: false }), false);
});

test("computeIsSuperAdmin", () => {
  assert.equal(computeIsSuperAdmin({ role: "admin", admin_role: "super_admin" }), true);
  assert.equal(computeIsSuperAdmin({ role: "admin", admin_role: "content_manager" }), false);
  assert.equal(computeIsSuperAdmin(null), false);
});

test("computeIsAdminCanReadAny", () => {
  assert.equal(computeIsAdminCanReadAny({ role: "admin", admin_role: "content_manager" }), true);
  assert.equal(computeIsAdminCanReadAny({ role: "admin", admin_role: "support_agent" }), false);
});

test("evaluateDeviceGate allows super_admin past limit", () => {
  const r = evaluateDeviceGate(["a", "b"], "c", true, SECURE_ACCESS_DEFAULTS.MAX_DEVICES_PER_USER);
  assert.equal(r.ok, true);
});

test("evaluateDeviceGate blocks third new device", () => {
  const r = evaluateDeviceGate(["a", "b"], "c", false, 2);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "device_limit");
});

test("evaluateDeviceGate allows known device", () => {
  const r = evaluateDeviceGate(["a", "b"], "a", false, 2);
  assert.equal(r.ok, true);
});

test("evaluateSessionDevice no_active_session", () => {
  const r = evaluateSessionDevice(null, "dev1", false);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "no_active_session");
});

test("evaluateSessionDevice device_mismatch", () => {
  const r = evaluateSessionDevice("a", "b", false);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "device_mismatch");
});

test("evaluateSessionDevice super_admin skips", () => {
  assert.equal(evaluateSessionDevice(null, "x", true).ok, true);
});

test("evaluateDocumentPermission admin bypass", () => {
  assert.equal(evaluateDocumentPermission(true, null).ok, true);
});

test("evaluateDocumentPermission no_permission", () => {
  const r = evaluateDocumentPermission(false, null);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "no_permission");
});

test("evaluateDocumentPermission expired", () => {
  const r = evaluateDocumentPermission(false, { expires_at: "2000-01-01T00:00:00.000Z" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "expired");
});

test("wouldExceedHourlySuccessLimit", () => {
  assert.equal(wouldExceedHourlySuccessLimit(19, 20), false);
  assert.equal(wouldExceedHourlySuccessLimit(20, 20), true);
});

test("wouldExceedHighFreqDistinctDocs", () => {
  const ids = Array.from({ length: 15 }, (_, i) => `d${i}`);
  assert.equal(wouldExceedHighFreqDistinctDocs(ids, "new", 15), true);
  assert.equal(wouldExceedHighFreqDistinctDocs(ids, "d0", 15), false);
});

test("parsePositiveIntEnv", () => {
  assert.equal(parsePositiveIntEnv("25", 20), 25);
  assert.equal(parsePositiveIntEnv(undefined, 20), 20);
  assert.equal(parsePositiveIntEnv("bad", 20), 20);
});
