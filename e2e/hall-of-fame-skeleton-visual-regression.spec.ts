import { test, expect, type Page } from "@playwright/test";

// Visual regression: ensure the PhotoGridSkeleton's bottom info strip
// (5-star row + score + vote count + eye/comment counters) reserves the
// same height and horizontal layout as the real PhotoCard's bottom strip
// at every breakpoint used by the masonry grid in Hall of Fame.
//
// PhotoGridSkeleton is the loading state for /hall-of-fame's InfinitePhotoFeed.
// It must match PhotoCard (rendered on /?tab=latest&sort=new) pixel-for-pixel
// in the reserved areas so cards don't jump when real data arrives.

type Strip = { width: number; height: number };

const BREAKPOINTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

// Selector for the bottom info strip inside a card/skeleton tile. Both the
// real card and the skeleton use the exact same Tailwind classes.
const STRIP_SEL =
  ".pointer-events-none.absolute.inset-x-0.bottom-0";

async function getStripSize(page: Page, parentSel: string): Promise<Strip> {
  const handle = page.locator(`${parentSel} ${STRIP_SEL}`).first();
  await handle.waitFor({ state: "visible", timeout: 15_000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No bounding box for ${parentSel} ${STRIP_SEL}`);
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

test.describe("Hall of Fame — Skeleton matches real card layout", () => {
  for (const bp of BREAKPOINTS) {
    test(`${bp.name} (${bp.width}x${bp.height}): skeleton bottom strip matches real card`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      // --- 1. Capture skeleton bottom strip on /hall-of-fame ---
      // Slow the feed request so the skeleton is on-screen long enough to measure.
      await page.route("**/_serverFn/**", async (route) => {
        const url = route.request().url();
        if (/photo|feed|hof/i.test(url)) {
          await new Promise((r) => setTimeout(r, 1200));
        }
        await route.continue();
      });

      await page.goto("/hall-of-fame");
      const skeleton = await getStripSize(page, '[aria-busy="true"] > div');
      await page.unroute("**/_serverFn/**");

      // --- 2. Capture real card bottom strip on the latest feed ---
      // PhotoCard is the same component Hall of Fame renders once data loads.
      await page.goto("/?tab=latest&sort=new");
      const realCard = page.locator("article").first();
      await realCard.waitFor({ state: "visible", timeout: 20_000 });
      const real = await getStripSize(page, "article");

      // --- 3. Layout equivalence assertions ---
      // Height must match exactly (within 1px for sub-pixel rounding) — this
      // is what prevents the "jump" when the skeleton swaps out for a card.
      expect(
        Math.abs(skeleton.height - real.height),
        `Strip height mismatch at ${bp.name}: skeleton=${skeleton.height}px real=${real.height}px`,
      ).toBeLessThanOrEqual(1);

      // Width should be within a tight tolerance — both strips span the full
      // column width of the masonry tile.
      expect(
        Math.abs(skeleton.width - real.width),
        `Strip width mismatch at ${bp.name}: skeleton=${skeleton.width}px real=${real.width}px`,
      ).toBeLessThanOrEqual(4);

      // Sanity: the strip must have non-trivial size (catches regressions
      // where the skeleton accidentally collapses).
      expect(skeleton.height).toBeGreaterThanOrEqual(24);
      expect(real.height).toBeGreaterThanOrEqual(24);
    });
  }
});

test.describe("Hall of Fame — Skeleton card footer matches real card footer", () => {
  for (const bp of BREAKPOINTS) {
    test(`${bp.name}: footer (title + author) block heights match`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      await page.route("**/_serverFn/**", async (route) => {
        const url = route.request().url();
        if (/photo|feed|hof/i.test(url)) {
          await new Promise((r) => setTimeout(r, 1200));
        }
        await route.continue();
      });
      await page.goto("/hall-of-fame");

      // Skeleton footer is the .p-3 block directly after the skeleton image area
      const skeletonFooter = page
        .locator('[aria-busy="true"] > div > .p-3')
        .first();
      await skeletonFooter.waitFor({ state: "visible", timeout: 15_000 });
      const skBox = await skeletonFooter.boundingBox();
      await page.unroute("**/_serverFn/**");

      await page.goto("/?tab=latest&sort=new");
      const realFooter = page.locator("article > .p-3").first();
      await realFooter.waitFor({ state: "visible", timeout: 20_000 });
      const realBox = await realFooter.boundingBox();

      expect(skBox && realBox).toBeTruthy();
      // Footer should reserve ≥ real height (never shorter — avoids upward jump).
      // Allow skeleton to be up to 4px taller (line-height vs placeholder rounding).
      const skH = Math.round(skBox!.height);
      const realH = Math.round(realBox!.height);
      expect(
        skH,
        `Footer too short at ${bp.name}: skeleton=${skH}px real=${realH}px`,
      ).toBeGreaterThanOrEqual(realH - 1);
      expect(
        skH - realH,
        `Footer too tall at ${bp.name}: skeleton=${skH}px real=${realH}px`,
      ).toBeLessThanOrEqual(8);
    });
  }
});