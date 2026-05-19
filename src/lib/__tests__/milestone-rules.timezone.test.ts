import { describe, it, expect } from "vitest";
import { decideMilestone, type PhotoForMilestone } from "../milestone-rules";
import { nextMilestoneProgress } from "../milestone";

const HOUR = 60 * 60 * 1000;

const base = (created_at: string): PhotoForMilestone => ({
  id: "p",
  created_at,
  total_score: 100,
  milestone_stars: 0,
  milestone_achieved_at: [],
});

// All of these strings represent the SAME instant in time.
// (2026-01-01T00:00:00Z == 2026-01-01T07:00:00+07:00 == 2025-12-31T19:00:00-05:00)
const SAME_INSTANT = [
  "2026-01-01T00:00:00.000Z",
  "2026-01-01T00:00:00+00:00",
  "2026-01-01T07:00:00+07:00", // Asia/Bangkok
  "2025-12-31T19:00:00-05:00", // America/New_York EST
  "2026-01-01T09:00:00+09:00", // Asia/Tokyo
  "2025-12-31T16:00:00-08:00", // America/Los_Angeles PST
];

describe("decideMilestone — timezone of created_at must not change the result", () => {
  // "now" is 24h after the shared instant, in UTC.
  const now = new Date("2026-01-02T00:00:00.000Z");

  it("yields the same elapsed age regardless of created_at TZ string", () => {
    const ages = SAME_INSTANT.map((s) => decideMilestone(base(s), 0, now).ageMs);
    for (const a of ages) expect(a).toBe(24 * HOUR);
  });

  it("awards the same tier regardless of created_at TZ string", () => {
    for (const s of SAME_INSTANT) {
      const d = decideMilestone(base(s), 50, now);
      expect(d.qualifiedTier).toBe(1);
      expect(d.newStars).toBe(1);
    }
  });

  it("does not slip into the next tier when TZ offsets are large", () => {
    // 1ms shy of 24h — must still be tier 0 in every TZ representation.
    const oneMsShy = new Date(now.getTime() - 1);
    for (const s of SAME_INSTANT) {
      const d = decideMilestone(base(s), 50, oneMsShy);
      expect(d.qualifiedTier).toBe(0);
    }
  });

  it("the 'now' Date is also TZ-agnostic (its UTC instant is what counts)", () => {
    // Same UTC instant, expressed via a +07:00 string.
    const nowBkk = new Date("2026-01-02T07:00:00+07:00");
    expect(nowBkk.getTime()).toBe(now.getTime());
    const dUtc = decideMilestone(base(SAME_INSTANT[0]), 50, now);
    const dBkk = decideMilestone(base(SAME_INSTANT[0]), 50, nowBkk);
    expect(dBkk.ageMs).toBe(dUtc.ageMs);
    expect(dBkk.newStars).toBe(dUtc.newStars);
  });

  it("naive (TZ-less) ISO strings are interpreted as LOCAL time — caller beware", () => {
    // This documents that omitting the TZ suffix is a footgun: the runtime
    // parses it as local time, so the same wall-clock string produces
    // different instants on machines in different TZs. Postgres always
    // returns timestamps WITH a TZ (e.g. "2026-01-01T00:00:00+00:00"), so
    // the cron route and UI helpers never see this case in production.
    const naive = new Date("2026-01-01T00:00:00"); // no Z, no offset
    const utc = new Date("2026-01-01T00:00:00Z");
    // Difference equals the runner's TZ offset; on a UTC CI box it's 0.
    const diff = naive.getTime() - utc.getTime();
    expect(Math.abs(diff)).toBeLessThanOrEqual(14 * HOUR);
  });
});

describe("decideMilestone — naive (TZ-less) created_at locked to LOCAL-time parsing", () => {
  // Production never sees naive strings (Postgres always returns with TZ),
  // but we lock the runtime contract: a naive ISO MUST be parsed as local
  // time, exactly like `new Date(s).getTime()`. If a future polyfill or
  // runtime change silently treats naive ISO as UTC, these tests will fail
  // and surface the regression before it reaches users.
  const NAIVE = [
    "2026-01-01T00:00:00",
    "2026-01-01T00:00:00.000",
    "2026-01-01T12:34:56",
  ];

  it("ageMs equals (now - new Date(naive).getTime()) for every naive string", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    for (const s of NAIVE) {
      const expected = now.getTime() - new Date(s).getTime();
      const { ageMs } = decideMilestone(base(s), 0, now);
      expect(ageMs).toBe(expected);
    }
  });

  it("naive vs explicit-Z of the same wall clock differ by the runner's TZ offset", () => {
    const naive = new Date("2026-01-01T00:00:00").getTime();
    const utc = new Date("2026-01-01T00:00:00Z").getTime();
    // Compare against the Intl-reported offset for that wall clock — this
    // works on any CI TZ (UTC, Bangkok, NY, etc.) without hard-coding.
    const expectedOffsetMs =
      new Date("2026-01-01T00:00:00Z").getTimezoneOffset() * 60 * 1000;
    // naive = wall-clock interpreted as local => UTC instant is shifted by +offset
    expect(naive - utc).toBe(expectedOffsetMs);
  });

  it("tier decision on a naive string matches tier decision on its local-equivalent UTC string", () => {
    const naive = "2026-01-01T00:00:00";
    // Build the equivalent explicit-offset string for the runner's TZ so the
    // two represent the same UTC instant.
    const naiveInstant = new Date(naive).getTime();
    const equivalentUtc = new Date(naiveInstant).toISOString();
    const now = new Date(naiveInstant + 25 * HOUR);
    const a = decideMilestone(base(naive), 0, now);
    const b = decideMilestone(base(equivalentUtc), 0, now);
    expect(a.ageMs).toBe(b.ageMs);
    expect(a.qualifiedTier).toBe(b.qualifiedTier);
    expect(a.newStars).toBe(b.newStars);
  });
});

describe("nextMilestoneProgress (UI helper) — TZ-agnostic", () => {
  it("returns the same elapsedHours for every TZ string of the same instant", () => {
    // Freeze "now" to a known UTC instant via Date.now spy.
    const fixedNow = new Date("2026-01-02T00:00:00.000Z").getTime();
    const spy = vi.spyOn(Date, "now").mockReturnValue(fixedNow);
    try {
      const hours = SAME_INSTANT.map(
        (s) => nextMilestoneProgress(0, s)!.elapsedHours,
      );
      for (const h of hours) expect(h).toBeCloseTo(24, 6);
    } finally {
      spy.mockRestore();
    }
  });
});

// vitest's `vi` import (declared at bottom so the file reads top-down naturally)
import { vi } from "vitest";
