import { test, expect } from "@playwright/test";

// Stronger guarantee: as the photo OWNER (logged-in), the Rating section
// (average score, vote count, and 1–5 star distribution) must NEVER disappear
// and values must NEVER change across 4 hard refreshes performed back-to-back
// within the server-side throttle window.
//
// Requires owner credentials:
//   E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD
test.describe("Photo detail — owner Rating is stable across 4 hard refreshes", () => {
  test("rating data stays visible and values are identical after each refresh", async ({ page, context }) => {
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;
    test.skip(!email || !password, "Set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run this test");

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    await context.clearCookies();

    // Login as owner.
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    // Pick first photo from feed.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const href = await firstPhoto.getAttribute("href");
    expect(href).toMatch(/^\/photo\/[\w-]+$/);

    await page.goto(href!);

    // ── Rating card must exist ──
    const ratingCard = page.locator("div.rounded-xl.border.border-border.bg-card").filter({
      has: page.locator("text=Rating"),
    });
    await expect(ratingCard).toBeVisible({ timeout: 15_000 });

    // ── Average score (e.g. 3.5) ──
    const avgScoreEl = ratingCard.locator("span.text-3xl.font-bold");
    await expect(avgScoreEl).toBeVisible();
    const avgTextBefore = (await avgScoreEl.textContent()) ?? "";
    expect(avgTextBefore).toMatch(/^\d(\.\d)?$/);
    const avgBefore = Number(avgTextBefore);
    expect(avgBefore).toBeGreaterThanOrEqual(0);
    expect(avgBefore).toBeLessThanOrEqual(5);

    // ── Vote count text (e.g. "12 votes") ──
    const votesTextEl = ratingCard.locator("span.text-sm.text-muted-foreground").filter({ hasText: /votes/ });
    await expect(votesTextEl).toBeVisible();
    const votesTextBefore = (await votesTextEl.textContent()) ?? "";
    const votesMatchBefore = votesTextBefore.match(/(\d+)\s+votes/);
    expect(votesMatchBefore, `expected vote count text, got "${votesTextBefore}"`).toBeTruthy();
    const votesBefore = Number(votesMatchBefore![1]);
    expect(votesBefore).toBeGreaterThanOrEqual(0);

    // ── 1–5 star distribution bars ──
    const distributionRows = ratingCard.locator("div.flex.items-center.gap-2.text-xs");
    await expect(distributionRows).toHaveCount(5);
    const distBefore: number[] = [];
    for (let s = 5; s >= 1; s--) {
      const row = distributionRows.nth(5 - s);
      await expect(row).toBeVisible();
      const label = await row.locator("span.w-4").textContent();
      expect(label).toBe(`${s}★`);
      const countText = await row.locator("span.w-6").textContent();
      const count = Number(countText);
      expect(Number.isFinite(count), `expected numeric count for ${s}★, got "${countText}"`).toBe(true);
      distBefore.push(count);
    }
    const distSumBefore = distBefore.reduce((a, b) => a + b, 0);
    expect(distSumBefore).toBe(votesBefore);

    // ── Perform 4 hard refreshes in quick succession ──
    for (let i = 0; i < 4; i++) {
      await page.reload();
      await expect(ratingCard, `rating card disappeared after refresh #${i + 1}`).toBeVisible({ timeout: 15_000 });
      await expect(avgScoreEl, `avg score disappeared after refresh #${i + 1}`).toBeVisible();
      await expect(votesTextEl, `vote count disappeared after refresh #${i + 1}`).toBeVisible();
      await expect(distributionRows, `distribution rows disappeared after refresh #${i + 1}`).toHaveCount(5);

      // ── Re-read and compare after each refresh ──
      const avgTextAfter = (await avgScoreEl.textContent()) ?? "";
      const avgAfter = Number(avgTextAfter);
      expect(avgAfter, `avg score changed at refresh #${i + 1}: ${avgBefore} → ${avgAfter}`).toBe(avgBefore);

      const votesTextAfter = (await votesTextEl.textContent()) ?? "";
      const votesMatchAfter = votesTextAfter.match(/(\d+)\s+votes/);
      expect(votesMatchAfter).toBeTruthy();
      const votesAfter = Number(votesMatchAfter![1]);
      expect(votesAfter, `vote count changed at refresh #${i + 1}: ${votesBefore} → ${votesAfter}`).toBe(votesBefore);

      const distAfter: number[] = [];
      for (let s = 5; s >= 1; s--) {
        const row = distributionRows.nth(5 - s);
        const countText = await row.locator("span.w-6").textContent();
        distAfter.push(Number(countText));
      }
      expect(distAfter, `distribution changed at refresh #${i + 1}`).toEqual(distBefore);
    }

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});
