import { test, expect } from "@playwright/test";

// Verify Reset clears ALL `tag` occurrences when the URL alternates between
// well-formed and malformed percent-encoded values, repeated multiple times.
// SSR must not 500 and no `tag=` substring may remain after Reset.
test.describe(
  "Feed — Reset with duplicate tag mixing malformed + valid encodings",
  () => {
    const combos = [
      // bad, good, bad
      "tag=%E0%&tag=love%20it&tag=%ZZ",
      // good, bad, good, bad
      "tag=caf%C3%A9&tag=%&tag=na%C3%AFve&tag=%G1",
      // bad, good (Thai), bad, good
      "tag=%2&tag=%E0%B8%AA%E0%B8%A7%E0%B8%A2&tag=%ZZ&tag=rock%2Broll",
      // 5x alternating
      "tag=%&tag=a&tag=%E0%&tag=b&tag=%ZZ",
      // with q + page interleaved
      "q=hello%20world&tag=%E0%&page=2&tag=love%20it&tag=%ZZ&tag=caf%C3%A9",
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

        await page.goto(`/?tab=top-week&sort=score&${combo}`, {
          waitUntil: "commit",
        });

        // SSR must succeed despite mixed-encoding noise.
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
          timeout: 15_000,
        });
        await expect(
          page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i),
        ).toHaveCount(0);

        const resetBtn = page.getByRole("link", { name: /reset/i });
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

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