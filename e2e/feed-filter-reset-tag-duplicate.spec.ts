import { test, expect } from "@playwright/test";

// Verify that Reset on the Feed filter bar correctly clears the `tag` param
// when the incoming URL contains the key multiple times
// (e.g. `?tag=love&tag=hate` or `?tag=a&tag=b&tag=c`). After Reset, no `tag`
// occurrence may remain in the URL, and no 5xx may be triggered by the SSR
// Zod validator or the feed query.
test.describe("Feed — Reset filter button with duplicate tag params", () => {
  const duplicateSets = [
    "tag=love&tag=hate",
    "tag=a&tag=b&tag=c",
    "tag=&tag=love",
    "tag=love&tag=&tag=undefined",
  ];

  for (const dup of duplicateSets) {
    test(`resets cleanly when URL has "${dup}"`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (e) => pageErrors.push(e));

      const failedResponses: { url: string; status: number }[] = [];
      page.on("response", (res) => {
        const status = res.status();
        if (status >= 500) failedResponses.push({ url: res.url(), status });
      });

      // Off-default tab/sort + repeated tag keys.
      await page.goto(`/?tab=top-week&sort=score&${dup}`);

      // SSR must succeed despite the duplicate `tag` keys.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i),
      ).toHaveCount(0);

      const resetBtn = page.getByRole("link", { name: /reset/i });
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();

      // URL must reflect defaults AND have NO `tag` occurrences at all.
      await expect(page).toHaveURL(
        /\?(?=.*\btab=latest\b)(?=.*\bsort=new\b)(?!.*[?&]tag=)/,
      );
      // Defensive: even a single `tag=` substring is a regression.
      expect(page.url().match(/[?&]tag=/g)).toBeNull();

      await expect(resetBtn).toBeHidden();
      await expect(page.getByRole("tab", { name: /latest/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Hard refresh on the reset URL — must still succeed (no SSR 500).
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(page.url().match(/[?&]tag=/g)).toBeNull();

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