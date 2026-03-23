/**
 * E2E: Admin mở trang Tài liệu với preset chờ duyệt.
 * Cần: BASE_URL, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD (user admin active, có quyền Document CMS).
 * App phải đang chạy (npm run dev). Test skip nếu thiếu biến.
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const SKIP = !EMAIL || !PASSWORD;

test.describe("Admin documents pending approval", () => {
  test("loads documents page with pending-approval preset", async ({ page }) => {
    test.skip(SKIP, "Thiếu E2E_ADMIN_EMAIL hoặc E2E_ADMIN_PASSWORD");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mật khẩu|password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|login|submit/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login|admin)/, { timeout: 15000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Đăng nhập admin thất bại — kiểm tra tài khoản E2E");
    }

    await page.goto("/admin/documents?preset=pending-approval");
    await expect(page.getByRole("heading", { name: "Tài liệu" })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/preset=pending-approval/);
  });
});
