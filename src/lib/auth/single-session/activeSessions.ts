import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function revokeActiveSessionsBySessionId(sessionId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.from("active_sessions").delete().eq("session_id", sessionId);
  if (error) throw error;
}

export async function revokeActiveSessionsByUserId(userId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.from("active_sessions").delete().eq("user_id", userId);
  if (error) throw error;
}

