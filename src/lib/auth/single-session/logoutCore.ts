import { clearSessionCookieId } from "./cookie";
import { revokeActiveSessionsBySessionId, revokeActiveSessionsByUserId } from "./activeSessions";
import {
  revokeAndClearSingleSessionWithDeps,
  type RevokeAndClearSingleSessionInput,
} from "./logoutCore.logic";

/**
 * SERVER-ONLY core cleanup for single-session auth.
 * Shared by server actions and middleware so cookie/db cleanup stays centralized.
 *
 * - revoke `active_sessions` (prefer session_id, fallback user_id)
 * - clear single-session cookie on response/cookieStore
 */
export async function revokeAndClearSingleSession({
  sessionId,
  userId,
  response,
}: RevokeAndClearSingleSessionInput): Promise<void> {
  await revokeAndClearSingleSessionWithDeps(
    { sessionId, userId, response },
    {
      revokeBySessionId: revokeActiveSessionsBySessionId,
      revokeByUserId: revokeActiveSessionsByUserId,
      clearCookie: clearSessionCookieId,
    }
  );
}

