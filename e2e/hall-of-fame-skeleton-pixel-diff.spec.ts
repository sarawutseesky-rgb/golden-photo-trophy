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
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

const STRIP_SEL = ".pointer-events-none.absolute.inset-x-0.bottom-0";
const FOOTER_SEL = ".p-3";

async function shotPng(loc: Locator): Promise<PNG> {
  await loc.waitFor({ state: "visible", timeout: 20_000 });
  const buf = await loc.screenshot();
  return PNG.sync.read(buf);
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

async function captureSkeleton(page: Page, sel: string) {
  await page.route("**/_serverFn/**", async (route) => {
    if (/photo|feed|hof/i.test(route.request().url())) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    await route.continue();
  });
  await page.goto("/hall-of-fame");
  const loc = page.locator(`[aria-busy="true"] > div`).first().locator(sel).first();
  const png = await shotPng(loc);
  await page.unroute("**/_serverFn/**");
  return png;
}

async function captureReal(page: Page, sel: string) {
  await page.goto("/?tab=latest&sort=new");
  const loc = page.locator("article").first().locator(sel).first();
  const png = await shotPng(loc);
  return png;
}

test.describe("Hall of Fame — Skeleton vs PhotoCard pixel diff", () => {
  for (const bp of BREAKPOINTS) {
    test(`${bp.name}: bottom strip matches real card envelope`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const sk = await captureSkeleton(page, STRIP_SEL);
      const real = await captureReal(page, STRIP_SEL);

      // ENVELOPE assertion — height pixel-exact, width within rounding.
      expect(
        Math.abs(sk.height - real.height),
        `bottom strip height drift at ${bp.name}: skeleton=${sk.height}px real=${real.height}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(sk.width - real.width),
        `bottom strip width drift at ${bp.name}: skeleton=${sk.width}px real=${real.width}px`,
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

      await testInfo.attach(`skeleton-${bp.name}-strip.png`, {
        body: PNG.sync.write(a),
        contentType: "image/png",
      });
      await testInfo.attach(`real-${bp.name}-strip.png`, {
        body: PNG.sync.write(b),
        contentType: "image/png",
      });
      await testInfo.attach(`diff-${bp.name}-strip.png`, {
        body: PNG.sync.write(diff),
        contentType: "image/png",
      });

      // Real text + icons differ from placeholders, so we don't require near-zero diff.
      // We DO require that the diff is bounded — a runaway diff (>70%) means the
      // skeleton's structure changed dramatically (e.g. strip moved or vanished).
      expect(
        ratio,
        `bottom strip pixel diff too high at ${bp.name}: ${(ratio * 100).toFixed(1)}% (>70%)`,
      ).toBeLessThan(0.7);
    });

    test(`${bp.name}: footer block matches real card envelope`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const sk = await captureSkeleton(page, FOOTER_SEL);
      const real = await captureReal(page, FOOTER_SEL);

      // Footer height: skeleton may be ≤8px taller (placeholder vs line-box rounding),
      // never shorter (would cause an upward jump on swap).
      expect(
        sk.height,
        `footer too short at ${bp.name}: skeleton=${sk.height}px real=${real.height}px`,
      ).toBeGreaterThanOrEqual(real.height - 1);
      expect(
        sk.height - real.height,
        `footer too tall at ${bp.name}: skeleton=${sk.height}px real=${real.height}px`,
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

      await testInfo.attach(`skeleton-${bp.name}-footer.png`, {
        body: PNG.sync.write(a),
        contentType: "image/png",
      });
      await testInfo.attach(`real-${bp.name}-footer.png`, {
        body: PNG.sync.write(b),
        contentType: "image/png",
      });
      await testInfo.attach(`diff-${bp.name}-footer.png`, {
        body: PNG.sync.write(diff),
        contentType: "image/png",
      });

      expect(
        ratio,
        `footer pixel diff too high at ${bp.name}: ${(ratio * 100).toFixed(1)}% (>70%)`,
      ).toBeLessThan(0.7);
    });
  }
});