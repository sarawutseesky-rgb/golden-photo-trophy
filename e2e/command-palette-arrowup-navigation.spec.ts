import { test, expect, type Page } from "@playwright/test";

// Verifies ArrowUp moves the highlight to a previous result in the command
// palette, and Enter then navigates to that result. Covers both /photo/:id
// (photos & tags group) and /profile/:id (people group).
test.describe("Command palette (⌘K) — ArrowUp navigation", () => {
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

  async function currentActiveValue(dialog: ReturnType<Page["getByRole"]>) {
    return dialog
      .locator('[role="option"][aria-selected="true"]')
      .first()
      .getAttribute("data-value");
  }

  test("ArrowDown then ArrowUp returns highlight, Enter navigates to /photo/:id", async ({
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

    const photosGroup = dialog.getByRole("group", { name: /photos & tags/i });
    await expect(photosGroup.getByRole("option").first()).toBeVisible({ timeout: 10_000 });

    // Land on the first highlighted option.
    const highlighted = dialog.locator('[role="option"][aria-selected="true"]');
    for (let i = 0; i < 8 && (await highlighted.count()) === 0; i++) {
      await page.keyboard.press("ArrowDown");
    }
    const firstActive = await currentActiveValue(dialog);
    expect(firstActive).toBeTruthy();

    // Move forward, capture the new active, then move back with ArrowUp.
    await page.keyboard.press("ArrowDown");
    const movedActive = await currentActiveValue(dialog);
    test.skip(
      !movedActive || movedActive === firstActive,
      "Only one option available — ArrowUp cannot demonstrate moving back",
    );

    await page.keyboard.press("ArrowUp");
    const backActive = await currentActiveValue(dialog);
    expect(backActive, "ArrowUp must return highlight to the previous option").toBe(firstActive);

    // Now make sure the active option is a photo-* one before pressing Enter.
    let activeValue = backActive;
    for (let i = 0; i < 16 && activeValue && !activeValue.startsWith("photo-"); i++) {
      await page.keyboard.press("ArrowDown");
      activeValue = await currentActiveValue(dialog);
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

  test("ArrowDown then ArrowUp returns highlight, Enter navigates to /profile/:id", async ({
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

    const highlighted = dialog.locator('[role="option"][aria-selected="true"]');
    for (let i = 0; i < 8 && (await highlighted.count()) === 0; i++) {
      await page.keyboard.press("ArrowDown");
    }
    const firstActive = await currentActiveValue(dialog);
    expect(firstActive).toBeTruthy();

    await page.keyboard.press("ArrowDown");
    const movedActive = await currentActiveValue(dialog);
    test.skip(
      !movedActive || movedActive === firstActive,
      "Only one option available — ArrowUp cannot demonstrate moving back",
    );

    await page.keyboard.press("ArrowUp");
    const backActive = await currentActiveValue(dialog);
    expect(backActive, "ArrowUp must return highlight to the previous option").toBe(firstActive);

    let activeValue = backActive;
    for (let i = 0; i < 24 && activeValue && !activeValue.startsWith("user-"); i++) {
      await page.keyboard.press("ArrowDown");
      activeValue = await currentActiveValue(dialog);
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
