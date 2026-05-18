import { test, expect } from "@playwright/test";

// Verify /photo/$id survives a hard refresh and that the lazy/ClientOnly
// lightbox can be opened, closed, and re-opened without a blank screen or
// pageerror — guards against stale-mount or lazy-loader regressions on the
// second open.
test.describe("Photo detail — lightbox reopen", () => {
  test("hard refresh, open lightbox, close, reopen", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    // Pick the first photo from the feed.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const href = await firstPhoto.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[\w-]+$/);

    // Hard refresh straight into the detail route (SSR entry).
    await page.goto(href!);
    await page.reload();

    const trigger = page.getByRole("button", { name: /เปิดดูรูปขนาดเต็ม/ });
    await expect(trigger).toBeVisible({ timeout: 15_000 });

    // First open.
    await trigger.click();
    const container = page.locator(".yarl__container").first();
    await expect(container).toBeVisible({ timeout: 10_000 });

    // Close via Escape.
    await page.keyboard.press("Escape");
    await expect(container).toHaveCount(0, { timeout: 5_000 });
    await expect(trigger).toBeVisible();

    // Second open — exercises the cached lazy chunk + remount path.
    await trigger.click();
    await expect(page.locator(".yarl__container").first()).toBeVisible({
      timeout: 10_000,
    });

    // Detail content still present underneath (not blank).
    await expect(page.locator("h1")).toBeVisible();

    // Final close to leave the page in a clean state.
    await page.keyboard.press("Escape");
    await expect(page.locator(".yarl__container")).toHaveCount(0, {
      timeout: 5_000,
    });

    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
});