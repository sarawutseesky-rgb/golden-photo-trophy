import { test, expect } from "@playwright/test";

// Guests clicking the "View #2 photo details" CTA in the Spotlight Hero
// runner-up panel must be redirected to /login (the /photo/$id route is
// behind the _authenticated layout). If the login route preserves a
// redirect-back search param, it must point at the #2 photo's /photo/:id.
test.describe("Spotlight Hero — runner-up CTA guest redirect to /login", () => {
  test("clicking 'View #2 photo details' as a guest redirects to /login", async ({
    page,
    context,
  }) => {
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

    const runnerUp = page.getByRole("region", { name: /runner-up #2/i });
    const exists = (await runnerUp.count()) > 0;
    test.skip(!exists, "No runner-up #2 photo available in this environment");
    await expect(runnerUp).toBeVisible({ timeout: 10_000 });

    const cta = runnerUp.getByRole("link", { name: /view #2 photo details/i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    await cta.click();

    // AuthLayout sees no user → navigates to /login (optionally with a
    // redirect-back search param pointing at the #2 photo's /photo/:id).
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 15_000 });

    const finalUrl = new URL(page.url());
    const redirectParam = finalUrl.searchParams.get("redirect");
    if (redirectParam) {
      const decoded = decodeURIComponent(redirectParam);
      expect(decoded).toContain(ctaHref!);
    }

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
