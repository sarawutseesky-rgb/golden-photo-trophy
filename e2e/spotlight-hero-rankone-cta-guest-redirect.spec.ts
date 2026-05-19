import { test, expect } from "@playwright/test";

// Guests clicking the "View photo details" CTA for the #1 photo in the
// Spotlight Hero must be redirected to /login (the /photo/$id route is
// behind the _authenticated layout). No 5xx / pageerror allowed.
test.describe("Spotlight Hero — #1 CTA guest redirect to /login", () => {
  test("clicking 'View photo details' as a guest redirects to /login", async ({
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

    // Scope to the #1 CTA only (exclude runner-up "View #2 photo details").
    const cta = spotlight.getByRole("link", { name: /^view details for /i });
    const ctaHref = await cta.getAttribute("href");
    expect(ctaHref).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);

    await cta.click();

    // AuthLayout sees no user → navigates to /login (optionally with a
    // redirect-back search param pointing at the original /photo/:id).
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 15_000 });

    // If the login route preserves the original target as a search param,
    // it must point back to the #1 photo's /photo/:id (not somewhere else).
    const finalUrl = new URL(page.url());
    const redirectParam = finalUrl.searchParams.get("redirect");
    if (redirectParam) {
      const decoded = decodeURIComponent(redirectParam);
      expect(decoded).toContain(ctaHref!);
    }

    // No SSR error fallback on either /photo/:id or /login.
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
