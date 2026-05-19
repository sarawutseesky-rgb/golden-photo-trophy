import { test, expect } from "@playwright/test";

// Verify Reset clears ALL `tag` occurrences from the URL when the incoming
// URL contains malformed percent-encoded tag values
// (e.g. truncated like `%E0%`, invalid hex like `%ZZ`, lone `%`).
// SSR must not 500 (TanStack/Zod validator should be tolerant or fall back),
// and no `tag=` substring may remain after Reset.
test.describe(
  "Feed — Reset filter button with malformed URL-encoded tag values",
  () => {
    const combos = [
      "tag=%E0%",                      // truncated UTF-8 multibyte
      "tag=%ZZ",                        // invalid hex digits
      "tag=%",                          // lone percent
      "tag=love%&page=2",               // valid + lone percent
      "tag=%E0%&tag=hate&q=ocean",      // duplicate with malformed first
      "tag=%ZZ&tag=%E0%B8%AA%E0%B8%A7", // malformed + valid Thai
      "q=hello&tag=%2&page=3&tag=%G1",  // mixed bad sequences with extras
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

        // Off-default tab/sort + malformed tag. waitUntil "commit" to avoid
        // hanging on slow lazy chunks; the assertions below wait for hydration.
        await page.goto(`/?tab=top-week&sort=score&${combo}`, {
          waitUntil: "commit",
        });

        // SSR must succeed despite the malformed encoding.
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