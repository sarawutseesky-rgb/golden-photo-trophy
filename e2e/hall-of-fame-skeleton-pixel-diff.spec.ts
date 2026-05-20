import { test, expect, type Page, type Locator } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

// Pixel-level screenshot diff between PhotoGridSkeleton (Hall of Fame loading
// state) and the real PhotoCard at every supported breakpoint.
//
// Strategy:
//   1. Screenshot the skeleton's bottom info strip + footer block.
//   2. Screenshot the real card's equivalent regions.
//   3. Normalise both to identical canvas size and run pixelmatch.
//   4. Most pixels differ (text vs placeholder, real icons vs rectangles) —
//      what we actually assert is the OUTER ENVELOPE: both regions occupy
//      the same width × height. The diff ratio is reported as a soft signal.
//
// This catches regressions where the skeleton silently changes shape and
// causes a layout jump when real data swaps in.

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

const STRIP_TID = "photo-card-bottom-strip";
const FOOTER_TID = "photo-card-footer";
const SK_TILE_TID = "photo-card-skeleton";
const CARD_TID = "photo-card";

/** Indices 0..cols-1 — one tile per visible masonry column at this breakpoint. */
const tileIndices = (cols: number): readonly number[] =>
  Array.from({ length: cols }, (_, i) => i);

async function shotPng(loc: Locator): Promise<PNG> {
  await loc.waitFor({ state: "visible", timeout: 20_000 });
  const buf = await loc.screenshot();
  return PNG.sync.read(buf);
}

/**
 * Wait until the masonry grid for `tid` resolves to exactly `expectedCols`
 * visible columns AND stays there for several consecutive samples. CSS
 * `columns-*` is a layout-time property — during slow loads tiles can
 * briefly stack in 1 column before the browser reflows. Asserting too
 * early would flake; this waits for layout to settle.
 *
 * Column count is derived from distinct rounded x-origins of tile bounding
 * boxes (rounded to the nearest 4px to absorb sub-pixel jitter).
 */
async function waitForStableColumns(
  page: Page,
  tid: string,
  expectedCols: number,
  { timeout = 15_000, stableSamples = 3, interval = 100 } = {},
) {
  const deadline = Date.now() + timeout;
  let streak = 0;
  let lastSeen = -1;
  while (Date.now() < deadline) {
    const xs = await page.getByTestId(tid).evaluateAll((els) =>
      els
        .map((el) => (el as HTMLElement).getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => Math.round(r.x / 4) * 4),
    );
    const cols = new Set(xs).size;
    if (cols === expectedCols) {
      streak += 1;
      if (streak >= stableSamples) return;
    } else {
      streak = 0;
    }
    lastSeen = cols;
    await page.waitForTimeout(interval);
  }
  throw new Error(
    `Masonry columns for [data-testid=${tid}] did not stabilise at ${expectedCols} within ${timeout}ms (last seen=${lastSeen})`,
  );
}

/** Resize PNG to (w,h) by nearest-neighbour padding/cropping so two PNGs can be diffed. */
function fit(src: PNG, w: number, h: number): PNG {
  if (src.width === w && src.height === h) return src;
  const out = new PNG({ width: w, height: h });
  // Fill transparent
  out.data.fill(0);
  const cw = Math.min(src.width, w);
  const ch = Math.min(src.height, h);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (src.width * y + x) << 2;
      const di = (w * y + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

async function captureSkeleton(
  page: Page,
  regionTid: string,
  idx: number,
  cols: number,
) {
  await page.route("**/_serverFn/**", async (route) => {
    if (/photo|feed|hof/i.test(route.request().url())) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    await route.continue();
  });
  await page.goto("/hall-of-fame");
  // Layout sanity: the masonry must render at least `cols` skeleton tiles
  // (one per visible column) before we sample any of them. If this fails,
  // the grid collapsed or the breakpoint mapping drifted — fail loud.
  await expect
    .poll(() => page.getByTestId(SK_TILE_TID).count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(cols);
  await waitForStableColumns(page, SK_TILE_TID, cols);
  await expect(page.getByTestId(SK_TILE_TID).nth(idx)).toBeVisible({
    timeout: 15_000,
  });
  const loc = page
    .getByTestId(SK_TILE_TID)
    .nth(idx)
    .getByTestId(regionTid)
    .first();
  const png = await shotPng(loc);
  await page.unroute("**/_serverFn/**");
  return png;
}

async function captureReal(
  page: Page,
  regionTid: string,
  idx: number,
  cols: number,
) {
  await page.goto("/?tab=latest&sort=new");
  await expect
    .poll(() => page.getByTestId(CARD_TID).count(), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(cols);
  await waitForStableColumns(page, CARD_TID, cols, { timeout: 20_000 });
  await expect(page.getByTestId(CARD_TID).nth(idx)).toBeVisible({
    timeout: 20_000,
  });
  const loc = page
    .getByTestId(CARD_TID)
    .nth(idx)
    .getByTestId(regionTid)
    .first();
  const png = await shotPng(loc);
  return png;
}

test.describe("Hall of Fame — Skeleton vs PhotoCard pixel diff", () => {
  for (const bp of BREAKPOINTS) {
    for (const idx of tileIndices(bp.cols)) {
    test(`${bp.name} — tile #${idx + 1}: bottom strip matches real card envelope`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const sk = await captureSkeleton(page, STRIP_TID, idx, bp.cols);
      const real = await captureReal(page, STRIP_TID, idx, bp.cols);

      // ENVELOPE assertion — height pixel-exact, width within rounding.
      expect(
        Math.abs(sk.height - real.height),
        `bottom strip height drift at ${bp.name} tile#${idx + 1}: skeleton=${sk.height}px real=${real.height}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(sk.width - real.width),
        `bottom strip width drift at ${bp.name} tile#${idx + 1}: skeleton=${sk.width}px real=${real.width}px`,
      ).toBeLessThanOrEqual(4);

      // PIXEL DIFF — normalise to common canvas, attach images + diff for inspection.
      const W = Math.max(sk.width, real.width);
      const H = Math.max(sk.height, real.height);
      const a = fit(sk, W, H);
      const b = fit(real, W, H);
      const diff = new PNG({ width: W, height: H });
      const numDiff = pixelmatch(a.data, b.data, diff.data, W, H, {
        threshold: 0.2,
        includeAA: false,
      });
      const ratio = numDiff / (W * H);

      await testInfo.attach(`skeleton-${bp.name}-tile${idx + 1}-strip.png`, {
        body: PNG.sync.write(a),
        contentType: "image/png",
      });
      await testInfo.attach(`real-${bp.name}-tile${idx + 1}-strip.png`, {
        body: PNG.sync.write(b),
        contentType: "image/png",
      });
      await testInfo.attach(`diff-${bp.name}-tile${idx + 1}-strip.png`, {
        body: PNG.sync.write(diff),
        contentType: "image/png",
      });

      // Real text + icons differ from placeholders, so we don't require near-zero diff.
      // We DO require that the diff is bounded — a runaway diff (>70%) means the
      // skeleton's structure changed dramatically (e.g. strip moved or vanished).
      expect(
        ratio,
        `bottom strip pixel diff too high at ${bp.name} tile#${idx + 1}: ${(ratio * 100).toFixed(1)}% (>70%)`,
      ).toBeLessThan(0.7);
    });

    test(`${bp.name} — tile #${idx + 1}: footer block matches real card envelope`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const sk = await captureSkeleton(page, FOOTER_TID, idx, bp.cols);
      const real = await captureReal(page, FOOTER_TID, idx, bp.cols);

      // Footer height: skeleton may be ≤8px taller (placeholder vs line-box rounding),
      // never shorter (would cause an upward jump on swap).
      expect(
        sk.height,
        `footer too short at ${bp.name} tile#${idx + 1}: skeleton=${sk.height}px real=${real.height}px`,
      ).toBeGreaterThanOrEqual(real.height - 1);
      expect(
        sk.height - real.height,
        `footer too tall at ${bp.name} tile#${idx + 1}: skeleton=${sk.height}px real=${real.height}px`,
      ).toBeLessThanOrEqual(8);
      expect(Math.abs(sk.width - real.width)).toBeLessThanOrEqual(4);

      const W = Math.max(sk.width, real.width);
      const H = Math.max(sk.height, real.height);
      const a = fit(sk, W, H);
      const b = fit(real, W, H);
      const diff = new PNG({ width: W, height: H });
      const numDiff = pixelmatch(a.data, b.data, diff.data, W, H, {
        threshold: 0.2,
        includeAA: false,
      });
      const ratio = numDiff / (W * H);

      await testInfo.attach(`skeleton-${bp.name}-tile${idx + 1}-footer.png`, {
        body: PNG.sync.write(a),
        contentType: "image/png",
      });
      await testInfo.attach(`real-${bp.name}-tile${idx + 1}-footer.png`, {
        body: PNG.sync.write(b),
        contentType: "image/png",
      });
      await testInfo.attach(`diff-${bp.name}-tile${idx + 1}-footer.png`, {
        body: PNG.sync.write(diff),
        contentType: "image/png",
      });

      expect(
        ratio,
        `footer pixel diff too high at ${bp.name} tile#${idx + 1}: ${(ratio * 100).toFixed(1)}% (>70%)`,
      ).toBeLessThan(0.7);
    });
    }
  }
});