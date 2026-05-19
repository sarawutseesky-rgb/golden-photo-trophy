import { test, expect } from "@playwright/test";

// Simulate a stale client bundle whose serverFn IDs no longer exist on the
// server: the first /_serverFn/ call returns 404 with a "serverFn not found"
// body. The stale-bundle guard installed in __root.tsx must detect this and
// hard-reload the page with a `?__v=...` cache-busting query param. After the
// reload, real serverFn calls succeed and the feed is not empty.
test.describe("Stale bundle guard", () => {
  test("hard-reloads with cache-busting and recovers the feed", async ({ page }) => {
    let intercepted = 0;

    await page.route("**/_serverFn/**", async (route) => {
      // Only fail the very first serverFn call — subsequent calls (after the
      // forced reload) must pass through so the feed can actually render.
      if (intercepted === 0) {
        intercepted++;
        await route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "serverFn not found",
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/?tab=latest&sort=new");

    // Wait for the guard's hard reload — URL gains a `__v=` cache-busting param.
    await page.waitForURL(/[?&]__v=/, { timeout: 15_000 });

    // We intercepted at least one stale serverFn call.
    expect(intercepted).toBeGreaterThanOrEqual(1);

    // After reload, the feed renders: heading is visible and at least one
    // photo card (or the empty-state CTA) appears — i.e. not a blank screen.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const feedPanel = page.locator("#feed-panel");
    await expect(feedPanel).toBeVisible();

    // Either real photo cards rendered, or the explicit empty-state — both
    // prove the feed query completed instead of hanging on a stale serverFn.
    await expect
      .poll(async () => {
        const cards = await feedPanel.locator("a[href^='/photo/']").count();
        const empty = await page.getByText(/ยังไม่มีรูปในฟีดนี้|เริ่มโหวต/).count();
        return cards + empty;
      }, { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});