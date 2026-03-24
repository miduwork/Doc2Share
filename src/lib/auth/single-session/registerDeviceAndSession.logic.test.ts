import { test } from "node:test";
import { strict as assert } from "node:assert";

import { evaluateRegisterDevicePolicy } from "./registerDeviceAndSession.logic.ts";

test("blocks third new device for non-admin user", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: false,
    existingDeviceIds: ["d1", "d2"],
    currentDeviceId: "d3",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Tối đa 2 thiết bị/);
});

test("allows existing device even when already at max", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: false,
    existingDeviceIds: ["d1", "d2"],
    currentDeviceId: "d2",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.isNewDevice, false);
});

test("super_admin bypasses max device policy", () => {
  const result = evaluateRegisterDevicePolicy({
    isSuperAdmin: true,
    existingDeviceIds: ["d1", "d2", "d3"],
    currentDeviceId: "d4",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.isNewDevice, true);
});

