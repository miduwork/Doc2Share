export type LogoutAndCleanupInput = {
  sessionId?: string | null;
  userId?: string | null;
};

export type LogoutAndCleanupDeps = {
  revokeAndClear: (_input: LogoutAndCleanupInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export async function runLogoutAndCleanup(
  input: LogoutAndCleanupInput,
  deps: LogoutAndCleanupDeps
): Promise<void> {
  await deps.revokeAndClear(input);
  try {
    await deps.signOut();
  } catch {
    // signOut is best-effort
  }
}

