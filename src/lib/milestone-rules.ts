// Pure, side-effect-free milestone rules. Used by the cron route and
// covered by unit tests in `__tests__/milestone-rules.test.ts`.

export const THRESHOLDS_MS = [1, 7, 30, 90, 180].map(
  (d) => d * 24 * 60 * 60 * 1000,
);

export type RankedPhoto = {
  id: string;
  milestone_stars: number;
  milestone_achieved_at: string[];
  rank_one_since: string | null;
};

export type MilestoneDecision = {
  /** True when the photo just became #1 and the clock should start at `now`. */
  startClock: boolean;
  /** Total stars after applying any newly-achieved thresholds. */
  newStars: number;
  /** ISO timestamps appended to `milestone_achieved_at` (one per new star). */
  newlyAchievedAt: string[];
  /** Milliseconds the photo has been at #1 (0 if clock just started). */
  elapsedMs: number;
};

/**
 * Decide what to update for the current #1 photo given the cron tick time.
 *
 * Rules:
 * - Starts the clock at `now` when the photo had no `rank_one_since`.
 * - Awards each next milestone star as soon as elapsed time crosses its
 *   threshold (1 / 7 / 30 / 90 / 180 days).
 * - Never removes earned stars or rewrites previously achieved timestamps.
 */
export function decideMilestone(
  top: RankedPhoto,
  now: Date,
): MilestoneDecision {
  const startClock = !top.rank_one_since;
  const since = startClock ? now : new Date(top.rank_one_since as string);
  const elapsedMs = startClock ? 0 : now.getTime() - since.getTime();

  let stars = top.milestone_stars ?? 0;
  const newlyAchievedAt: string[] = [];
  for (let i = stars; i < THRESHOLDS_MS.length; i++) {
    if (elapsedMs >= THRESHOLDS_MS[i]) {
      stars = i + 1;
      newlyAchievedAt.push(now.toISOString());
    } else {
      break;
    }
  }

  return { startClock, newStars: stars, newlyAchievedAt, elapsedMs };
}

/**
 * Diff applied to a photo that lost #1 (or to all photos when no qualified
 * #1 exists). The clock is cleared but earned stars are preserved forever.
 */
export function resetClockOnDethrone(prev: RankedPhoto) {
  return {
    id: prev.id,
    rank_one_since: null,
    milestone_stars: prev.milestone_stars,
    milestone_achieved_at: prev.milestone_achieved_at,
  };
}
