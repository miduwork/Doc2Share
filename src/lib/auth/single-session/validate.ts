import { getCurrentUser } from "@/lib/auth/current-user-context";
import { evaluatePageSessionBinding } from "@/lib/auth/session-binding-adapter";
import { createClient } from "@/lib/supabase/server";

import { getSessionCookieId } from "./cookie";

/**
 * Kiểm tra single session:
 * - Nếu không có cookie => true
 * - Nếu có cookie => cần `active_sessions` row khớp `(user_id, session_id)`
 *   và Supabase auth còn hợp lệ.
 */
export async function isSingleSessionValidForCurrentUser(): Promise<boolean> {
  const sessionId = await getSessionCookieId();
  const hasSessionCookie = !!sessionId;
  if (!hasSessionCookie) {
    const gate = evaluatePageSessionBinding(false, false);
    return gate.ok;
  }

  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("active_sessions")
    .select("session_id")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  const gate = evaluatePageSessionBinding(hasSessionCookie, row != null);
  return gate.ok;
}

