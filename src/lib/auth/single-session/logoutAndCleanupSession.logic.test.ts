import { test } from "node:test";
import { strict as assert } from "node:assert";

import { runLogoutAndCleanup } from "./logoutAndCleanupSession.logic.ts";

test("logout orchestration uses sessionId path and then signOut", async () => {
  const calls: string[] = [];

  await runLogoutAndCleanup(
    { sessionId: "sid_1", userId: "uid_1" },
    {
      revokeAndClear: async ({ sessionId, userId }) => {
        calls.push(`revoke:${sessionId ?? "none"}:${userId ?? "none"}`);
      },
      signOut: async () => {
        calls.push("signOut");
      },
    }
  );

  assert.deepEqual(calls, ["revoke:sid_1:uid_1", "signOut"]);
});

test("logout orchestration supports fallback userId when sessionId missing", async () => {
  const calls: string[] = [];

  await runLogoutAndCleanup(
    { userId: "uid_2" },
    {
      revokeAndClear: async ({ sessionId, userId }) => {
        calls.push(`revoke:${sessionId ?? "none"}:${userId ?? "none"}`);
      },
      signOut: async () => {
        calls.push("signOut");
      },
    }
  );

  assert.deepEqual(calls, ["revoke:none:uid_2", "signOut"]);
});

test("logout orchestration treats signOut as best-effort", async () => {
  const calls: string[] = [];

  await runLogoutAndCleanup(
    { sessionId: "sid_3" },
    {
      revokeAndClear: async () => {
        calls.push("revoke");
      },
      signOut: async () => {
        calls.push("signOut");
        throw new Error("network");
      },
    }
  );

  assert.deepEqual(calls, ["revoke", "signOut"]);
});

