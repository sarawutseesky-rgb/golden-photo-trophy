import { test, expect, type Page } from "@playwright/test";

// Verifies keyboard-only flow through the command palette: open via ⌘K,
// type a query, use ArrowDown to highlight a result, press Enter to
// navigate, and Esc to close the dialog without navigating.
test.describe("Command palette (⌘K) — keyboard navigation", () => {
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
    const meta = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${meta}+KeyK`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder(/search photos, tags, people/i)).toBeFocused();
    return dialog;
  }

  test("Esc closes the dialog without navigating", async ({ page, context }) => {
    await loginAndGoHome(page, context);
    const before = new URL(page.url()).pathname;

    const dialog = await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    expect(new URL(page.url()).pathname).toBe(before);
  });

  test("ArrowDown + Enter navigates to the highlighted /photo/:id", async ({
    page,
    context,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await loginAndGoHome(page, context);

    // Reference photo from Spotlight: known to exist + searchable by title.
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });
    const title = (await spotlight.getByRole("heading", { level: 2 }).innerText()).trim();
    expect(title.length).toBeGreaterThan(0);

    const dialog = await openPalette(page);
    await page.keyboard.type(title.slice(0, Math.min(title.length, 24)));

    // Wait for the photos group + at least one option to render.
    const photosGroup = dialog.getByRole("group", { name: /photos & tags/i });
    await expect(photosGroup.getByRole("option").first()).toBeVisible({ timeout: 10_000 });

    // Press ArrowDown until an option is highlighted (cmdk sets aria-selected="true").
    // The input keeps focus; arrow keys move the active item.
    const highlighted = dialog.locator('[role="option"][aria-selected="true"]');
    for (let i = 0; i < 8 && (await highlighted.count()) === 0; i++) {
      await page.keyboard.press("ArrowDown");
    }
    // Ensure the highlight is on a /photo/... option, not a /profile/... one.
    let activeValue = await highlighted.first().getAttribute("data-value");
    for (let i = 0; i < 12 && activeValue && !activeValue.startsWith("photo-"); i++) {
      await page.keyboard.press("ArrowDown");
      activeValue = await dialog
        .locator('[role="option"][aria-selected="true"]')
        .first()
        .getAttribute("data-value");
    }
    expect(activeValue, "expected a photo-* option to be highlighted").toMatch(/^photo-/);

    await page.keyboard.press("Enter");

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("ArrowDown + Enter navigates to the highlighted /profile/:id", async ({
    page,
    context,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await loginAndGoHome(page, context);

    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });
    const authorLink = spotlight.getByRole("link", { name: /^by /i }).first();
    await expect(authorLink).toBeVisible({ timeout: 10_000 });
    const authorName = (await authorLink.innerText()).replace(/^by\s+/i, "").trim();
    test.skip(!authorName || /^anonymous$/i.test(authorName), "Spotlight author has no display name");

    const dialog = await openPalette(page);
    await page.keyboard.type(authorName.slice(0, Math.min(authorName.length, 24)));

    const peopleGroup = dialog.getByRole("group", { name: /^people$/i });
    await expect(peopleGroup.getByRole("option").first()).toBeVisible({ timeout: 10_000 });

    // Cycle ArrowDown until a /profile/... option is highlighted.
    const highlighted = dialog.locator('[role="option"][aria-selected="true"]');
    for (let i = 0; i < 8 && (await highlighted.count()) === 0; i++) {
      await page.keyboard.press("ArrowDown");
    }
    let activeValue = await highlighted.first().getAttribute("data-value");
    for (let i = 0; i < 16 && activeValue && !activeValue.startsWith("user-"); i++) {
      await page.keyboard.press("ArrowDown");
      activeValue = await dialog
        .locator('[role="option"][aria-selected="true"]')
        .first()
        .getAttribute("data-value");
    }
    expect(activeValue, "expected a user-* option to be highlighted").toMatch(/^user-/);

    await page.keyboard.press("Enter");

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toMatch(/^\/profile\/[A-Za-z0-9_-]+$/);
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
