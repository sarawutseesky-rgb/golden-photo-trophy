import { test, expect } from "@playwright/test";

// Defensive test: if something ever rewrites the Spotlight Hero CTA's href to
// a malformed value (e.g. `/photo//`, double-slash, disallowed characters),
// clicking it must NOT navigate the user to some unrelated authenticated
// page (e.g. `/`, `/login`, `/admin`). The destination pathname must still
// live under `/photo/...`, the response must not be a 5xx, and no uncaught
// pageerror may surface.
//
// Requires test credentials:
//   E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD
test.describe("Spotlight Hero — CTA with malformed href", () => {
  const MALFORMED_HREFS = [
    "/photo//",
    "/photo//extra",
    "/photo/%E0%",
    "/photo/%ZZ",
    "/photo/<script>",
    "/photo/ space",
    "/photo/..",
    "/photo/../etc",
    "/photo/?evil=1",
    "/photo/#frag",
  ];

  test("malformed CTA hrefs do not redirect to an unrelated page or 5xx", async ({
    page,
    context,
  }) => {
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;
    test.skip(!email || !password, "Set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run this test");

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
    });

    await context.clearCookies();

    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    for (const bad of MALFORMED_HREFS) {
      await page.goto("/");
      const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
      await expect(spotlight).toBeVisible({ timeout: 15_000 });

      const cta = spotlight.getByRole("link", { name: /view photo details/i });
      await expect(cta).toBeVisible();

      // Rewrite the CTA's href to the malformed value at the DOM level.
      await cta.evaluate((el, href) => el.setAttribute("href", href), bad);
      const after = await cta.getAttribute("href");
      expect(after, `failed to inject href=${bad}`).toBe(bad);

      // Plain anchor click — bypass router intercept paths.
      await cta.click();

      // Wait for navigation to settle (URL changed away from "/").
      await page.waitForLoadState("domcontentloaded");
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
        .not.toBe("/");

      const finalPath = new URL(page.url()).pathname;

      // Must stay under /photo/... — never bounce to /login, /admin, etc.
      expect(
        finalPath,
        `malformed href ${bad} bounced to unrelated path ${finalPath}`,
      ).toMatch(/^\/photo(\/|$)/);

      // No SSR error fallback / no 5xx for this navigation.
      await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
    }

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