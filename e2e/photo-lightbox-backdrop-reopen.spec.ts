import { test, expect } from "@playwright/test";

// Verify /photo/$id survives a hard refresh, opens the lazy/ClientOnly
// lightbox, closes via backdrop click, and reopens cleanly without a blank
// screen or pageerror — guards both the backdrop-close path and the second
// mount of the lazy chunk.
test.describe("Photo detail — lightbox backdrop close + reopen", () => {
  test("hard refresh, open, close via backdrop, reopen", async ({ page }) => {
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
      const c = page.locator(".yarl__container").first();
      await expect(c).toBeVisible({ timeout: 10_000 });
      return c;
    };

    const closeViaBackdrop = async () => {
      const c = page.locator(".yarl__container").first();
      const box = await c.boundingBox();
      expect(box).not.toBeNull();
      // Click top-left corner to avoid the image / toolbar buttons.
      await page.mouse.click(box!.x + 8, box!.y + 8);
      await expect(page.locator(".yarl__container")).toHaveCount(0, {
        timeout: 5_000,
      });
    };

    // First open + backdrop close.
    await openLightbox();
    await closeViaBackdrop();
    await expect(trigger).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    // Reopen — exercises cached lazy chunk + remount path.
    await openLightbox();
    await expect(page.locator("h1")).toBeVisible();

    // Final close to leave the page in a clean state.
    await closeViaBackdrop();

    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
});