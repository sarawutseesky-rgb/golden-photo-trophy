import { test, expect } from "@playwright/test";

// Verifies the photo OWNER (logged-in) sees the Milestone stars card with the
// correct filled / empty star badges and the continuous timer status text
// ("Held #1 for Xd · next ★ at Yd" or the not-holding fallback), and that
// these values stay stable across 4 consecutive hard refreshes.
//
// Requires: E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD
test.describe("Photo detail — owner Milestone stars stable across 4 hard refreshes", () => {
  test("milestone star badges and timer status do not change after refreshes", async ({ page, context }) => {
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

    // ── Milestone stars card must exist ──
    const milestoneCard = page.locator("div.rounded-xl.border.border-border.bg-card").filter({
      has: page.locator("text=Milestone stars"),
    });
    await expect(milestoneCard).toBeVisible({ timeout: 15_000 });

    // ── Read star badges (5 total: filled = gold, empty = muted) ──
    const stars = milestoneCard.locator("svg.lucide-star");
    await expect(stars).toHaveCount(5);

    const readStarStates = async (): Promise<boolean[]> => {
      const classes = await stars.evaluateAll((els) => els.map((e) => e.getAttribute("class") ?? ""));
      return classes.map((c) => c.includes("fill-[var(--gold)]"));
    };
    const starsBefore = await readStarStates();
    const filledBefore = starsBefore.filter(Boolean).length;
    expect(filledBefore).toBeGreaterThanOrEqual(0);
    expect(filledBefore).toBeLessThanOrEqual(5);

    // ── Read timer / status text (may be absent only when stars === 5) ──
    const statusEl = milestoneCard.locator("div.mt-3.text-xs.text-muted-foreground");
    const hasStatus = (await statusEl.count()) > 0;
    let statusTextBefore: string | null = null;
    if (hasStatus) {
      await expect(statusEl).toBeVisible();
      statusTextBefore = ((await statusEl.textContent()) ?? "").trim();
      expect(statusTextBefore).toMatch(/Held #1 for [\d.]+d · next ★ at \d+d|Reach #1 \(min 10 votes\) to start the clock toward \d+d for your next ★/);
    } else {
      expect(filledBefore).toBe(5);
    }

    // ── 4 hard refreshes — values must remain identical ──
    for (let i = 0; i < 4; i++) {
      await page.reload();
      await expect(milestoneCard, `milestone card disappeared after refresh #${i + 1}`).toBeVisible({ timeout: 15_000 });
      await expect(stars, `stars count changed after refresh #${i + 1}`).toHaveCount(5);

      const starsAfter = await readStarStates();
      expect(starsAfter, `star badge fill states changed at refresh #${i + 1}`).toEqual(starsBefore);

      if (hasStatus) {
        await expect(statusEl, `status text disappeared after refresh #${i + 1}`).toBeVisible();
        const statusTextAfter = ((await statusEl.textContent()) ?? "").trim();
        expect(statusTextAfter, `status text changed at refresh #${i + 1}`).toBe(statusTextBefore);
      } else {
        expect(await statusEl.count(), `status text appeared unexpectedly at refresh #${i + 1}`).toBe(0);
      }
    }

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});