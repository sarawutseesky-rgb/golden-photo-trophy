import { describe, it, expect } from "vitest";
import {
  decideMilestone,
  resetClockOnDethrone,
  type RankedPhoto,
} from "../milestone-rules";

const DAY = 24 * 60 * 60 * 1000;

type SimPhoto = RankedPhoto & { avg_score: number; vote_count: number };

const make = (id: string, avg: number, votes: number): SimPhoto => ({
  id,
  milestone_stars: 0,
  milestone_achieved_at: [],
  rank_one_since: null,
  avg_score: avg,
  vote_count: votes,
});

/**
 * Deterministic ordering used by these tests when avg_score AND vote_count
 * fully tie. The production cron orders by (avg_score DESC, vote_count DESC);
 * when both are equal Postgres returns an arbitrary row. To get a stable
 * outcome in tests we fall back to id ASC as the final tiebreaker.
 */
function pickTop(photos: Record<string, SimPhoto>): string {
  return Object.values(photos)
    .slice()
    .sort((a, b) => {
      if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
      if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
      return a.id.localeCompare(b.id);
    })[0].id;
}

/** One cron tick: optionally force which row is #1 (simulates DB ordering). */
function tick(
  photos: Record<string, SimPhoto>,
  now: Date,
  forceTop?: string,
) {
  const topId = forceTop ?? pickTop(photos);
  for (const id of Object.keys(photos)) {
    if (id === topId) continue;
    const r = resetClockOnDethrone(photos[id]);
    photos[id] = {
      ...photos[id],
      rank_one_since: r.rank_one_since,
      milestone_stars: r.milestone_stars,
      milestone_achieved_at: r.milestone_achieved_at,
    };
  }
  const top = photos[topId];
  const d = decideMilestone(top, now);
  photos[topId] = {
    ...top,
    rank_one_since: d.startClock ? now.toISOString() : top.rank_one_since,
    milestone_stars: d.newStars,
    milestone_achieved_at: [...top.milestone_achieved_at, ...d.newlyAchievedAt],
  };
  return topId;
}

describe("full tie (avg_score AND vote_count equal)", () => {
  it("picks #1 deterministically by id when fully tied", () => {
    const photos = {
      B: make("B", 4.7, 25),
      A: make("A", 4.7, 25), // same avg + same votes
      C: make("C", 4.7, 25),
    };
    const t0 = new Date("2026-01-01T00:00:00Z");
    // pickTop must be stable: A (lowest id) wins
    expect(tick(photos, t0)).toBe("A");
    expect(photos.A.rank_one_since).toBe(t0.toISOString());
    expect(photos.B.rank_one_since).toBeNull();
    expect(photos.C.rank_one_since).toBeNull();

    // Run cron again with the same fully-tied state — winner must NOT flip.
    const t1 = new Date(t0.getTime() + DAY / 10);
    expect(tick(photos, t1)).toBe("A");
    // A's clock kept running from t0, not reset to t1
    expect(photos.A.rank_one_since).toBe(t0.toISOString());
    expect(photos.B.rank_one_since).toBeNull();
    expect(photos.C.rank_one_since).toBeNull();
  });

  it("if the DB swaps #1 under a full tie, the loser's clock resets and stars persist", () => {
    // Simulate the case where Postgres happens to return B then later A
    // even though both rows are perfectly equal.
    const photos = {
      A: make("A", 4.9, 40),
      B: make("B", 4.9, 40),
    };
    let now = new Date("2026-01-01T00:00:00Z");

    // DB returns B as #1 first.
    tick(photos, now, "B");
    expect(photos.B.rank_one_since).toBe(now.toISOString());
    expect(photos.A.rank_one_since).toBeNull();

    // B holds long enough to earn the 1-day star.
    now = new Date(now.getTime() + DAY + 1000);
    tick(photos, now, "B");
    expect(photos.B.milestone_stars).toBe(1);
    expect(photos.B.milestone_achieved_at).toHaveLength(1);

    // Now the DB happens to return A as #1 (still fully tied with B).
    // B's clock MUST reset; B's earned star MUST persist.
    now = new Date(now.getTime() + DAY / 4);
    tick(photos, now, "A");
    expect(photos.B.rank_one_since).toBeNull();
    expect(photos.B.milestone_stars).toBe(1);
    expect(photos.B.milestone_achieved_at).toHaveLength(1);
    expect(photos.A.rank_one_since).toBe(now.toISOString());
    expect(photos.A.milestone_stars).toBe(0);

    // Swap back to B again — A's just-started clock must reset.
    now = new Date(now.getTime() + DAY / 4);
    tick(photos, now, "B");
    expect(photos.A.rank_one_since).toBeNull();
    expect(photos.A.milestone_stars).toBe(0);
    // B's clock restarts cleanly, but keeps its 1 star.
    expect(photos.B.rank_one_since).toBe(now.toISOString());
    expect(photos.B.milestone_stars).toBe(1);
  });

  it("repeated forced swaps under a permanent full tie never duplicate or lose stars", () => {
    const photos = {
      A: make("A", 5.0, 100),
      B: make("B", 5.0, 100),
    };
    let now = new Date("2026-01-01T00:00:00Z");

    // Give each side one star up front.
    tick(photos, now, "A");
    now = new Date(now.getTime() + DAY + 1000);
    tick(photos, now, "A");
    expect(photos.A.milestone_stars).toBe(1);

    now = new Date(now.getTime() + 1000);
    tick(photos, now, "B");
    now = new Date(now.getTime() + DAY + 1000);
    tick(photos, now, "B");
    expect(photos.B.milestone_stars).toBe(1);
    expect(photos.A.milestone_stars).toBe(1);

    // 10 forced flips with the tie intact — neither side gains/loses stars
    // (no holder ever crosses the next 7d threshold in these short ticks).
    const restartTimestamps: string[] = [];
    for (let i = 0; i < 10; i++) {
      now = new Date(now.getTime() + DAY / 5);
      const top = i % 2 === 0 ? "A" : "B";
      tick(photos, now, top);
      restartTimestamps.push(photos[top].rank_one_since!);
      const loser = top === "A" ? "B" : "A";
      expect(photos[loser].rank_one_since).toBeNull();
      expect(photos.A.milestone_stars).toBe(1);
      expect(photos.B.milestone_stars).toBe(1);
      expect(photos.A.milestone_achieved_at).toHaveLength(1);
      expect(photos.B.milestone_achieved_at).toHaveLength(1);
    }
    // Each restart timestamp is unique => clock actually restarted each flip.
    expect(new Set(restartTimestamps).size).toBe(restartTimestamps.length);
  });
});