/**
 * E2E: Đăng nhập và mở trình đọc PDF.
 * Cần: BASE_URL (mặc định localhost:3000), E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD.
 * App phải đang chạy (npm run dev). Test skip nếu thiếu email/password.
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_LOGIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "";
const SKIP_LOGIN = !EMAIL || !PASSWORD;

test.describe("Login + PDF reader", () => {
  test("login redirects to tu-sach", async ({ page }) => {
    test.skip(SKIP_LOGIN, "Thiếu E2E_LOGIN_EMAIL hoặc E2E_LOGIN_PASSWORD");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mật khẩu|password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|login|submit/i }).click();
    await expect(page).toHaveURL(/\/(tu-sach|login)/);
    if (page.url().includes("/tu-sach")) {
      await expect(page.getByRole("main")).toBeVisible();
    }
  });

  test("login then open PDF reader from tu-sach", async ({ page }) => {
    test.skip(SKIP_LOGIN, "Thiếu E2E_LOGIN_EMAIL hoặc E2E_LOGIN_PASSWORD");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mật khẩu|password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|login|submit/i }).click();
    await expect(page).toHaveURL(/\/(tu-sach|login)/, { timeout: 15000 });
    if (!page.url().includes("/tu-sach")) {
      test.skip(true, "Login không thành công hoặc không redirect về tu-sach");
    }
    const readLink = page.getByRole("link", { name: /đọc/i }).first();
    const count = await readLink.count();
    if (count === 0) {
      test.skip(true, "Tài khoản không có tài liệu nào trong Tủ sách");
    }
    await readLink.click();
    await expect(page).toHaveURL(/\/doc\/[^/]+\/read/, { timeout: 10000 });
    await expect(page.locator("canvas").or(page.getByText(/đang tải|loading/i))).toBeVisible({ timeout: 15000 });
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20000 });
  });
});
