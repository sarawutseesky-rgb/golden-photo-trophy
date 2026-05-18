import { test, expect } from "@playwright/test";

// Verify /photo/$id hydrates cleanly after a hard refresh and that opening
// the lightbox (lazy + ClientOnly) does not blank the screen.
test.describe("Photo detail — lightbox SSR safety", () => {
  test("hard refresh on /photo/$id and open lightbox without blank screen", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    // Land on feed and pick the first photo link.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const href = await firstPhoto.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[\w-]+$/);

    // Hard refresh directly into the detail route (SSR entry).
    await page.goto(href!);
    await page.reload();

    // The detail image (lightbox trigger) must render after hydration.
    const trigger = page.getByRole("button", { name: /เปิดดูรูปขนาดเต็ม/ });
    await expect(trigger).toBeVisible({ timeout: 15_000 });

    // Open the lightbox — this is what previously blanked the screen on SSR.
    await trigger.click();

    // The lightbox uses role="dialog" / aria-label from yet-another-react-lightbox.
    const lightbox = page.locator(".yarl__container, [role='dialog']").first();
    await expect(lightbox).toBeVisible({ timeout: 10_000 });

    // Detail content must still be present underneath — not a blank page.
    await expect(page.locator("h1")).toBeVisible();

    // Close with Esc and ensure we're back to the detail view, not blank.
    await page.keyboard.press("Escape");
    await expect(trigger).toBeVisible();

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});