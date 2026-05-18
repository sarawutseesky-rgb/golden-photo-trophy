import { test, expect } from "@playwright/test";

// Verify /photo/$id survives a hard refresh, opens the lazy/ClientOnly
// lightbox, closes via the toolbar X button, and reopens cleanly without a
// blank screen or pageerror.
test.describe("Photo detail — lightbox X close + reopen", () => {
  test("hard refresh, open, close via X button, reopen", async ({ page }) => {
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

    const openLightbox = async () => {
      await trigger.click();
      await expect(page.locator(".yarl__container").first()).toBeVisible({
        timeout: 10_000,
      });
    };

    const closeViaXButton = async () => {
      // Route customizes the label to Thai ("ปิด (Esc)"); fall back to
      // default English aria-label just in case.
      const closeBtn = page
        .getByRole("button", { name: /ปิด|Close/i })
        .first();
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(page.locator(".yarl__container")).toHaveCount(0, {
        timeout: 5_000,
      });
    };

    // First open + X close.
    await openLightbox();
    await closeViaXButton();
    await expect(trigger).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    // Reopen — exercises cached lazy chunk + remount path.
    await openLightbox();
    await expect(page.locator("h1")).toBeVisible();

    // Final close to leave the page in a clean state.
    await closeViaXButton();

    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
});