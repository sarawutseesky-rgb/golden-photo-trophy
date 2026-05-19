import { test, expect } from "@playwright/test";

// Stronger guarantee: as an anonymous VISITOR, the view-count badge (👁) on
// the Rating card must NEVER disappear and NEVER decrease across multiple hard
// refreshes performed back-to-back within the server-side throttle window.
test.describe("Photo detail — guest view-count badge is stable across hard refreshes", () => {
  test("badge stays visible and value is monotonic non-decreasing for guests", async ({ page, context }) => {
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

    const badge = page.getByTestId("view-count");
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText(/วิว/);

    const readCount = async () => {
      await expect(badge).toBeVisible();
      const text = (await badge.textContent()) ?? "";
      const digits = text.replace(/[^\d]/g, "");
      expect(digits.length, `expected numeric view count, got "${text}"`).toBeGreaterThan(0);
      return Number(digits);
    };

    // Capture initial value.
    const counts: number[] = [await readCount()];

    // Perform several hard refreshes in quick succession.
    for (let i = 0; i < 4; i++) {
      await page.reload();
      await expect(badge, `badge disappeared after refresh #${i + 1}`).toBeVisible({ timeout: 15_000 });
      counts.push(await readCount());
    }

    // Assert badge value is monotonic non-decreasing and never undefined/zero-dropped.
    for (let i = 1; i < counts.length; i++) {
      expect(
        counts[i],
        `view count regressed: ${counts.join(" → ")} (decrease at refresh #${i})`,
      ).toBeGreaterThanOrEqual(counts[i - 1]);
    }

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});
