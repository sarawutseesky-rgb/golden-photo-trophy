import { test, expect } from "@playwright/test";

// Verifies a LOGGED-IN user who is NOT the photo's owner sees the Milestone
// stars card with the correct filled / empty star badges and the continuous
// timer status text ("Held #1 for Xd · next ★ at Yd" or the not-holding
// fallback), and that these values stay stable across 4 consecutive hard
// refreshes.
//
// Requires: E2E_VOTER_EMAIL, E2E_VOTER_PASSWORD (an account that is NOT the
// owner of at least one photo in the public feed).
test.describe("Photo detail — non-owner viewer Milestone stars stable across 4 hard refreshes", () => {
  test("milestone star badges and timer status do not change after refreshes", async ({ page, context }) => {
    const email = process.env.E2E_VOTER_EMAIL;
    const password = process.env.E2E_VOTER_PASSWORD;
    test.skip(!email || !password, "Set E2E_VOTER_EMAIL / E2E_VOTER_PASSWORD to run this test");

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    await context.clearCookies();

    // Login as the non-owner viewer.
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    // Collect candidate photo links from the feed.
    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const hrefs = Array.from(
      new Set(
        (await page.locator('a[href^="/photo/"]').evaluateAll((els) =>
          els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
        )).filter((h) => /^\/photo\/[\w-]+$/.test(h)),
      ),
    );
    expect(hrefs.length).toBeGreaterThan(0);

    // Find the first photo NOT owned by this user (owner-only "แก้ไข" button is absent).
    let chosenHref: string | null = null;
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
      const editBtn = page.getByRole("button", { name: /แก้ไข/ });
      if ((await editBtn.count()) === 0) {
        chosenHref = href;
        break;
      }
    }
    test.skip(!chosenHref, "No non-owned photo found in feed for this account");

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

    // ── Read timer / status text (absent only when stars === 5) ──
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

      // Confirm we are still not the owner after each refresh.
      expect(
        await page.getByRole("button", { name: /แก้ไข/ }).count(),
        `owner controls unexpectedly appeared at refresh #${i + 1}`,
      ).toBe(0);

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