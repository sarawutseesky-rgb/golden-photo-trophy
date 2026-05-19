import { test, expect, type Page } from "@playwright/test";

// Verifies the global ⌘K command palette can navigate to /photo/:id by
// title search and to /profile/:id by display-name search. Uses the
// Spotlight Hero on "/" to discover a real photo + author that we know
// exist in this environment.
test.describe("Command palette (⌘K) — search & navigate", () => {
  async function loginAndGoHome(page: Page, context: import("@playwright/test").BrowserContext) {
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;
    test.skip(!email || !password, "Set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run this test");

    await context.clearCookies();
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    await page.goto("/");
  }

  async function openPalette(page: Page) {
    // Cross-platform ⌘K / Ctrl+K.
    const meta = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${meta}+KeyK`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder(/search photos, tags, people/i)).toBeFocused();
    return dialog;
  }

  test("search by photo title → Enter → lands on /photo/:id", async ({ page, context }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await loginAndGoHome(page, context);

    // Read the #1 spotlight photo's title + id from its CTA href.
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });
    const title = (await spotlight.getByRole("heading", { level: 2 }).innerText()).trim();
    const ctaHref = await spotlight
      .getByRole("link", { name: /^view details for /i })
      .getAttribute("href");
    expect(title.length).toBeGreaterThan(0);
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    const dialog = await openPalette(page);

    // Type a unique-ish prefix of the title (avoid accidental newline/Enter).
    const query = title.slice(0, Math.min(title.length, 24));
    await page.keyboard.type(query);

    // Wait for the photo row to appear and pick it explicitly.
    const photoOption = dialog
      .getByRole("option")
      .filter({ hasText: title })
      .first();
    await expect(photoOption).toBeVisible({ timeout: 10_000 });
    await photoOption.click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(ctaHref);

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("search by display name → Enter → lands on /profile/:id", async ({ page, context }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await loginAndGoHome(page, context);

    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    // Author link inside spotlight: text starts with "by <name>" and href is /profile/:id.
    const authorLink = spotlight.getByRole("link", { name: /^by /i }).first();
    await expect(authorLink).toBeVisible({ timeout: 10_000 });
    const authorHref = await authorLink.getAttribute("href");
    const authorName = (await authorLink.innerText()).replace(/^by\s+/i, "").trim();
    expect(authorHref).toMatch(/^\/profile\/[A-Za-z0-9_-]+$/);
    test.skip(!authorName || /^anonymous$/i.test(authorName), "Spotlight author has no searchable display name");

    const dialog = await openPalette(page);
    const query = authorName.slice(0, Math.min(authorName.length, 24));
    await page.keyboard.type(query);

    const peopleOption = dialog
      .getByRole("option")
      .filter({ hasText: authorName })
      .first();
    await expect(peopleOption).toBeVisible({ timeout: 10_000 });
    await peopleOption.click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(authorHref);

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("search by tag → Enter → lands on /photo/:id", async ({ page, context }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await loginAndGoHome(page, context);

    // Find a tag chip in the feed to use as a real search query.
    const tagChip = page.locator('a[href^="/?tab="]').filter({ hasText: /^#/ }).first();
    const exists = (await tagChip.count()) > 0;
    test.skip(!exists, "No tag chip available to drive a tag search");
    const tagText = (await tagChip.innerText()).replace(/^#/, "").trim().toLowerCase();
    test.skip(!tagText, "Empty tag text");

    const dialog = await openPalette(page);
    await page.keyboard.type(tagText);

    // Expect at least one photo option to appear under the Photos & tags group.
    const photoOption = dialog
      .getByRole("group", { name: /photos & tags/i })
      .getByRole("option")
      .first();
    await expect(photoOption).toBeVisible({ timeout: 10_000 });
    await photoOption.click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
