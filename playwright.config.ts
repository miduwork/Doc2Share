import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: chạy khi app đang chạy (npm run dev).
 * Cấu hình: BASE_URL (mặc định http://localhost:3000), E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD.
 * Test login + PDF sẽ skip nếu thiếu email/password.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
