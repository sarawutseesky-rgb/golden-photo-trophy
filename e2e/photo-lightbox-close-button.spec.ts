import { test, expect } from "@playwright/test";

// Verify /photo/$id survives a hard refresh, opens the lazy/ClientOnly lightbox,
// and closes cleanly via the toolbar Close (X) button without a blank screen
// or pageerror.
test.describe("Photo detail — lightbox Close button", () => {
  test("hard refresh, open lightbox, close via X button", async ({ page }) => {
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

    // Open the lightbox.
    await trigger.click();
    const container = page.locator(".yarl__container").first();
    await expect(container).toBeVisible({ timeout: 10_000 });

    // Close via the toolbar X button. The route customizes the label to Thai
    // ("ปิด (Esc)"); fall back to the default English aria-label just in case.
    const closeBtn = page
      .getByRole("button", { name: /ปิด|Close/i })
      .first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Lightbox should be gone, detail content still present (not blank).
    await expect(container).toHaveCount(0, { timeout: 5_000 });
    await expect(trigger).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
});