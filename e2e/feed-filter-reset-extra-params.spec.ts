import { test, expect } from "@playwright/test";

// Verify that Reset on the Feed filter bar still restores defaults and clears
// `tag` cleanly even when the URL carries additional unknown params
// (e.g. `q`, `page`, `ref`). No 5xx may be triggered, and `tag` must not
// linger in the post-reset URL.
test.describe("Feed — Reset filter button with extra URL params", () => {
  const extraParamSets = [
    "q=sunset",
    "page=3",
    "ref=newsletter&utm_source=test",
    "q=ocean&page=2&utm_campaign=launch",
  ];

  for (const extra of extraParamSets) {
    test(`resets cleanly when URL also has "${extra}"`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (e) => pageErrors.push(e));

      const failedResponses: { url: string; status: number }[] = [];
      page.on("response", (res) => {
        const status = res.status();
        if (status >= 500) failedResponses.push({ url: res.url(), status });
      });

      // Off-default feed state + unknown extra params.
      await page.goto(`/?tab=top-week&sort=score&tag=love&${extra}`);

      // SSR must succeed despite extra params — heading visible, no error UI.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i),
      ).toHaveCount(0);

      const resetBtn = page.getByRole("link", { name: /reset/i });
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();

      // Default tab/sort applied, and `tag` must NOT appear in any form.
      await expect(page).toHaveURL(
        /\?(?=.*\btab=latest\b)(?=.*\bsort=new\b)(?!.*\btag=)/,
      );

      // Reset hides and Latest tab is active.
      await expect(resetBtn).toBeHidden();
      await expect(page.getByRole("tab", { name: /latest/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Hard refresh on the reset URL — must still succeed (no SSR 500).
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.url()).not.toMatch(/[?&]tag=/);

      expect(
        failedResponses,
        `Server returned 5xx: ${failedResponses
          .map((r) => `${r.status} ${r.url}`)
          .join("\n")}`,
      ).toEqual([]);
      expect(
        pageErrors,
        `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
      ).toEqual([]);
    });
  }
});