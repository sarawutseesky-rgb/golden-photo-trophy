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

  test("clicking the View photo details CTA as a logged-in user navigates to /photo/:id", async ({
    page,
    context,
  }) => {
    await runAuthedClick(page, context, (spotlight) =>
      spotlight.getByRole("link", { name: /view photo details/i }),
    );
  });

  test("View photo details CTA href matches /photo/:id exactly and does not redirect", async ({
    page,
    context,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    const { spotlight, ctaHref } = await loginAndOpenSpotlight(page, context);

    // Strict shape check: /photo/<non-empty id without slash/?/#>.
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);
    const expectedId = ctaHref.slice("/photo/".length);
    expect(expectedId.length).toBeGreaterThan(0);

    // CTA id must match the image-link id (i.e., really the spotlight photo).
    const imageHref = await spotlight
      .getByRole("link", { name: /^spotlight:/i })
      .getAttribute("href");
    expect(imageHref).toBe(ctaHref);

    // Track any redirects the browser follows after the click.
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(new URL(frame.url()).pathname);
    });

    await spotlight.getByRole("link", { name: /view photo details/i }).click();

    // Final URL pathname must be exactly the CTA href (no redirect chain to
    // /login, /, /unauthorized, etc.).
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(ctaHref);

    // Only allowed mid-flight pathname is the destination itself.
    const stray = navigations.filter((p) => p !== ctaHref);
    expect(
      stray,
      `unexpected redirect hops: ${stray.join(" → ")}`,
    ).toEqual([]);

    expect(failedResponses).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});