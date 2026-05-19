import { test, expect } from "@playwright/test";

// Verify that Reset on the Feed filter bar correctly clears ALL `tag`
// occurrences from the URL when the incoming URL combines duplicate `tag`
// keys with additional unknown params (e.g. `q`, `page`, `utm_*`).
// SSR must not 500, and no `tag` substring may remain after Reset.
test.describe(
  "Feed — Reset filter button with duplicate tag + extra URL params",
  () => {
    const combos = [
      "tag=love&tag=hate&q=sunset",
      "tag=a&tag=b&page=3",
      "tag=&tag=love&q=ocean&utm_source=test",
      "tag=love&tag=&tag=undefined&page=2&utm_campaign=launch",
      "q=sunset&tag=love&page=2&tag=hate&ref=newsletter",
    ];

    for (const combo of combos) {
      test(`resets cleanly when URL has "${combo}"`, async ({ page }) => {
        const pageErrors: Error[] = [];
        page.on("pageerror", (e) => pageErrors.push(e));

        const failedResponses: { url: string; status: number }[] = [];
        page.on("response", (res) => {
          const status = res.status();
          if (status >= 500) failedResponses.push({ url: res.url(), status });
        });

        // Off-default tab/sort + duplicate tag keys + extra params.
        await page.goto(`/?tab=top-week&sort=score&${combo}`);

        // SSR must succeed despite the noisy URL.
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
          timeout: 15_000,
        });
        await expect(
          page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i),
        ).toHaveCount(0);

        const resetBtn = page.getByRole("link", { name: /reset/i });
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

        // URL must reflect defaults AND have ZERO `tag` occurrences.
        await expect(page).toHaveURL(
          /\?(?=.*\btab=latest\b)(?=.*\bsort=new\b)(?!.*[?&]tag=)/,
        );
        expect(page.url().match(/[?&]tag=/g)).toBeNull();

        await expect(resetBtn).toBeHidden();
        await expect(
          page.getByRole("tab", { name: /latest/i }),
        ).toHaveAttribute("aria-selected", "true");

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
  },
);