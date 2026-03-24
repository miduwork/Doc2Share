/**
 * Pure orchestration logic for secure document access.
 * No I/O, no Supabase, no server-only — testable with node:test.
 *
 * This evaluates pre-fetched data through the full access gate pipeline:
 * brute-force → IP rate → profile → device → session → permission → hourly rate → high-freq → file lookup.
 */
import {
    computeIsAdminCanReadAny,
    computeIsSuperAdmin,
    evaluateDeviceGate,
    evaluateDocumentPermission,
    isProfileActive,
    wouldExceedHighFreqDistinctDocs,
    wouldExceedHourlySuccessLimit,
    type SecureAccessProfile,
} from "./secure-access-core.ts";
import { evaluateSessionDevice, type SessionGateResult } from "./secure-access-core.ts";

// ---- Input types ----

export type SecureAccessInput = {
    /** Authenticated user or null if unauthenticated. */
    user: { id: string } | null;
    /** Profile from DB (null if not found). */
    profile: SecureAccessProfile | null;
    /** Requested document_id (may be empty/invalid). */
    documentId: string | null;
    /** Client device_id (may be empty). */
    deviceId: string | null;
    /** Document file_path from DB (null if doc not found). */
    documentFilePath: string | null;
    /** All device_ids currently registered for the user. */
    activeDeviceIds: string[];
    /** device_id from latest active_sessions row (null if no row). */
    activeSessionDeviceId: string | null;
    /** Permission row for user+document (null if none). */
    permission: { expires_at: string | null } | null;
    /** Count of "success" access_logs in the last hour for this user. */
    successCountLastHour: number;
    /** Count of access_logs (any status) from same IP in the last hour. */
    ipSuccessCountLastHour: number;
    /** document_ids from recent successful views (last 10 min). */
    recentDocIds: (string | null)[];
    /** Count of "blocked" access_logs in the last 10 min for this user. */
    blockedCountIn10Min: number;
    /** Whether an IP was provided (affects IP rate limit check). */
    hasIp: boolean;
    /** Config overrides (defaults from SECURE_ACCESS_DEFAULTS). */
    limits: {
        maxDevices: number;
        rateViewsPerHour: number;
        ratePerIpPerHour: number;
        highFreqDocsIn10Min: number;
        bruteForceBlockedIn10Min: number;
    };
};

// ---- Output types ----

export type SecureAccessDecision =
    | { ok: true }
    | {
        ok: false;
        status: number;
        reason: SecureAccessBlockReason;
    };

export type SecureAccessBlockReason =
    | "unauthenticated"
    | "missing_document_id"
    | "missing_device_id"
    | "brute_force"
    | "ip_rate_limit"
    | "inactive_profile"
    | "device_limit"
    | "no_active_session"
    | "device_mismatch"
    | "no_permission"
    | "expired_permission"
    | "hourly_rate_limit"
    | "high_frequency"
    | "document_not_found";

// ---- Pure evaluation ----

export function evaluateSecureAccess(input: SecureAccessInput): SecureAccessDecision {
    // Step 1: Auth
    if (!input.user) {
        return { ok: false, status: 401, reason: "unauthenticated" };
    }

    // Step 2: Input validation
    if (!input.documentId) {
        return { ok: false, status: 400, reason: "missing_document_id" };
    }
    if (!input.deviceId) {
        return { ok: false, status: 400, reason: "missing_device_id" };
    }

    // Step 3: Brute force guard
    if (input.blockedCountIn10Min >= input.limits.bruteForceBlockedIn10Min) {
        return { ok: false, status: 429, reason: "brute_force" };
    }

    // Step 4: IP rate limit
    if (input.hasIp && input.ipSuccessCountLastHour >= input.limits.ratePerIpPerHour) {
        return { ok: false, status: 429, reason: "ip_rate_limit" };
    }

    // Step 5: Profile active check
    if (!isProfileActive(input.profile)) {
        return { ok: false, status: 403, reason: "inactive_profile" };
    }

    const isSuperAdmin = computeIsSuperAdmin(input.profile);
    const isAdminCanReadAny = computeIsAdminCanReadAny(input.profile);

    // Step 6: Device gate (skip for super_admin)
    if (!isSuperAdmin) {
        const deviceGate = evaluateDeviceGate(
            input.activeDeviceIds,
            input.deviceId,
            isSuperAdmin,
            input.limits.maxDevices
        );
        if (!deviceGate.ok) {
            return { ok: false, status: 403, reason: "device_limit" };
        }

        // Step 7: Session binding (skip for super_admin)
        const sessionGate: SessionGateResult = evaluateSessionDevice(
            input.activeSessionDeviceId,
            input.deviceId,
            isSuperAdmin
        );
        if (!sessionGate.ok) {
            return {
                ok: false,
                status: 403,
                reason: sessionGate.reason === "no_active_session" ? "no_active_session" : "device_mismatch",
            };
        }
    }

    // Step 8: Document permission (skip for admin with read-any)
    if (!isAdminCanReadAny) {
        const permGate = evaluateDocumentPermission(isAdminCanReadAny, input.permission);
        if (!permGate.ok) {
            return {
                ok: false,
                status: 403,
                reason: permGate.reason === "no_permission" ? "no_permission" : "expired_permission",
            };
        }
    }

    // Step 9: Hourly rate limit
    if (wouldExceedHourlySuccessLimit(input.successCountLastHour, input.limits.rateViewsPerHour)) {
        return { ok: false, status: 429, reason: "hourly_rate_limit" };
    }

    // Step 10: High-frequency distinct docs
    if (wouldExceedHighFreqDistinctDocs(input.recentDocIds, input.documentId, input.limits.highFreqDocsIn10Min)) {
        return { ok: false, status: 429, reason: "high_frequency" };
    }

    // Step 11: Document exists
    if (!input.documentFilePath) {
        return { ok: false, status: 404, reason: "document_not_found" };
    }

    return { ok: true };
}
