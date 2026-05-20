import { test, expect } from "@playwright/test";

// Verifies that the RankBadge on member leaderboard cards stays within the
// card and does NOT visually overlap the inner content (avatar, name, score)
// at small viewport widths where padding gets tight.
//
// Tested widths cover common mobile + tablet breakpoints:
//   360 — small Android
//   390 — iPhone 12/13/14
//   414 — iPhone XR / Plus class
//   768 — iPad portrait (md breakpoint)
const VIEWPORTS = [
  { name: "small-android", width: 360, height: 800 },
  { name: "iphone-13", width: 390, height: 844 },
  { name: "iphone-xr", width: 414, height: 896 },
  { name: "ipad-portrait", width: 768, height: 1024 },
] as const;

test.describe("Leaderboard — RankBadge responsive positioning", () => {
  for (const vp of VIEWPORTS) {
    test(`badge stays inside card without overlapping content @ ${vp.name} (${vp.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/leaderboard");

      const grid = page.getByTestId("member-leaderboard-grid");
      // Tolerate the empty-state (no votes in range): the responsive layout
      // can only be exercised when at least one card renders.
      const gridVisible = await grid
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (!gridVisible) test.skip(true, "Leaderboard has no entries to render");

      const cards = page.getByTestId("member-leaderboard-card");
      const cardCount = await cards.count();
      if (cardCount === 0) test.skip(true, "No leaderboard cards rendered");

      // Sample the first few cards (covers the top-3 styled cards + a plain one)
      const sampleSize = Math.min(cardCount, 4);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        const badge = card.getByTestId("member-leaderboard-rank-badge");
        const content = card.getByTestId("member-leaderboard-card-content");

        const [cardBox, badgeBox, contentBox] = await Promise.all([
          card.boundingBox(),
          badge.boundingBox(),
          content.boundingBox(),
        ]);
        expect(cardBox, `card #${i} bounding box`).not.toBeNull();
        expect(badgeBox, `badge #${i} bounding box`).not.toBeNull();
        expect(contentBox, `content #${i} bounding box`).not.toBeNull();
        if (!cardBox || !badgeBox || !contentBox) continue;

        // 1. Badge fully inside the card on every edge.
        expect(badgeBox.x).toBeGreaterThanOrEqual(cardBox.x - 0.5);
        expect(badgeBox.y).toBeGreaterThanOrEqual(cardBox.y - 0.5);
        expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
          cardBox.x + cardBox.width + 0.5,
        );
        expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(
          cardBox.y + cardBox.height + 0.5,
        );

        // 2. Badge must NOT overlap the avatar/name/score block.
        const badgeBottom = badgeBox.y + badgeBox.height;
        const badgeRight = badgeBox.x + badgeBox.width;
        const contentBottom = contentBox.y + contentBox.height;
        const contentRight = contentBox.x + contentBox.width;
        const horizontallyDisjoint =
          badgeRight <= contentBox.x || contentRight <= badgeBox.x;
        const verticallyDisjoint =
          badgeBottom <= contentBox.y || contentBottom <= badgeBox.y;
        expect(
          horizontallyDisjoint || verticallyDisjoint,
          `RankBadge overlaps card content at ${vp.width}px (card #${i}). ` +
            `badge=${JSON.stringify(badgeBox)} content=${JSON.stringify(contentBox)}`,
        ).toBe(true);

        // 3. Sanity: badge has a non-zero rendered size (clamp didn't collapse it).
        expect(badgeBox.width).toBeGreaterThan(16);
        expect(badgeBox.height).toBeGreaterThan(16);
      }
    });
  }
});