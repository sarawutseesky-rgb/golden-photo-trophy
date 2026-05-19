import { test, expect } from "@playwright/test";

// Verify Reset clears ALL `tag` occurrences from the URL when the incoming
// URL contains URL-encoded tag values (spaces, unicode, special chars) AND
// duplicate `tag` keys AND extra params like `q`/`page`. SSR must not 500,
// and no `tag=` substring may remain after Reset.
test.describe(
  "Feed — Reset filter button with URL-encoded duplicate tag + extra params",
  () => {
    const combos = [
      "tag=love%20it&q=sunset",
      "tag=love%20it&tag=hate%20it&page=2",
      "tag=%E0%B8%AA%E0%B8%A7%E0%B8%A2&q=ocean", // tag=สวย
      "tag=love%26peace&tag=rock%2Broll&page=3&utm_source=test",
      "q=hello%20world&tag=a%2Fb&tag=c%3Dd&page=2&tag=love%20it",
      "tag=caf%C3%A9&tag=na%C3%AFve&ref=newsletter",
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

        // Off-default tab/sort + encoded (possibly duplicate) tag + extras.
        await page.goto(`/?tab=top-week&sort=score&${combo}`);

        // SSR must succeed despite the noisy + encoded URL.
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
          timeout: 15_000,
        });
        await expect(
          page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i),
        ).toHaveCount(0);

        const resetBtn = page.getByRole("link", { name: /reset/i });
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

        // Defaults applied and ZERO `tag=` occurrences (encoded or not).
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