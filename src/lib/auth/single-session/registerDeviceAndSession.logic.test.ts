import { test } from "node:test";
import { strict as assert } from "node:assert";

import { evaluateRegisterDevicePolicy } from "./registerDeviceAndSession.logic.ts";

test("blocks third new device for non-admin user", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: false,
    existingDevices: [{ device_id: "d1", hardware_hash: null }, { device_id: "d2", hardware_hash: null }],
    currentDeviceId: "d3",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Tối đa 2 thiết bị/);
});

test("allows existing device even when already at max", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: false,
    existingDevices: [{ device_id: "d1", hardware_hash: null }, { device_id: "d2", hardware_hash: null }],
    currentDeviceId: "d2",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.isNewDevice, false);
});

test("super_admin bypasses max device policy", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: true,
    existingDevices: [{ device_id: "d1", hardware_hash: null }, { device_id: "d2", hardware_hash: null }, { device_id: "d3", hardware_hash: null }],
    currentDeviceId: "d4",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.isNewDevice, true);
});

test("auto-recovers device if hardware hash exactly matches an existing device", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: false,
    existingDevices: [{ device_id: "fp_old", hardware_hash: "hash_123" }],
    currentDeviceId: "fp_incognito_new",
    currentHardwareHash: "hash_123",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.isNewDevice, false);
    assert.equal(result.recoveredDeviceId, "fp_old");
  }
});

