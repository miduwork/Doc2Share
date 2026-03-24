/**
 * Smoke: /cua-hang DiscoveryFilters reset clears query and page renders without runtime errors.
 * Cần app chạy: npm run dev. BASE_URL mặc định http://localhost:3000
 */
import { test, expect } from "@playwright/test";

const QUERY = "grade=1&subject=2&page=2&sort=price_asc";

test.describe("cua-hang filters reset", () => {
  test("smoke: /cua-hang renders without client runtime errors", async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/cua-hang");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Kho tài liệu" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Nổi bật" })).toBeVisible();
    await expect(page.locator("main article").first()).toBeVisible();
    await expect(runtimeErrors).toEqual([]);
  });

  test("mobile viewport: Xóa lọc clears URL to /cua-hang", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/cua-hang?${QUERY}`);
    await page.waitForLoadState("load");
    const mobileBar = page.locator("main section").first().getByRole("link", { name: "Xóa lọc" });
    await expect(mobileBar).toBeVisible({ timeout: 15000 });
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/cua-hang" && url.search === "", { timeout: 15000 }),
      mobileBar.click(),
    ]);
  });

  test("desktop viewport: Xóa lọc clears URL to /cua-hang", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/cua-hang?${QUERY}`);
    await page.waitForLoadState("load");
    const resetBtn = page.locator("main aside").getByRole("link", { name: "Xóa lọc" });
    await expect(resetBtn).toBeVisible({ timeout: 15000 });
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/cua-hang" && url.search === "", { timeout: 15000 }),
      resetBtn.click(),
    ]);
  });
});
