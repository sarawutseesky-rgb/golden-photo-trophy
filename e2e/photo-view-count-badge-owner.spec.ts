import { test, expect } from "@playwright/test";

// Verifies that the photo OWNER also sees the view-count badge (👁) on the
// Rating card and that the value persists after a hard refresh.
//
// Requires test credentials for an account that owns at least one photo:
//   E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD
// The test is skipped when these env vars are not provided.
test.describe("Photo detail — view-count badge for owner", () => {
  test("owner sees badge in Rating card and value persists after refresh", async ({ page, context }) => {
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;
    test.skip(!email || !password, "Set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run this test");

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    await context.clearCookies();

    // Log in as the owner.
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    // Navigate to the feed and find a photo owned by the logged-in user.
    // We assume the owner's first photo on the feed is theirs; if the app
    // exposes a "my photos" view it can be swapped in here.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const href = await firstPhoto.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[\w-]+$/);

    await page.goto(href!);

    // Badge must be visible for the owner.
    const badge = page.getByTestId("view-count");
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText(/วิว/);

    const parseCount = async () => {
      const text = (await badge.textContent()) ?? "";
      const digits = text.replace(/[^\d]/g, "");
      expect(digits.length, `expected numeric view count, got "${text}"`).toBeGreaterThan(0);
      return Number(digits);
    };

    const before = await parseCount();
    expect(before).toBeGreaterThanOrEqual(0);

    // Hard refresh — badge must still render with a value that does not
    // disappear or regress (idempotent throttle within the same session).
    await page.reload();
    await expect(badge).toBeVisible({ timeout: 15_000 });
    const after = await parseCount();
    expect(after).toBeGreaterThanOrEqual(before);

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});