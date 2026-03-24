import { test } from "node:test";

/**
 * Deferred integration test:
 * Requires a stable Supabase integration fixture with controllable auth cookies.
 * Enable when env + seeded data are available.
 */
test("logout cleanup integration (deferred)", { skip: true }, () => {
  // Intentionally skipped for now.
  // Target contract:
  // 1) call logout action
  // 2) assert doc2share_sid cookie cleared
  // 3) assert active_sessions row revoked
});

