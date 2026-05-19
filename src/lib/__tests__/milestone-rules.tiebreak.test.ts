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
 * Pick the current #1 using the same ordering as the cron route:
 * avg_score DESC, then vote_count DESC as tiebreaker. id is the final
 * deterministic tiebreaker for stable tests.
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

function tick(photos: Record<string, SimPhoto>, now: Date) {
  const topId = pickTop(photos);
  for (const id of Object.keys(photos)) {
    if (id === topId) continue;
    const reset = resetClockOnDethrone(photos[id]);
    photos[id] = {
      ...photos[id],
      rank_one_since: reset.rank_one_since,
      milestone_stars: reset.milestone_stars,
      milestone_achieved_at: reset.milestone_achieved_at,
    };
  }
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
  return topId;
}

describe("tiebreaker swaps (equal avg_score, vote_count decides #1)", () => {
  it("swaps #1 to the photo with more votes and resets the loser's clock", () => {
    // Both 4.8, A has more votes -> A is #1
    const photos = {
      A: make("A", 4.8, 20),
      B: make("B", 4.8, 15),
    };
    const t0 = new Date("2026-01-01T00:00:00Z");
    expect(tick(photos, t0)).toBe("A");
    expect(photos.A.rank_one_since).toBe(t0.toISOString());
    expect(photos.B.rank_one_since).toBeNull();

    // B gets enough new votes to overtake A on the tiebreaker
    photos.B = { ...photos.B, vote_count: 25 };
    const t1 = new Date(t0.getTime() + DAY / 4);
    expect(tick(photos, t1)).toBe("B");
    expect(photos.A.rank_one_since).toBeNull();
    expect(photos.B.rank_one_since).toBe(t1.toISOString());
  });

  it("does not change #1 when avg ties but vote_count order stays the same", () => {
    const photos = {
      A: make("A", 4.5, 30),
      B: make("B", 4.5, 20),
    };
    const t0 = new Date("2026-01-01T00:00:00Z");
    expect(tick(photos, t0)).toBe("A");
    const sinceA = photos.A.rank_one_since;

    // Both gain votes but A still leads
    photos.A = { ...photos.A, vote_count: 35 };
    photos.B = { ...photos.B, vote_count: 25 };
    const t1 = new Date(t0.getTime() + DAY / 6);
    expect(tick(photos, t1)).toBe("A");
    // A's clock must NOT reset — it stayed #1
    expect(photos.A.rank_one_since).toBe(sinceA);
    expect(photos.B.rank_one_since).toBeNull();
  });

  it("preserves stars across repeated tiebreaker-driven swaps", () => {
    const photos = {
      A: make("A", 4.9, 50),
      B: make("B", 4.9, 40),
    };
    let now = new Date("2026-01-01T00:00:00Z");

    // A holds #1 for >1 day -> earns 1st star
    tick(photos, now);
    now = new Date(now.getTime() + DAY + 1000);
    tick(photos, now);
    expect(photos.A.milestone_stars).toBe(1);

    const starsA = photos.A.milestone_achieved_at.slice();
    const startsA: string[] = [photos.A.rank_one_since!];

    // 4 swap cycles driven purely by vote_count tiebreaker (avg stays equal)
    for (let i = 0; i < 4; i++) {
      // B overtakes via more votes
      photos.B = { ...photos.B, vote_count: photos.A.vote_count + 5 };
      now = new Date(now.getTime() + DAY / 3);
      expect(tick(photos, now)).toBe("B");
      expect(photos.A.rank_one_since).toBeNull();
      // A keeps its star
      expect(photos.A.milestone_stars).toBe(1);
      expect(photos.A.milestone_achieved_at).toEqual(starsA);

      // A reclaims by gaining more votes
      photos.A = { ...photos.A, vote_count: photos.B.vote_count + 5 };
      now = new Date(now.getTime() + DAY / 3);
      expect(tick(photos, now)).toBe("A");
      expect(photos.B.rank_one_since).toBeNull();
      expect(photos.A.rank_one_since).toBe(now.toISOString());
      expect(photos.A.milestone_stars).toBe(1);
      startsA.push(photos.A.rank_one_since!);
    }

    // Every re-throne restarted the clock with a unique timestamp.
    expect(new Set(startsA).size).toBe(startsA.length);
    // B never crossed any threshold during its brief #1 stints.
    expect(photos.B.milestone_stars).toBe(0);
  });
});