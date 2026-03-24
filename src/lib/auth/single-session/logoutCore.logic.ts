import type { NextResponse } from "next/server";

export type RevokeAndClearSingleSessionInput = {
  sessionId?: string | null;
  userId?: string | null;
  response?: NextResponse;
};

export type LogoutCoreDeps = {
  revokeBySessionId: (_sessionId: string) => Promise<void>;
  revokeByUserId: (_userId: string) => Promise<void>;
  clearCookie: (_response?: NextResponse) => Promise<void>;
};

export async function revokeAndClearSingleSessionWithDeps(
  { sessionId, userId, response }: RevokeAndClearSingleSessionInput,
  deps: LogoutCoreDeps
): Promise<void> {
  try {
    if (sessionId) {
      await deps.revokeBySessionId(sessionId);
    } else if (userId) {
      await deps.revokeByUserId(userId);
    }
  } catch (e) {
    console.error("revokeAndClearSingleSession: revoke active_sessions failed", e);
  }

  await deps.clearCookie(response);
}

