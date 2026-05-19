import { test, expect } from "@playwright/test";

// Verifies that the title link and the image link inside the Spotlight Hero
// both navigate to the same /photo/<id> as the "View photo details" CTA, and
// that the detail page renders the same photo (title + image).
test.describe("Spotlight Hero — title & image links", () => {
  async function gotoSpotlight(page: import("@playwright/test").Page) {
    await page.goto("/");
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    const title = (await spotlight.getByRole("heading", { level: 2 }).innerText()).trim();
    expect(title.length).toBeGreaterThan(0);

    const cta = spotlight.getByRole("link", { name: /view photo details/i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[^/?#]+/);
    const ctaId = ctaHref!.match(/^\/photo\/([^/?#]+)/)![1];

    return { spotlight, title, ctaHref: ctaHref!, ctaId };
  }

  function trackErrors(page: import("@playwright/test").Page) {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });
    return { pageErrors, failedResponses };
  }

  async function assertDetail(
    page: import("@playwright/test").Page,
    ctaHref: string,
    title: string,
  ) {
    await expect(page).toHaveURL(new RegExp(`^.*${ctaHref}(?:[?#].*)?$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByAltText(title).first()).toBeVisible();
    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
  }

  test("title link goes to the same /photo/<id> as the CTA", async ({ page }) => {
    const { pageErrors, failedResponses } = trackErrors(page);
    const { spotlight, title, ctaHref, ctaId } = await gotoSpotlight(page);

    const titleLink = spotlight.getByRole("heading", { level: 2 }).getByRole("link");
    const titleHref = await titleLink.getAttribute("href");
    expect(titleHref).toMatch(/^\/photo\/[^/?#]+/);
    expect(titleHref!.match(/^\/photo\/([^/?#]+)/)![1]).toBe(ctaId);

    await titleLink.click();
    await assertDetail(page, ctaHref, title);

    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("image link goes to the same /photo/<id> as the CTA", async ({ page }) => {
    const { pageErrors, failedResponses } = trackErrors(page);
    const { spotlight, title, ctaHref, ctaId } = await gotoSpotlight(page);

    const imageLink = spotlight.getByRole("link", { name: /^spotlight:/i });
    const imageHref = await imageLink.getAttribute("href");
    expect(imageHref).toMatch(/^\/photo\/[^/?#]+/);
    expect(imageHref!.match(/^\/photo\/([^/?#]+)/)![1]).toBe(ctaId);

    await imageLink.click();
    await assertDetail(page, ctaHref, title);

    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});