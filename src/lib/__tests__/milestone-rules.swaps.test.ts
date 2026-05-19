import { describe, it, expect } from "vitest";
import {
  decideMilestone,
  resetClockOnDethrone,
  type RankedPhoto,
} from "../milestone-rules";

const DAY = 24 * 60 * 60 * 1000;

type SimPhoto = RankedPhoto;

const make = (id: string): SimPhoto => ({
  id,
  milestone_stars: 0,
  milestone_achieved_at: [],
  rank_one_since: null,
});

/**
 * Simulate one cron tick: `topId` is the current #1 among `photos`.
 * Mirrors the production cron route: dethrone everyone else, then apply
 * decideMilestone to the new top.
 */
function tick(photos: Record<string, SimPhoto>, topId: string | null, now: Date) {
  for (const id of Object.keys(photos)) {
    if (id === topId) continue;
    const reset = resetClockOnDethrone(photos[id]);
    photos[id] = {
      id,
      milestone_stars: reset.milestone_stars,
      milestone_achieved_at: reset.milestone_achieved_at,
      rank_one_since: reset.rank_one_since,
    };
  }
  if (!topId) return;
  const top = photos[topId];
  const d = decideMilestone(top, now);
  photos[topId] = {
    ...top,
    rank_one_since: d.startClock ? now.toISOString() : top.rank_one_since,
    milestone_stars: d.newStars,
    milestone_achieved_at: [
      ...top.milestone_achieved_at,
      ...d.newlyAchievedAt,
    ],
  };
}

describe("multi-photo #1 swaps", () => {
  it("resets rank_one_since on dethrone for every loser and starts fresh for the new top", () => {
    const photos: Record<string, SimPhoto> = {
      A: make("A"),
      B: make("B"),
      C: make("C"),
    };
    const t0 = new Date("2026-01-01T00:00:00Z");

    // A is #1 at t0
    tick(photos, "A", t0);
    expect(photos.A.rank_one_since).toBe(t0.toISOString());
    expect(photos.B.rank_one_since).toBeNull();
    expect(photos.C.rank_one_since).toBeNull();

    // 12h later B overtakes — A's clock must reset, B's starts fresh
    const t1 = new Date(t0.getTime() + DAY / 2);
    tick(photos, "B", t1);
    expect(photos.A.rank_one_since).toBeNull();
    expect(photos.B.rank_one_since).toBe(t1.toISOString());
    // No stars earned yet (no one held #1 a full day)
    expect(photos.A.milestone_stars).toBe(0);
    expect(photos.B.milestone_stars).toBe(0);

    // 12h later C overtakes
    const t2 = new Date(t1.getTime() + DAY / 2);
    tick(photos, "C", t2);
    expect(photos.B.rank_one_since).toBeNull();
    expect(photos.C.rank_one_since).toBe(t2.toISOString());
  });

  it("preserves earned stars across many dethrone/re-throne cycles", () => {
    const photos: Record<string, SimPhoto> = { A: make("A"), B: make("B") };
    let now = new Date("2026-01-01T00:00:00Z");

    // A holds #1 long enough to earn the 1st star (1 day)
    tick(photos, "A", now);
    now = new Date(now.getTime() + DAY);
    tick(photos, "A", now);
    expect(photos.A.milestone_stars).toBe(1);
    expect(photos.A.milestone_achieved_at).toHaveLength(1);

    const startsA: (string | null)[] = [photos.A.rank_one_since];

    // Run 5 swap cycles: B takes #1, then A reclaims.
    for (let i = 0; i < 5; i++) {
      now = new Date(now.getTime() + 3 * DAY);
      tick(photos, "B", now);
      expect(photos.A.rank_one_since).toBeNull();
      // A keeps its star even though it's no longer #1
      expect(photos.A.milestone_stars).toBe(1);
      expect(photos.A.milestone_achieved_at).toHaveLength(1);

      now = new Date(now.getTime() + DAY / 2);
      tick(photos, "A", now);
      expect(photos.B.rank_one_since).toBeNull();
      expect(photos.A.rank_one_since).toBe(now.toISOString());
      // Still 1 star — clock just restarted, hasn't crossed next threshold
      expect(photos.A.milestone_stars).toBe(1);
      startsA.push(photos.A.rank_one_since);
    }

    // Every restart timestamp must be unique (clock truly restarted).
    const nonNull = startsA.filter((s): s is string => !!s);
    expect(new Set(nonNull).size).toBe(nonNull.length);

    // B never held #1 long enough — no stars, no leftover clock.
    expect(photos.B.milestone_stars).toBe(0);
    expect(photos.B.milestone_achieved_at).toEqual([]);
  });

  it("each photo accumulates its own stars independently across swaps", () => {
    const photos: Record<string, SimPhoto> = { A: make("A"), B: make("B") };
    let now = new Date("2026-01-01T00:00:00Z");

    // A holds #1 for 8 days -> earns 1d + 7d stars (2 total)
    tick(photos, "A", now);
    now = new Date(now.getTime() + 8 * DAY);
    tick(photos, "A", now);
    expect(photos.A.milestone_stars).toBe(2);

    // B overtakes and holds for 8 days -> earns its own 2 stars
    now = new Date(now.getTime() + 1000); // small gap
    tick(photos, "B", now);
    expect(photos.A.rank_one_since).toBeNull();
    expect(photos.A.milestone_stars).toBe(2); // A keeps its stars

    now = new Date(now.getTime() + 8 * DAY);
    tick(photos, "B", now);
    expect(photos.B.milestone_stars).toBe(2);
    expect(photos.A.milestone_stars).toBe(2);

    // A reclaims and holds for 30 more days -> reaches 30d threshold (3rd star)
    now = new Date(now.getTime() + 1000);
    tick(photos, "A", now);
    expect(photos.B.rank_one_since).toBeNull();
    expect(photos.B.milestone_stars).toBe(2); // B keeps its stars

    now = new Date(now.getTime() + 30 * DAY);
    tick(photos, "A", now);
    expect(photos.A.milestone_stars).toBe(3);
    expect(photos.A.milestone_achieved_at).toHaveLength(3);
    expect(photos.B.milestone_stars).toBe(2);
  });
});