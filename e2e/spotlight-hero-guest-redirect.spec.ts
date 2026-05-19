import { test, expect } from "@playwright/test";

// /photo/$id is now behind the _authenticated layout. Guests clicking the
// title link or the image inside the Spotlight Hero must be redirected to
// /login, and the navigation must not produce 5xx responses or pageerrors.
test.describe("Spotlight Hero — guest redirect to /login", () => {
  async function runGuestClickTest(
    page: import("@playwright/test").Page,
    context: import("@playwright/test").BrowserContext,
    pick: (
      spotlight: import("@playwright/test").Locator,
    ) => import("@playwright/test").Locator,
  ) {
    await context.clearCookies();

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await page.goto("/");
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    const target = pick(spotlight);
    const href = await target.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[^/?#]+/);

    await target.click();

    // AuthLayout sees no user → navigates to /login.
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 15_000 });

    // No SSR error fallback on either /photo/<id> or /login.
    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);

    expect(
      failedResponses,
      `Server returned 5xx: ${failedResponses.map((r) => `${r.status} ${r.url}`).join("\n")}`,
    ).toEqual([]);
    expect(
      pageErrors,
      `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
    ).toEqual([]);
  }

  test("clicking the title link as a guest redirects to /login", async ({ page, context }) => {
    await runGuestClickTest(page, context, (spotlight) =>
      spotlight.getByRole("heading", { level: 2 }).getByRole("link"),
    );
  });

  test("clicking the image as a guest redirects to /login", async ({ page, context }) => {
    await runGuestClickTest(page, context, (spotlight) =>
      spotlight.getByRole("link", { name: /^spotlight:/i }),
    );
  });

  test("clicking the View photo details CTA as a guest redirects to /login", async ({
    page,
    context,
  }) => {
    await runGuestClickTest(page, context, (spotlight) =>
      spotlight.getByRole("link", { name: /view photo details/i }),
    );
  });
});