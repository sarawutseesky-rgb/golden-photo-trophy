// Pure, side-effect-free milestone rules.
//
// New scheme (replaces the old "consecutive #1" model):
//   • A photo is evaluated at each tier checkpoint based on its AGE.
//   • Star tiers: 1★ at 24h, 2★ at 168h (7d), 3★ at 720h (30d),
//                 4★ at 2160h (90d), 5★ at 4320h (180d).
//   • At each checkpoint, the photo earns that tier if its total vote
//     score (sum of all vote scores) is >= the total score of EVERY
//     photo uploaded AFTER it. Ties are OK (must be strictly greater
//     to block the tier).
//   • Stars are cumulative — `milestone_stars` = highest tier achieved.
//   • Earned stars are PERMANENT. They never get removed.

const HOUR_MS = 60 * 60 * 1000;

/** Star-tier age thresholds, in hours, indexed by (tier-1). */
export const THRESHOLDS_HOURS = [24, 168, 720, 2160, 4320] as const;

/** Same thresholds in milliseconds for fast comparisons. */
export const THRESHOLDS_MS = THRESHOLDS_HOURS.map((h) => h * HOUR_MS);

export type PhotoForMilestone = {
  id: string;
  created_at: string;
  /** Sum of all vote scores. Computed as avg_score * vote_count. */
  total_score: number;
  milestone_stars: number;
  milestone_achieved_at: string[];
};

export type MilestoneDecision = {
  /** New total star count (>= the photo's current count). */
  newStars: number;
  /** Highest tier the photo qualifies for right now (0..5). */
  qualifiedTier: number;
  /** Whether the photo is currently un-overtaken by any later upload. */
  beatsLater: boolean;
  /** Age of the photo at evaluation time, in ms. */
  ageMs: number;
  /** ISO timestamps to append to `milestone_achieved_at` (one per new star). */
  newlyAchievedAt: string[];
};

/**
 * Returns the highest tier (1..5) the photo currently qualifies for,
 * or 0 if it qualifies for none.
 *
 * - `ageMs` must be >= the tier's threshold.
 * - `beatsLater` must be true (no later-uploaded photo outscores it).
 */
export function maxQualifiedTier(ageMs: number, beatsLater: boolean): number {
  if (!beatsLater) return 0;
  let tier = 0;
  for (let i = 0; i < THRESHOLDS_MS.length; i++) {
    if (ageMs >= THRESHOLDS_MS[i]) tier = i + 1;
    else break;
  }
  return tier;
}

/**
 * Decide the new milestone state for a single photo.
 *
 * @param photo            Current row state.
 * @param maxLaterScore    Highest `total_score` among photos uploaded AFTER
 *                         this one. Pass `-Infinity` (or 0 with no later
 *                         photos) when no later photos exist.
 * @param now              Evaluation time.
 */
export function decideMilestone(
  photo: PhotoForMilestone,
  maxLaterScore: number,
  now: Date,
): MilestoneDecision {
  const ageMs = now.getTime() - new Date(photo.created_at).getTime();
  // "ไม่มีภาพไหนที่อัปโหลดภายหลังคะแนนมากกว่า" — strictly greater blocks.
  const beatsLater = photo.total_score >= maxLaterScore;
  const qualifiedTier = maxQualifiedTier(ageMs, beatsLater);

  const current = photo.milestone_stars ?? 0;
  const newStars = Math.max(current, qualifiedTier);
  const nowIso = now.toISOString();
  const newlyAchievedAt: string[] = [];
  for (let i = current; i < newStars; i++) newlyAchievedAt.push(nowIso);

  return { newStars, qualifiedTier, beatsLater, ageMs, newlyAchievedAt };
}

/**
 * Given a list of photos sorted by created_at ASC, return a map from
 * photo id -> the max `total_score` among all photos uploaded AFTER it.
 * O(n).
 */
export function buildMaxLaterScoreMap(
  photosOldestFirst: Pick<PhotoForMilestone, "id" | "total_score">[],
): Map<string, number> {
  const map = new Map<string, number>();
  let maxLater = -Infinity;
  for (let i = photosOldestFirst.length - 1; i >= 0; i--) {
    const p = photosOldestFirst[i];
    map.set(p.id, maxLater);
    if (p.total_score > maxLater) maxLater = p.total_score;
  }
  return map;
}
