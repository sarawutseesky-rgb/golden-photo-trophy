import { test, expect } from "@playwright/test";

// Verifies that an AUTHENTICATED user clicking the "View photo details" CTA
// for the #1 photo in the Spotlight Hero lands on a pathname that exactly
// matches the CTA's href (the #1 photo's /photo/:id), with no redirect
// chain and no 5xx / pageerror.
test.describe("Spotlight Hero — #1 CTA navigation to /photo/:id", () => {
  test("clicking 'View photo details' lands on the #1 photo's href exactly", async ({
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

    // Scope to the #1 CTA only (exclude the runner-up "View #2 photo details").
    const cta = spotlight.getByRole("link", { name: /^view details for /i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    // Image link inside spotlight must point to the same id as the CTA.
    const imageHref = await spotlight
      .getByRole("link", { name: /^spotlight:/i })
      .getAttribute("href");
    expect(imageHref).toBe(ctaHref);

    // Track any redirect hops the browser follows after the click.
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(new URL(frame.url()).pathname);
    });

    await cta.click();

    // Final URL pathname must be exactly the #1 CTA href.
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
