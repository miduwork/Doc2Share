"use server";

import { createClient } from "@/lib/supabase/server";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { updateSecurityIncidentReview } from "@/lib/admin/incident/security-incident-review";

type SuperAdminAuthContext = { actorUserId: string };

async function ensureSuperAdmin(): Promise<ActionResult<SuperAdminAuthContext>> {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) return fail(guard.error ?? "Bạn không có quyền thực hiện thao tác này.");
  return ok({ actorUserId: guard.context.userId });
}

export async function revokeSessionAndDevices(userId: string): Promise<ActionResult<void>> {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth;
  if (!auth.data) return fail("Không xác định được tài khoản admin.");

  const supabase = await createClient();
  const correlationId = crypto.randomUUID();
  const res1 = await supabase.from("active_sessions").delete().eq("user_id", userId);
  const res2 = await supabase.from("device_logs").delete().eq("user_id", userId);
  if (res1.error || res2.error) {
    return fail(res1.error?.message || res2.error?.message || "Không thể thu hồi phiên");
  }
  const { error: auditError } = await supabase.from("admin_security_actions").insert({
    action_type: "revoke",
    target_user_id: userId,
    actor_user_id: auth.data.actorUserId,
    correlation_id: correlationId,
    metadata: { correlation_id: correlationId },
  });
  if (auditError) return fail(auditError.message);
  return ok();
}

export async function temporaryBanUser(userId: string, reason?: string): Promise<ActionResult<void>> {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth;
  if (!auth.data) return fail("Không xác định được tài khoản admin.");

  const supabase = await createClient();
  const correlationId = crypto.randomUUID();
  const bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("profiles").update({ banned_until: bannedUntil }).eq("id", userId);
  if (error) return fail(error.message);
  const { error: auditError } = await supabase.from("admin_security_actions").insert({
    action_type: "temporary_ban",
    target_user_id: userId,
    actor_user_id: auth.data.actorUserId,
    correlation_id: correlationId,
    reason: reason ?? null,
    metadata: { banned_until: bannedUntil, correlation_id: correlationId },
  });
  if (auditError) return fail(auditError.message);
  return ok();
}

export async function panicUser(userId: string, reason?: string): Promise<ActionResult<void>> {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth;
  if (!auth.data) return fail("Không xác định được tài khoản admin.");

  const supabase = await createClient();
  const correlationId = crypto.randomUUID();
  const { error } = await supabase.rpc("panic_user_atomic", {
    p_user_id: userId,
    p_actor_id: auth.data.actorUserId,
    p_reason: reason ?? null,
    p_metadata: { correlation_id: correlationId },
  });
  if (error) {
    return fail(error.message || "Panic thất bại");
  }
  return ok();
}

export async function forceLogoutSession(sessionId: string): Promise<ActionResult<void>> {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth;
  if (!auth.data) return fail("Không xác định được tài khoản admin.");

  const supabase = await createClient();
  const correlationId = crypto.randomUUID();
  const { data: sessionRow, error: sessionError } = await supabase
    .from("active_sessions")
    .select("user_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (sessionError) return fail(sessionError.message);

  const { error } = await supabase.from("active_sessions").delete().eq("session_id", sessionId);
  if (error) return fail(error.message);
  const { error: auditError } = await supabase.from("admin_security_actions").insert({
    action_type: "force_logout",
    target_user_id: sessionRow?.user_id ?? null,
    actor_user_id: auth.data.actorUserId,
    correlation_id: correlationId,
    metadata: { session_id: sessionId, correlation_id: correlationId },
  });
  if (auditError) return fail(auditError.message);
  return ok();
}

export async function reviewSecurityIncident(params: {
  incidentId: string;
  reviewStatus: "pending" | "confirmed_risk" | "false_positive";
  notes?: string;
}): Promise<ActionResult<void>> {
  return reviewSecurityIncidentWithDeps(params, {
    ensureSuperAdmin,
    createClient,
    updateSecurityIncidentReview,
  });
}

export async function reviewSecurityIncidentWithDeps(
  params: {
    incidentId: string;
    reviewStatus: "pending" | "confirmed_risk" | "false_positive";
    notes?: string;
  },
  deps: {
    ensureSuperAdmin: typeof ensureSuperAdmin;
    createClient: typeof createClient;
    updateSecurityIncidentReview: typeof updateSecurityIncidentReview;
  }
): Promise<ActionResult<void>> {
  const auth = await deps.ensureSuperAdmin();
  if (!auth.ok) return auth;
  if (!auth.data) return fail("Không xác định được tài khoản admin.");
  const supabase = await deps.createClient();
  try {
    await deps.updateSecurityIncidentReview({
      supabase,
      incidentId: params.incidentId,
      reviewStatus: params.reviewStatus,
      notes: params.notes,
      actorUserId: auth.data.actorUserId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể cập nhật incident.";
    return fail(message);
  }
  return ok();
}

export async function forensicLookup(params: {
  wmShort: string;
  documentId?: string;
}): Promise<ActionResult<any[]>> {
  const auth = await ensureSuperAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  let query = supabase
    .from("access_logs")
    .select(`
      id,
      created_at,
      ip_address,
      device_id,
      metadata,
      profiles:user_id (id, full_name, role),
      documents:document_id (id, title)
    `)
    .eq("status", "success")
    .filter("metadata->>wm_short", "eq", params.wmShort)
    .order("created_at", { ascending: false });

  if (params.documentId) {
    query = query.eq("document_id", params.documentId);
  }

  const { data, error } = await query;
  if (error) return fail(error.message);
  return ok(data ?? []);
}
