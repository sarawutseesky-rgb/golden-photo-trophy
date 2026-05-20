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
  // `cols` mirrors PhotoGrid's MASONRY_COLS Tailwind breakpoints:
  //   <640  → columns-1   (mobile)
  //   ≥640  → columns-2   (sm)
  //   ≥768  → columns-3   (md, tablet)
  //   ≥1024 → columns-4   (lg)
  //   ≥1280 → columns-5   (xl, desktop)
  // We sample exactly `cols` tiles per breakpoint — one per visible column —
  // so coverage scales with the layout instead of being a hand-picked guess.
  { name: "mobile", width: 390, height: 844, cols: 1 },
  { name: "tablet", width: 768, height: 1024, cols: 3 },
  { name: "desktop", width: 1280, height: 800, cols: 5 },
] as const;

// data-testid hooks defined on both PhotoCard and PhotoGridSkeleton so the
// selectors target exactly one element per tile, even on pages with many
// cards and other overlays.
const STRIP_TID = "photo-card-bottom-strip";
const FOOTER_TID = "photo-card-footer";
const SK_TILE_TID = "photo-card-skeleton";
const CARD_TID = "photo-card";

/** Indices 0..cols-1 — one tile per visible masonry column at this breakpoint. */
const tileIndices = (cols: number): readonly number[] =>
  Array.from({ length: cols }, (_, i) => i);

async function getStripSize(page: Page, parentTid: string, idx: number): Promise<Strip> {
  const handle = page
    .getByTestId(parentTid)
    .nth(idx)
    .getByTestId(STRIP_TID)
    .first();
  await handle.waitFor({ state: "visible", timeout: 15_000 });
  const box = await handle.boundingBox();
  if (!box)
    throw new Error(
      `No bounding box for [data-testid=${parentTid}][${idx}] [data-testid=${STRIP_TID}]`,
    );
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

test.describe("Hall of Fame — Skeleton matches real card layout", () => {
  for (const bp of BREAKPOINTS) {
    for (const idx of tileIndices(bp.cols)) {
      test(`${bp.name} (${bp.width}x${bp.height}) — tile #${idx + 1}: skeleton strip matches real card`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });

        // Slow the feed request so the skeleton stays on-screen long enough.
        await page.route("**/_serverFn/**", async (route) => {
          if (/photo|feed|hof/i.test(route.request().url())) {
            await new Promise((r) => setTimeout(r, 1500));
          }
          await route.continue();
        });
        await page.goto("/hall-of-fame");

        // Ensure at least (idx + 1) skeleton tiles are rendered.
        await expect(page.getByTestId(SK_TILE_TID).nth(idx)).toBeVisible({
          timeout: 15_000,
        });
        const skeleton = await getStripSize(page, SK_TILE_TID, idx);
        await page.unroute("**/_serverFn/**");

        await page.goto("/?tab=latest&sort=new");
        // Ensure at least (idx + 1) real cards exist before measuring.
        await expect(page.getByTestId(CARD_TID).nth(idx)).toBeVisible({
          timeout: 20_000,
        });
        const real = await getStripSize(page, CARD_TID, idx);

        // Height must match within 1px — what prevents the swap-in "jump".
        expect(
          Math.abs(skeleton.height - real.height),
          `Strip height mismatch at ${bp.name} tile#${idx + 1}: skeleton=${skeleton.height}px real=${real.height}px`,
        ).toBeLessThanOrEqual(1);

        // Width should be within a tight tolerance (full column width).
        expect(
          Math.abs(skeleton.width - real.width),
          `Strip width mismatch at ${bp.name} tile#${idx + 1}: skeleton=${skeleton.width}px real=${real.width}px`,
        ).toBeLessThanOrEqual(4);

        // Sanity: catches collapse-to-zero regressions.
        expect(skeleton.height).toBeGreaterThanOrEqual(24);
        expect(real.height).toBeGreaterThanOrEqual(24);
      });
    }
  }
});

test.describe("Hall of Fame — Skeleton card footer matches real card footer", () => {
  for (const bp of BREAKPOINTS) {
    for (const idx of tileIndices(bp.cols)) {
      test(`${bp.name} — tile #${idx + 1}: footer block height matches real card`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });

        await page.route("**/_serverFn/**", async (route) => {
          if (/photo|feed|hof/i.test(route.request().url())) {
            await new Promise((r) => setTimeout(r, 1500));
          }
          await route.continue();
        });
        await page.goto("/hall-of-fame");

        await expect(page.getByTestId(SK_TILE_TID).nth(idx)).toBeVisible({
          timeout: 15_000,
        });
        const skeletonFooter = page
          .getByTestId(SK_TILE_TID)
          .nth(idx)
          .getByTestId(FOOTER_TID)
          .first();
        const skBox = await skeletonFooter.boundingBox();
        await page.unroute("**/_serverFn/**");

        await page.goto("/?tab=latest&sort=new");
        await expect(page.getByTestId(CARD_TID).nth(idx)).toBeVisible({
          timeout: 20_000,
        });
        const realFooter = page
          .getByTestId(CARD_TID)
          .nth(idx)
          .getByTestId(FOOTER_TID)
          .first();
        const realBox = await realFooter.boundingBox();

        expect(skBox && realBox).toBeTruthy();
        const skH = Math.round(skBox!.height);
        const realH = Math.round(realBox!.height);
        expect(
          skH,
          `Footer too short at ${bp.name} tile#${idx + 1}: skeleton=${skH}px real=${realH}px`,
        ).toBeGreaterThanOrEqual(realH - 1);
        expect(
          skH - realH,
          `Footer too tall at ${bp.name} tile#${idx + 1}: skeleton=${skH}px real=${realH}px`,
        ).toBeLessThanOrEqual(8);
      });
    }
  }
});