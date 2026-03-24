import { test } from "node:test";
import { strict as assert } from "node:assert";
import { evaluateSecureAccess, type SecureAccessInput } from "./run-secure-access-core.ts";
import { SECURE_ACCESS_DEFAULTS } from "./secure-access-core.ts";

/** Default valid input – happy path base. Override fields as needed per test. */
function validInput(overrides: Partial<SecureAccessInput> = {}): SecureAccessInput {
    return {
        user: { id: "user-1" },
        profile: { role: "student", admin_role: null, is_active: true },
        documentId: "doc-uuid-1",
        deviceId: "dev-1",
        documentFilePath: "grade-1/some-file.pdf",
        activeDeviceIds: ["dev-1"],
        activeSessionDeviceId: "dev-1",
        permission: { expires_at: null },
        successCountLastHour: 0,
        ipSuccessCountLastHour: 0,
        recentDocIds: [],
        blockedCountIn10Min: 0,
        hasIp: true,
        limits: {
            maxDevices: SECURE_ACCESS_DEFAULTS.MAX_DEVICES_PER_USER,
            rateViewsPerHour: SECURE_ACCESS_DEFAULTS.RATE_LIMIT_VIEWS_PER_HOUR,
            ratePerIpPerHour: SECURE_ACCESS_DEFAULTS.RATE_LIMIT_PER_IP_PER_HOUR,
            highFreqDocsIn10Min: SECURE_ACCESS_DEFAULTS.HIGH_FREQ_DOCS_IN_10MIN,
            bruteForceBlockedIn10Min: SECURE_ACCESS_DEFAULTS.BRUTE_FORCE_BLOCKED_IN_10MIN,
        },
        ...overrides,
    };
}

// ---- Happy path ----

test("happy path: valid user with permission → ok", () => {
    const r = evaluateSecureAccess(validInput());
    assert.equal(r.ok, true);
});

// ---- Auth ----

test("unauthenticated user → 401", () => {
    const r = evaluateSecureAccess(validInput({ user: null }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 401);
        assert.equal(r.reason, "unauthenticated");
    }
});

// ---- Input validation ----

test("missing document_id → 400", () => {
    const r = evaluateSecureAccess(validInput({ documentId: null }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 400);
        assert.equal(r.reason, "missing_document_id");
    }
});

test("missing device_id → 400", () => {
    const r = evaluateSecureAccess(validInput({ deviceId: null }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 400);
        assert.equal(r.reason, "missing_device_id");
    }
});

// ---- Brute force ----

test("brute force threshold reached → 429", () => {
    const r = evaluateSecureAccess(validInput({ blockedCountIn10Min: 5 }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 429);
        assert.equal(r.reason, "brute_force");
    }
});

// ---- IP rate limit ----

test("IP rate limit exceeded → 429", () => {
    const r = evaluateSecureAccess(validInput({ ipSuccessCountLastHour: 40 }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 429);
        assert.equal(r.reason, "ip_rate_limit");
    }
});

test("IP rate limit skipped when no IP", () => {
    const r = evaluateSecureAccess(validInput({ hasIp: false, ipSuccessCountLastHour: 999 }));
    assert.equal(r.ok, true);
});

// ---- Profile ----

test("inactive profile → 403", () => {
    const r = evaluateSecureAccess(
        validInput({ profile: { role: "student", admin_role: null, is_active: false } })
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.reason, "inactive_profile");
    }
});

test("banned profile → 403", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const r = evaluateSecureAccess(
        validInput({ profile: { role: "student", admin_role: null, is_active: true, banned_until: future } })
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "inactive_profile");
});

// ---- Device gate ----

test("device limit exceeded → 403", () => {
    const r = evaluateSecureAccess(
        validInput({ activeDeviceIds: ["a", "b"], deviceId: "c" })
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.reason, "device_limit");
    }
});

// ---- Session binding ----

test("no active session → 403", () => {
    const r = evaluateSecureAccess(validInput({ activeSessionDeviceId: null }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.reason, "no_active_session");
    }
});

test("device mismatch → 403", () => {
    const r = evaluateSecureAccess(validInput({ activeSessionDeviceId: "other-device" }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.reason, "device_mismatch");
    }
});

// ---- Permission ----

test("no permission → 403", () => {
    const r = evaluateSecureAccess(validInput({ permission: null }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.reason, "no_permission");
    }
});

test("expired permission → 403", () => {
    const r = evaluateSecureAccess(
        validInput({ permission: { expires_at: "2000-01-01T00:00:00Z" } })
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.reason, "expired_permission");
    }
});

// ---- Rate limits ----

test("hourly rate limit exceeded → 429", () => {
    const r = evaluateSecureAccess(validInput({ successCountLastHour: 20 }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 429);
        assert.equal(r.reason, "hourly_rate_limit");
    }
});

test("high frequency distinct docs → 429", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `d${i}`);
    const r = evaluateSecureAccess(validInput({ recentDocIds: ids, documentId: "new-doc" }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 429);
        assert.equal(r.reason, "high_frequency");
    }
});

// ---- Document not found ----

test("document file_path null → 404", () => {
    const r = evaluateSecureAccess(validInput({ documentFilePath: null }));
    assert.equal(r.ok, false);
    if (!r.ok) {
        assert.equal(r.status, 404);
        assert.equal(r.reason, "document_not_found");
    }
});

// ---- Admin bypass ----

test("super_admin bypasses device + session gates", () => {
    const r = evaluateSecureAccess(
        validInput({
            profile: { role: "admin", admin_role: "super_admin", is_active: true },
            activeDeviceIds: ["a", "b"],
            deviceId: "c",
            activeSessionDeviceId: "other",
            permission: null, // also bypasses permission via isAdminCanReadAny
        })
    );
    assert.equal(r.ok, true);
});

test("content_manager bypasses permission but not device check", () => {
    const r = evaluateSecureAccess(
        validInput({
            profile: { role: "admin", admin_role: "content_manager", is_active: true },
            permission: null, // no permission, but admin can read any
        })
    );
    assert.equal(r.ok, true);
});

test("content_manager blocked by device limit", () => {
    const r = evaluateSecureAccess(
        validInput({
            profile: { role: "admin", admin_role: "content_manager", is_active: true },
            activeDeviceIds: ["a", "b"],
            deviceId: "c",
        })
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "device_limit");
});
