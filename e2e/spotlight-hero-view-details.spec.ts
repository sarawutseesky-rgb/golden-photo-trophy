import { test, expect } from "@playwright/test";

// Verifies the "View photo details" CTA in the Spotlight Hero navigates to the
// detail page of the current #1 photo and that the detail page renders that
// same photo (title matches, hero image visible, no SSR errors).
test.describe("Spotlight Hero — View photo details CTA", () => {
  test("navigates to the #1 photo's detail page and shows its data", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await page.goto("/");

    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    // Capture the spotlight photo's title from the H2 inside the hero.
    const spotlightTitle = (await spotlight.getByRole("heading", { level: 2 }).innerText()).trim();
    expect(spotlightTitle.length).toBeGreaterThan(0);

    // CTA must be present and link to /photo/<id>.
    const cta = spotlight.getByRole("link", { name: /view photo details/i });
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[^/?#]+/);

    await cta.click();

    // We should land on the photo detail route for that id.
    await expect(page).toHaveURL(new RegExp(`^.*${href}(?:[?#].*)?$`));

    // Detail page must render the same photo's title and image.
    await expect(page.getByRole("heading", { level: 1, name: spotlightTitle })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByAltText(spotlightTitle).first()).toBeVisible();

    // No SSR error fallback / no 5xx / no uncaught errors.
    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(
      failedResponses,
      `Server returned 5xx: ${failedResponses.map((r) => `${r.status} ${r.url}`).join("\n")}`,
    ).toEqual([]);
    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  });
});