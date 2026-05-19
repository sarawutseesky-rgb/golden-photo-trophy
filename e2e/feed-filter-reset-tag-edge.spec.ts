import { test, expect } from "@playwright/test";

// Verify that Reset on the Feed filter bar handles edge-case `tag` values in
// the URL correctly:
//   - `tag=` (empty string)
//   - `tag=undefined` (literal string)
// After clicking Reset, the URL must have no `tag` param at all, and no 5xx
// may be triggered by the SSR Zod validator or downstream feed query.
test.describe("Feed — Reset filter button with edge-case tag values", () => {
  const tagVariants = [
    { label: "empty tag", value: "" },
    { label: "literal 'undefined' tag", value: "undefined" },
  ];

  for (const { label, value } of tagVariants) {
    test(`resets cleanly when URL has ${label}`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (e) => pageErrors.push(e));

      const failedResponses: { url: string; status: number }[] = [];
      page.on("response", (res) => {
        const status = res.status();
        if (status >= 500) failedResponses.push({ url: res.url(), status });
      });

      // Off-default tab/sort + edge-case tag value.
      await page.goto(
        `/?tab=top-week&sort=score&tag=${encodeURIComponent(value)}`,
      );

      // SSR must succeed — heading visible, no error UI.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i),
      ).toHaveCount(0);

      // Reset is shown because tab/sort are off-default.
      const resetBtn = page.getByRole("link", { name: /reset/i });
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();

      // URL must reflect defaults AND have no `tag` param at all
      // (not `tag=`, not `tag=undefined`, not `tag=anything`).
      await expect(page).toHaveURL(
        /\?(?=.*\btab=latest\b)(?=.*\bsort=new\b)(?!.*[?&]tag=)/,
      );

      await expect(resetBtn).toBeHidden();
      await expect(page.getByRole("tab", { name: /latest/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Hard refresh on the reset URL must keep working (no SSR 500).
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(page.url()).not.toMatch(/[?&]tag=/);

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