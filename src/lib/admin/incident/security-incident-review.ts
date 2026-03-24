import type { SupabaseClient } from "@supabase/supabase-js";

export async function updateSecurityIncidentReview({
  supabase,
  incidentId,
  reviewStatus,
  notes,
  actorUserId,
}: {
  supabase: SupabaseClient;
  incidentId: string;
  reviewStatus: "pending" | "confirmed_risk" | "false_positive";
  notes?: string;
  actorUserId?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    review_status: reviewStatus,
    reviewed_at: new Date().toISOString(),
  };
  if (typeof notes !== "undefined") payload.notes = notes;
  if (actorUserId) payload.reviewed_by = actorUserId;
  const { error } = await supabase.from("security_incidents").update(payload).eq("id", incidentId);
  if (error) throw new Error(error.message);
}
