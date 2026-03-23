/**
 * E2E: Checkout tạo đơn và hiển thị trạng thái pending.
 * Cần: BASE_URL, E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD, E2E_CHECKOUT_DOCUMENT_ID (UUID tài liệu published, user đã login có thể mua).
 * App phải đang chạy (npm run dev). Test skip nếu thiếu biến.
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_LOGIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "";
const DOCUMENT_ID = process.env.E2E_CHECKOUT_DOCUMENT_ID ?? "";
const SKIP = !EMAIL || !PASSWORD || !DOCUMENT_ID;

test.describe("Checkout pending", () => {
  test("shows pending order status after creating checkout", async ({ page }) => {
    test.skip(SKIP, "Thiếu E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD hoặc E2E_CHECKOUT_DOCUMENT_ID");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mật khẩu|password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|login|submit/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 15000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Đăng nhập thất bại — kiểm tra tài khoản E2E");
    }

    await page.goto(`/checkout?document_id=${encodeURIComponent(DOCUMENT_ID)}`);
    await expect(page.getByRole("heading", { name: /Thanh toán VietQR/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Đang tạo đơn hàng")).not.toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("checkout-order-status")).toHaveText(/pending/i, { timeout: 15000 });
  });
});
