import { test } from "node:test";
import { strict as assert } from "node:assert";

import { revokeAndClearSingleSessionWithDeps } from "./logoutCore.logic.ts";

test("prefer sessionId over userId when both are present", async () => {
  const calls: string[] = [];

  await revokeAndClearSingleSessionWithDeps(
    { sessionId: "sid_1", userId: "uid_1" },
    {
      revokeBySessionId: async (sid) => {
        calls.push(`revokeBySessionId:${sid}`);
      },
      revokeByUserId: async (uid) => {
        calls.push(`revokeByUserId:${uid}`);
      },
      clearCookie: async () => {
        calls.push("clearCookie");
      },
    }
  );

  assert.deepEqual(calls, ["revokeBySessionId:sid_1", "clearCookie"]);
});

test("fallback to userId when sessionId is missing", async () => {
  const calls: string[] = [];

  await revokeAndClearSingleSessionWithDeps(
    { userId: "uid_2" },
    {
      revokeBySessionId: async () => {
        calls.push("revokeBySessionId");
      },
      revokeByUserId: async (uid) => {
        calls.push(`revokeByUserId:${uid}`);
      },
      clearCookie: async () => {
        calls.push("clearCookie");
      },
    }
  );

  assert.deepEqual(calls, ["revokeByUserId:uid_2", "clearCookie"]);
});

test("always clear cookie even when revoke throws", async () => {
  const calls: string[] = [];

  await revokeAndClearSingleSessionWithDeps(
    { sessionId: "sid_3" },
    {
      revokeBySessionId: async () => {
        calls.push("revokeBySessionId");
        throw new Error("db down");
      },
      revokeByUserId: async () => {
        calls.push("revokeByUserId");
      },
      clearCookie: async () => {
        calls.push("clearCookie");
      },
    }
  );

  assert.deepEqual(calls, ["revokeBySessionId", "clearCookie"]);
});

test("clear cookie even when both sessionId and userId are missing", async () => {
  const calls: string[] = [];  await revokeAndClearSingleSessionWithDeps(
    {},
    {
      revokeBySessionId: async () => {
        calls.push("revokeBySessionId");
      },
      revokeByUserId: async () => {
        calls.push("revokeByUserId");
      },
      clearCookie: async () => {
        calls.push("clearCookie");
      },
    }
  );  assert.deepEqual(calls, ["clearCookie"]);
});
