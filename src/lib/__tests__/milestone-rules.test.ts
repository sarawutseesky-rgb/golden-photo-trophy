import { describe, it, expect } from "vitest";
import {
  THRESHOLDS_MS,
  decideMilestone,
  resetClockOnDethrone,
  type RankedPhoto,
} from "../milestone-rules";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-01-01T00:00:00.000Z");
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);

const make = (over: Partial<RankedPhoto> = {}): RankedPhoto => ({
  id: "p1",
  milestone_stars: 0,
  milestone_achieved_at: [],
  rank_one_since: null,
  ...over,
});

describe("decideMilestone", () => {
  it("starts the clock when the photo just became #1", () => {
    const d = decideMilestone(make({ rank_one_since: null }), T0);
    expect(d.startClock).toBe(true);
    expect(d.elapsedMs).toBe(0);
    expect(d.newStars).toBe(0);
    expect(d.newlyAchievedAt).toEqual([]);
  });

  it("does not award a star before 1 day has passed", () => {
    const since = at(-DAY + 1).toISOString(); // 1ms shy of 1 day
    const d = decideMilestone(make({ rank_one_since: since }), T0);
    expect(d.newStars).toBe(0);
    expect(d.newlyAchievedAt).toHaveLength(0);
  });

  it("awards the 1st star exactly at the 1-day threshold", () => {
    const since = at(-DAY).toISOString();
    const d = decideMilestone(make({ rank_one_since: since }), T0);
    expect(d.newStars).toBe(1);
    expect(d.newlyAchievedAt).toEqual([T0.toISOString()]);
  });

  it("awards multiple stars at once when crossing several thresholds", () => {
    // Held #1 for 35 days -> should jump 0 -> 3 stars (1d, 7d, 30d met; 90d not).
    const since = at(-35 * DAY).toISOString();
    const d = decideMilestone(make({ rank_one_since: since }), T0);
    expect(d.newStars).toBe(3);
    expect(d.newlyAchievedAt).toHaveLength(3);
    expect(d.newlyAchievedAt.every((t) => t === T0.toISOString())).toBe(true);
  });

  it("only adds the next star without rewriting previously earned ones", () => {
    // Already has 2 stars; held long enough to earn a 3rd only.
    const since = at(-31 * DAY).toISOString();
    const d = decideMilestone(
      make({
        milestone_stars: 2,
        milestone_achieved_at: ["old-1", "old-2"],
        rank_one_since: since,
      }),
      T0,
    );
    expect(d.newStars).toBe(3);
    expect(d.newlyAchievedAt).toEqual([T0.toISOString()]);
  });

  it("caps at 5 stars and never exceeds the thresholds array", () => {
    const since = at(-1000 * DAY).toISOString();
    const d = decideMilestone(make({ rank_one_since: since }), T0);
    expect(d.newStars).toBe(5);
    expect(d.newlyAchievedAt).toHaveLength(5);
    expect(THRESHOLDS_MS).toHaveLength(5);
  });

  it("does not award more stars when already at the max", () => {
    const since = at(-1000 * DAY).toISOString();
    const d = decideMilestone(
      make({
        milestone_stars: 5,
        milestone_achieved_at: ["a", "b", "c", "d", "e"],
        rank_one_since: since,
      }),
      T0,
    );
    expect(d.newStars).toBe(5);
    expect(d.newlyAchievedAt).toEqual([]);
  });

  it("thresholds match the documented schedule (1/7/30/90/180 days)", () => {
    expect(THRESHOLDS_MS).toEqual([1, 7, 30, 90, 180].map((n) => n * DAY));
  });
});

describe("resetClockOnDethrone", () => {
  it("clears rank_one_since but preserves earned stars and timestamps", () => {
    const prev = make({
      milestone_stars: 3,
      milestone_achieved_at: ["a", "b", "c"],
      rank_one_since: at(-10 * DAY).toISOString(),
    });
    const diff = resetClockOnDethrone(prev);
    expect(diff.rank_one_since).toBeNull();
    expect(diff.milestone_stars).toBe(3);
    expect(diff.milestone_achieved_at).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for stars when none are earned yet", () => {
    const prev = make({ rank_one_since: at(-DAY / 2).toISOString() });
    const diff = resetClockOnDethrone(prev);
    expect(diff.rank_one_since).toBeNull();
    expect(diff.milestone_stars).toBe(0);
    expect(diff.milestone_achieved_at).toEqual([]);
  });

  it("after a dethrone+re-throne cycle, the clock restarts from 0", () => {
    // Photo held #1 for 2 days, earned 1 star, then got dethroned.
    const earned = decideMilestone(
      make({ rank_one_since: at(-2 * DAY).toISOString() }),
      T0,
    );
    expect(earned.newStars).toBe(1);

    const afterDethrone = resetClockOnDethrone(
      make({
        milestone_stars: earned.newStars,
        milestone_achieved_at: earned.newlyAchievedAt,
        rank_one_since: at(-2 * DAY).toISOString(),
      }),
    );
    expect(afterDethrone.rank_one_since).toBeNull();
    expect(afterDethrone.milestone_stars).toBe(1); // preserved

    // Later, the same photo reclaims #1. Clock starts fresh, stars kept.
    const reclaimedAt = at(10 * DAY);
    const reclaimed = decideMilestone(
      {
        id: "p1",
        milestone_stars: afterDethrone.milestone_stars,
        milestone_achieved_at: afterDethrone.milestone_achieved_at,
        rank_one_since: null,
      },
      reclaimedAt,
    );
    expect(reclaimed.startClock).toBe(true);
    expect(reclaimed.elapsedMs).toBe(0);
    expect(reclaimed.newStars).toBe(1); // not awarded again
    expect(reclaimed.newlyAchievedAt).toEqual([]);
  });
});
