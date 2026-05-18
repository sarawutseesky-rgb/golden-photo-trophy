import { test, expect } from "@playwright/test";

// Sample several photos from the feed, hard-refresh into each /photo/$id,
// and exercise open → X close → reopen on every one to confirm none of them
// produce a blank screen or pageerror.
const SAMPLE_SIZE = 3;

test.describe("Photo detail — lightbox across multiple photos", () => {
  test("hard refresh + open/close/reopen on a sample of photos", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    // Collect distinct photo hrefs from the feed.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });

    const allHrefs = await page
      .locator('a[href^="/photo/"]')
      .evaluateAll((els) =>
        Array.from(
          new Set(
            els
              .map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? "")
              .filter((h) => /^\/photo\/[\w-]+$/.test(h)),
          ),
        ),
      );
    expect(allHrefs.length).toBeGreaterThan(0);

    // Randomly sample up to SAMPLE_SIZE photos.
    const shuffled = [...allHrefs].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, Math.min(SAMPLE_SIZE, shuffled.length));

    for (const href of sample) {
      await test.step(`photo ${href}`, async () => {
        // Hard refresh into the detail route (SSR entry).
        await page.goto(href);
        await page.reload();

        const trigger = page.getByRole("button", {
          name: /เปิดดูรูปขนาดเต็ม/,
        });
        await expect(trigger).toBeVisible({ timeout: 15_000 });

        const openLightbox = async () => {
          await trigger.click();
          await expect(page.locator(".yarl__container").first()).toBeVisible({
            timeout: 10_000,
          });
        };

        const closeViaXButton = async () => {
          const closeBtn = page
            .getByRole("button", { name: /ปิด|Close/i })
            .first();
          await expect(closeBtn).toBeVisible();
          await closeBtn.click();
          await expect(page.locator(".yarl__container")).toHaveCount(0, {
            timeout: 5_000,
          });
        };

        // Open → X close → reopen → X close.
        await openLightbox();
        await closeViaXButton();
        await expect(trigger).toBeVisible();
        await expect(page.locator("h1")).toBeVisible();

        await openLightbox();
        await expect(page.locator("h1")).toBeVisible();
        await closeViaXButton();
      });
    }

    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
});