import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  canManageDocuments,
  canManageUsers,
  computeAdminContext,
  type AdminContextProfile,
} from "./guards-core.ts";

// --- canManageDocuments ---
test("canManageDocuments returns false for null", () => {
  assert.equal(canManageDocuments(null), false);
});

test("canManageDocuments returns true for super_admin and content_manager", () => {
  assert.equal(canManageDocuments("super_admin"), true);
  assert.equal(canManageDocuments("content_manager"), true);
});

test("canManageDocuments returns false for support_agent", () => {
  assert.equal(canManageDocuments("support_agent"), false);
});

// --- canManageUsers ---
test("canManageUsers returns false for null", () => {
  assert.equal(canManageUsers(null), false);
});

test("canManageUsers returns true for super_admin and support_agent", () => {
  assert.equal(canManageUsers("super_admin"), true);
  assert.equal(canManageUsers("support_agent"), true);
});

test("canManageUsers returns false for content_manager", () => {
  assert.equal(canManageUsers("content_manager"), false);
});

// --- computeAdminContext ---
test("computeAdminContext returns not logged in when user is null", () => {
  const result = computeAdminContext(null, null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Bạn chưa đăng nhập.");
});

test("computeAdminContext returns not logged in when user present but profile null", () => {
  const result = computeAdminContext({ id: "u1" }, null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Bạn không có quyền thực hiện thao tác này.");
});

test("computeAdminContext rejects non-admin role", () => {
  const profile: AdminContextProfile = {
    role: "student",
    admin_role: null,
    is_active: true,
  };
  const result = computeAdminContext({ id: "u1" }, profile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Bạn không có quyền thực hiện thao tác này.");
});

test("computeAdminContext rejects inactive admin", () => {
  const profile: AdminContextProfile = {
    role: "admin",
    admin_role: "super_admin",
    is_active: false,
  };
  const result = computeAdminContext({ id: "u1" }, profile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Bạn không có quyền thực hiện thao tác này.");
});

test("computeAdminContext rejects currently banned admin", () => {
  const profile: AdminContextProfile = {
    role: "admin",
    admin_role: "super_admin",
    is_active: true,
    banned_until: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  const result = computeAdminContext({ id: "u1" }, profile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Bạn không có quyền thực hiện thao tác này.");
});

test("computeAdminContext returns context for active super_admin", () => {
  const profile: AdminContextProfile = {
    role: "admin",
    admin_role: "super_admin",
    is_active: true,
  };
  const result = computeAdminContext({ id: "u-super" }, profile);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.context.userId, "u-super");
    assert.equal(result.context.adminRole, "super_admin");
  }
});

test("computeAdminContext returns context for active content_manager", () => {
  const profile: AdminContextProfile = {
    role: "admin",
    admin_role: "content_manager",
    is_active: true,
  };
  const result = computeAdminContext({ id: "u-cm" }, profile);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.context.userId, "u-cm");
    assert.equal(result.context.adminRole, "content_manager");
  }
});

test("computeAdminContext returns context for active support_agent", () => {
  const profile: AdminContextProfile = {
    role: "admin",
    admin_role: "support_agent",
    is_active: true,
  };
  const result = computeAdminContext({ id: "u-sa" }, profile);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.context.userId, "u-sa");
    assert.equal(result.context.adminRole, "support_agent");
  }
});

test("computeAdminContext treats null admin_role as null in context", () => {
  const profile: AdminContextProfile = {
    role: "admin",
    admin_role: null,
    is_active: true,
  };
  const result = computeAdminContext({ id: "u-legacy" }, profile);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.context.userId, "u-legacy");
    assert.equal(result.context.adminRole, null);
  }
});
