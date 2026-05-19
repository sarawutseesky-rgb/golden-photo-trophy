import { test, expect } from "@playwright/test";

// Verifies that an AUTHENTICATED user clicking the "View #2 photo details"
// CTA in the Spotlight Hero's runner-up panel lands on a pathname that
// exactly matches the CTA's href (the #2 photo's /photo/:id), with no
// redirect chain and no 5xx / pageerror.
test.describe("Spotlight Hero — runner-up CTA navigation to /photo/:id", () => {
  test("clicking 'View #2 photo details' lands on the #2 photo's href exactly", async ({
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

    await page.goto("/");
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    const runnerUp = page.getByRole("region", { name: /runner-up #2/i });
    // Requires that a #2 photo exists in the dataset; skip if not.
    const exists = (await runnerUp.count()) > 0;
    test.skip(!exists, "No runner-up #2 photo available in this environment");
    await expect(runnerUp).toBeVisible({ timeout: 10_000 });

    const cta = runnerUp.getByRole("link", { name: /view #2 photo details/i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    // Image link and title link inside runner-up panel must point to the same id.
    const imageHref = await runnerUp
      .getByRole("link", { name: /^runner-up:/i })
      .getAttribute("href");
    expect(imageHref).toBe(ctaHref);

    // Track any redirect hops the browser follows after the click.
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(new URL(frame.url()).pathname);
    });

    await cta.click();

    // Final URL pathname must be exactly the runner-up CTA href.
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(ctaHref);

    const stray = navigations.filter((p) => p !== ctaHref);
    expect(stray, `unexpected redirect hops: ${stray.join(" → ")}`).toEqual([]);

    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
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
