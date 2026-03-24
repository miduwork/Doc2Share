"use server";

import { createClient } from "@/lib/supabase/server";
import { ok, type ActionResult } from "@/lib/action-result";

import { getSessionCookieId } from "./cookie";
import { revokeAndClearSingleSession } from "./logoutCore";
import { runLogoutAndCleanup } from "./logoutAndCleanupSession.logic";

/**
 * SERVER-ONLY logout entrypoint for client UI.
 * Client components should trigger this action instead of calling Supabase signOut directly.
 *
 * - Revoke current `active_sessions` row (by `session_id` cookie, fallback `user_id`)
 * - Clear httpOnly `doc2share_sid`
 * - Sign out Supabase (clears its auth cookies)
 */
export async function logoutAndCleanupSession(): Promise<ActionResult<void>> {
  const sessionId = await getSessionCookieId();

  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // If Supabase cookies are already invalid, we still want to clear local session cookie.
  }

  await runLogoutAndCleanup(
    { sessionId, userId },
    {
      revokeAndClear: revokeAndClearSingleSession,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }
  );

  return ok();
}

