import { test, expect, type Page } from "@playwright/test";

// Verifies the command palette wraps around: ArrowDown past the last option
// loops back to the first. Confirms keyboard cycling works for both photos
// and people groups, and Enter then navigates correctly.
test.describe("Command palette (⌘K) — ArrowDown wrap-around", () => {
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

  async function activeValue(dialog: ReturnType<Page["getByRole"]>) {
    return dialog
      .locator('[role="option"][aria-selected="true"]')
      .first()
      .getAttribute("data-value");
  }

  test("ArrowDown past last option wraps to first, Enter → /photo/:id", async ({
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
    const title = (await spotlight.getByRole("heading", { level: 2 }).innerText()).trim();
    expect(title.length).toBeGreaterThan(0);

    const dialog = await openPalette(page);
    await page.keyboard.type(title.slice(0, Math.min(title.length, 24)));

    const allOptions = dialog.getByRole("option");
    await expect(allOptions.first()).toBeVisible({ timeout: 10_000 });

    // Snapshot the list (cmdk filters by query; this is the visible set).
    const total = await allOptions.count();
    expect(total).toBeGreaterThan(0);

    // Get the first highlight.
    for (let i = 0; i < 5 && !(await activeValue(dialog)); i++) {
      await page.keyboard.press("ArrowDown");
    }
    const firstActive = await activeValue(dialog);
    expect(firstActive).toBeTruthy();

    // Press ArrowDown enough times to traverse all options + one extra to
    // trigger the wrap-around back to the first option.
    for (let i = 0; i < total; i++) {
      await page.keyboard.press("ArrowDown");
    }
    const wrappedActive = await activeValue(dialog);
    expect(
      wrappedActive,
      "ArrowDown past the last option must wrap back to the first option",
    ).toBe(firstActive);

    // Make sure we Enter on a photo-* option.
    let v = wrappedActive;
    for (let i = 0; i < total + 4 && v && !v.startsWith("photo-"); i++) {
      await page.keyboard.press("ArrowDown");
      v = await activeValue(dialog);
    }
    expect(v, "expected a photo-* option to be highlighted").toMatch(/^photo-/);

    await page.keyboard.press("Enter");

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("ArrowDown past last option wraps to first, Enter → /profile/:id", async ({
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

    const allOptions = dialog.getByRole("option");
    await expect(allOptions.first()).toBeVisible({ timeout: 10_000 });

    const total = await allOptions.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < 5 && !(await activeValue(dialog)); i++) {
      await page.keyboard.press("ArrowDown");
    }
    const firstActive = await activeValue(dialog);
    expect(firstActive).toBeTruthy();

    for (let i = 0; i < total; i++) {
      await page.keyboard.press("ArrowDown");
    }
    const wrappedActive = await activeValue(dialog);
    expect(
      wrappedActive,
      "ArrowDown past the last option must wrap back to the first option",
    ).toBe(firstActive);

    // Land on a user-* option before pressing Enter.
    let v = wrappedActive;
    for (let i = 0; i < total + 4 && v && !v.startsWith("user-"); i++) {
      await page.keyboard.press("ArrowDown");
      v = await activeValue(dialog);
    }
    expect(v, "expected a user-* option to be highlighted").toMatch(/^user-/);

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
