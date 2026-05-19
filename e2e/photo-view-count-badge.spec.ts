import { test, expect } from "@playwright/test";

// Ensures the view-count badge (👁) on /photo/$id is visible to anonymous
// (logged-out) visitors and remains correct after a hard refresh.
test.describe("Photo detail — view-count badge for guests", () => {
  test("badge is visible for logged-out users and updates after refresh", async ({ page, context }) => {
    // Guarantee a clean, unauthenticated session.
    await context.clearCookies();

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    // Pick the first photo from the feed.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const href = await firstPhoto.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[\w-]+$/);

    // Navigate to the detail page as a guest.
    await page.goto(href!);

    // Badge must render for unauthenticated visitors (no vote, not owner).
    const badge = page.getByTestId("view-count");
    await expect(badge).toBeVisible({ timeout: 15_000 });

    const parseCount = async () => {
      const text = (await badge.textContent()) ?? "";
      const digits = text.replace(/[^\d]/g, "");
      expect(digits.length, `expected numeric view count, got "${text}"`).toBeGreaterThan(0);
      return Number(digits);
    };

    const initial = await parseCount();
    expect(initial).toBeGreaterThanOrEqual(0);
    await expect(badge).toContainText(/วิว/);

    // Hard refresh — badge must still render and value must be consistent
    // (idempotent server-side throttling means it should not increase on
    // a second visit from the same anonymous session within the window).
    await page.reload();
    await expect(badge).toBeVisible({ timeout: 15_000 });
    const afterReload = await parseCount();
    expect(afterReload).toBeGreaterThanOrEqual(initial);

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});