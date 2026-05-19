import { test, expect } from "@playwright/test";

// Verify the Reset button on the Feed filter bar correctly clears tab/sort/tag
// search params and does NOT trigger a 500 SSR error from the Zod search-param
// validator (regression: `tag: z.string().optional()` must accept undefined).
test.describe("Feed — Reset filter button", () => {
  test("resets to default tab/sort and clears tag without 500", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      const status = res.status();
      if (status >= 500) failedResponses.push({ url: res.url(), status });
    });

    // Land on the feed with a non-default tab + sort + tag in the URL.
    await page.goto("/?tab=top-week&sort=score&tag=love");

    // Reset button must appear since we're off-default.
    const resetBtn = page.getByRole("link", { name: /reset/i });
    await expect(resetBtn).toBeVisible({ timeout: 15_000 });

    await resetBtn.click();

    // URL should reflect default tab + sort, and `tag` must be gone entirely
    // (not present as "tag=" or "tag=undefined").
    await expect(page).toHaveURL(/\?(?=.*\btab=latest\b)(?=.*\bsort=new\b)(?!.*\btag=)/);

    // Reset button disappears once we're back to defaults.
    await expect(resetBtn).toBeHidden();

    // Latest tab is selected.
    const latestTab = page.getByRole("tab", { name: /latest/i });
    await expect(latestTab).toHaveAttribute("aria-selected", "true");

    // Page must still render — feed heading present, no SSR error fallback.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);

    // Hard refresh on the reset URL must also succeed (no 500 from SSR validator).
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(latestTab).toHaveAttribute("aria-selected", "true");

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