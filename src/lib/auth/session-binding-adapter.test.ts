import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  evaluateApiSessionBinding,
  evaluatePageSessionBinding,
  toSessionBindingErrorMessage,
} from "./session-binding-adapter.ts";

test("evaluateApiSessionBinding: super_admin bypasses session checks", () => {
  const result = evaluateApiSessionBinding(null, "device_a", true);
  assert.equal(result.ok, true);
});

test("evaluateApiSessionBinding: returns no_active_session when active session missing", () => {
  const result = evaluateApiSessionBinding(null, "device_a", false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "no_active_session");
});

test("evaluateApiSessionBinding: returns device_mismatch when devices differ", () => {
  const result = evaluateApiSessionBinding("device_a", "device_b", false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "device_mismatch");
});

test("evaluateApiSessionBinding: allows when active and request devices match", () => {
  const result = evaluateApiSessionBinding("device_a", "device_a", false);
  assert.equal(result.ok, true);
});

test("evaluatePageSessionBinding: pass-through when cookie is missing", () => {
  const result = evaluatePageSessionBinding(false, false);
  assert.equal(result.ok, true);
});

test("evaluatePageSessionBinding: fail with session_replaced when cookie exists but no matching row", () => {
  const result = evaluatePageSessionBinding(true, false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "session_replaced");
});

test("toSessionBindingErrorMessage maps known reasons", () => {
  assert.match(toSessionBindingErrorMessage("no_active_session"), /Phiên chưa được đăng ký/);
  assert.match(toSessionBindingErrorMessage("device_mismatch"), /thiết bị khác/);
  assert.match(toSessionBindingErrorMessage("session_replaced"), /được thay thế/);
});

