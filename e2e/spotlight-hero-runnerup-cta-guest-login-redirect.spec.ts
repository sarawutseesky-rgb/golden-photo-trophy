import { test, expect } from "@playwright/test";

// Full guest → click "View #2 photo details" → /login → sign in → land on
// the #2 photo's /photo/:id path (the original href). Verifies the
// redirect-back round-trip works for the runner-up CTA.
test.describe("Spotlight Hero — runner-up CTA guest sign-in lands on #2 href", () => {
  test("guest clicks #2 CTA, signs in, returns to the #2 photo's pathname", async ({
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

    await page.goto("/");
    const spotlight = page.getByRole("region", { name: /current #1 spotlight/i });
    await expect(spotlight).toBeVisible({ timeout: 15_000 });

    const runnerUp = page.getByRole("region", { name: /runner-up #2/i });
    const exists = (await runnerUp.count()) > 0;
    test.skip(!exists, "No runner-up #2 photo available in this environment");
    await expect(runnerUp).toBeVisible({ timeout: 10_000 });

    const cta = runnerUp.getByRole("link", { name: /view #2 photo details/i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    await cta.click();

    // Guest is bounced to /login (the AuthLayout adds ?redirect=<ctaHref>).
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 15_000 });
    const redirectParam = new URL(page.url()).searchParams.get("redirect");
    expect(redirectParam, "login must carry a redirect param").toBeTruthy();
    expect(decodeURIComponent(redirectParam!)).toContain(ctaHref!);

    // Sign in with the password form.
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Must land back on the #2 photo's pathname, not "/".
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(ctaHref);

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
