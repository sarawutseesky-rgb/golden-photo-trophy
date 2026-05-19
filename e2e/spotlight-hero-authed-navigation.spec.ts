import { test, expect } from "@playwright/test";

// Verifies that an AUTHENTICATED user clicking the title link or the image
// inside the Spotlight Hero lands on /photo/<id> (matching the CTA), the
// detail page renders the same photo (title + image), and no 5xx / pageerror
// is produced. Mirrors spotlight-hero-guest-redirect.spec.ts for the
// signed-in path through the _authenticated layout.
//
// Requires test credentials:
//   E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD
test.describe("Spotlight Hero — authed navigation to /photo/:id", () => {
  async function loginAndOpenSpotlight(
    page: import("@playwright/test").Page,
    context: import("@playwright/test").BrowserContext,
  ) {
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
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    const title = (await spotlight.getByRole("heading", { level: 2 }).innerText()).trim();
    expect(title.length).toBeGreaterThan(0);

    const cta = spotlight.getByRole("link", { name: /view photo details/i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[^/?#]+/);

    return { spotlight, title, ctaHref: ctaHref! };
  }

  async function runAuthedClick(
    page: import("@playwright/test").Page,
    context: import("@playwright/test").BrowserContext,
    pick: (
      spotlight: import("@playwright/test").Locator,
    ) => import("@playwright/test").Locator,
  ) {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    const { spotlight, title, ctaHref } = await loginAndOpenSpotlight(page, context);

    const target = pick(spotlight);
    const href = await target.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[^/?#]+/);
    // Same photo id as the CTA.
    expect(href!.match(/^\/photo\/([^/?#]+)/)![1]).toBe(
      ctaHref.match(/^\/photo\/([^/?#]+)/)![1],
    );

    await target.click();

    // Must land on the detail route (not redirected to /login).
    await expect(page).toHaveURL(new RegExp(`^.*${ctaHref}(?:[?#].*)?$`), { timeout: 15_000 });
    expect(page.url()).not.toMatch(/\/login(?:[?#].*)?$/);

    // Detail page renders the same photo's title + image.
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByAltText(title).first()).toBeVisible();

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
  }

  test("clicking the title link as a logged-in user navigates to /photo/:id", async ({
    page,
    context,
  }) => {
    await runAuthedClick(page, context, (spotlight) =>
      spotlight.getByRole("heading", { level: 2 }).getByRole("link"),
    );
  });

  test("clicking the image as a logged-in user navigates to /photo/:id", async ({
    page,
    context,
  }) => {
    await runAuthedClick(page, context, (spotlight) =>
      spotlight.getByRole("link", { name: /^spotlight:/i }),
    );
  });
});