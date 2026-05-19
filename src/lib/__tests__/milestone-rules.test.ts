import { describe, it, expect } from "vitest";
import {
  THRESHOLDS_HOURS,
  THRESHOLDS_MS,
  buildMaxLaterScoreMap,
  decideMilestone,
  maxQualifiedTier,
  type PhotoForMilestone,
} from "../milestone-rules";

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-01-01T00:00:00.000Z");

const make = (over: Partial<PhotoForMilestone> = {}): PhotoForMilestone => ({
  id: "p",
  created_at: T0.toISOString(),
  total_score: 0,
  milestone_stars: 0,
  milestone_achieved_at: [],
  ...over,
});

describe("THRESHOLDS", () => {
  it("matches the spec: 24/168/720/2160/4320 hours", () => {
    expect(THRESHOLDS_HOURS).toEqual([24, 168, 720, 2160, 4320]);
    expect(THRESHOLDS_MS).toEqual(THRESHOLDS_HOURS.map((h) => h * HOUR));
  });
});

describe("maxQualifiedTier", () => {
  it("returns 0 when overtaken by a later upload", () => {
    expect(maxQualifiedTier(1000 * HOUR, false)).toBe(0);
  });
  it("returns the highest tier reached by age", () => {
    expect(maxQualifiedTier(23 * HOUR, true)).toBe(0);
    expect(maxQualifiedTier(24 * HOUR, true)).toBe(1);
    expect(maxQualifiedTier(167 * HOUR, true)).toBe(1);
    expect(maxQualifiedTier(168 * HOUR, true)).toBe(2);
    expect(maxQualifiedTier(720 * HOUR, true)).toBe(3);
    expect(maxQualifiedTier(2160 * HOUR, true)).toBe(4);
    expect(maxQualifiedTier(4320 * HOUR, true)).toBe(5);
    expect(maxQualifiedTier(99999 * HOUR, true)).toBe(5);
  });
});

describe("decideMilestone", () => {
  it("awards 1★ exactly at 24h when no later photo outscores", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 24 * HOUR).toISOString(),
      total_score: 50,
    });
    const d = decideMilestone(p, 49, T0);
    expect(d.beatsLater).toBe(true);
    expect(d.qualifiedTier).toBe(1);
    expect(d.newStars).toBe(1);
    expect(d.newlyAchievedAt).toEqual([T0.toISOString()]);
  });

  it("does not award when a later upload scores strictly higher", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 24 * HOUR).toISOString(),
      total_score: 49,
    });
    const d = decideMilestone(p, 50, T0);
    expect(d.beatsLater).toBe(false);
    expect(d.qualifiedTier).toBe(0);
    expect(d.newStars).toBe(0);
  });

  it("allows ties — equal later score does not block the tier", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 24 * HOUR).toISOString(),
      total_score: 30,
    });
    const d = decideMilestone(p, 30, T0);
    expect(d.beatsLater).toBe(true);
    expect(d.newStars).toBe(1);
  });

  it("can jump multiple tiers at once (0 → 3) when crossing thresholds", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 800 * HOUR).toISOString(), // > 720h
      total_score: 100,
    });
    const d = decideMilestone(p, 0, T0);
    expect(d.qualifiedTier).toBe(3);
    expect(d.newStars).toBe(3);
    expect(d.newlyAchievedAt).toHaveLength(3);
  });

  it("never removes earned stars even if later overtaken", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 200 * HOUR).toISOString(),
      total_score: 10,
      milestone_stars: 2,
      milestone_achieved_at: ["a", "b"],
    });
    const d = decideMilestone(p, 9999, T0);
    expect(d.beatsLater).toBe(false);
    expect(d.qualifiedTier).toBe(0);
    expect(d.newStars).toBe(2); // preserved
    expect(d.newlyAchievedAt).toEqual([]);
  });

  it("does not re-award an already-earned tier", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 200 * HOUR).toISOString(),
      total_score: 100,
      milestone_stars: 2,
    });
    const d = decideMilestone(p, 0, T0);
    expect(d.qualifiedTier).toBe(2);
    expect(d.newStars).toBe(2);
    expect(d.newlyAchievedAt).toEqual([]);
  });

  it("caps at 5★", () => {
    const p = make({
      created_at: new Date(T0.getTime() - 10000 * HOUR).toISOString(),
      total_score: 1,
      milestone_stars: 5,
    });
    const d = decideMilestone(p, 0, T0);
    expect(d.qualifiedTier).toBe(5);
    expect(d.newStars).toBe(5);
    expect(d.newlyAchievedAt).toEqual([]);
  });
});

describe("buildMaxLaterScoreMap", () => {
  it("maps each photo to the max score of strictly-later photos", () => {
    // Sorted oldest -> newest
    const photos = [
      { id: "A", total_score: 10 },
      { id: "B", total_score: 30 },
      { id: "C", total_score: 20 },
      { id: "D", total_score: 5 },
    ];
    const m = buildMaxLaterScoreMap(photos);
    expect(m.get("A")).toBe(30); // max(B,C,D) = 30
    expect(m.get("B")).toBe(20); // max(C,D) = 20
    expect(m.get("C")).toBe(5);
    expect(m.get("D")).toBe(-Infinity); // no later photos
  });

  it("a later high-scoring upload blocks an older photo from earning", () => {
    const A = make({
      id: "A",
      created_at: new Date(T0.getTime() - 30 * HOUR).toISOString(),
      total_score: 20,
    });
    const B = make({
      id: "B",
      created_at: new Date(T0.getTime() - 25 * HOUR).toISOString(),
      total_score: 21,
    });
    const m = buildMaxLaterScoreMap([A, B]);
    const dA = decideMilestone(A, m.get(A.id) ?? -Infinity, T0);
    const dB = decideMilestone(B, m.get(B.id) ?? -Infinity, T0);
    expect(dA.newStars).toBe(0); // blocked by B
    expect(dB.newStars).toBe(1); // no later photo, age >= 24h
  });
});

describe("end-to-end scenario across multiple cron ticks", () => {
  it("awards 2★ at 168h, keeps stars if later overtaken, awards 3★ at 720h", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const p: PhotoForMilestone = {
      id: "p",
      created_at: created.toISOString(),
      total_score: 100,
      milestone_stars: 0,
      milestone_achieved_at: [],
    };

    // Tick at 24h: earns 1★
    let now = new Date(created.getTime() + 24 * HOUR);
    let d = decideMilestone(p, 50, now);
    expect(d.newStars).toBe(1);
    p.milestone_stars = d.newStars;
    p.milestone_achieved_at.push(...d.newlyAchievedAt);

    // Tick at 168h: earns 2★
    now = new Date(created.getTime() + 168 * HOUR);
    d = decideMilestone(p, 50, now);
    expect(d.newStars).toBe(2);
    p.milestone_stars = d.newStars;
    p.milestone_achieved_at.push(...d.newlyAchievedAt);

    // Tick at 500h: a later photo overtakes -> no new tier, but keeps 2★
    now = new Date(created.getTime() + 500 * HOUR);
    d = decideMilestone(p, 9999, now);
    expect(d.newStars).toBe(2);

    // Tick at 720h: later photo no longer outscores -> earns 3★
    now = new Date(created.getTime() + 720 * HOUR);
    d = decideMilestone(p, 50, now);
    expect(d.newStars).toBe(3);
    expect(d.newlyAchievedAt).toHaveLength(1);
  });
});
