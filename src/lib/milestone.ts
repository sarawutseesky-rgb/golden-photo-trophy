// UI helper for showing milestone progress.
//
// In the new scheme stars are awarded based on the photo's AGE (24h, 168h,
// 720h, 2160h, 4320h) provided no later upload has outscored it. The clock
// is simply "time since upload" — there is no "holding #1" countdown.

export const THRESHOLDS_HOURS = [24, 168, 720, 2160, 4320] as const;
export const THRESHOLDS_DAYS = THRESHOLDS_HOURS.map((h) => h / 24);

export type MilestoneProgress = {
  stars: number;
  /** Hours threshold of the next tier (e.g. 168). */
  nextHours: number;
  /** Days threshold of the next tier (e.g. 7). */
  nextDays: number;
  /** Hours elapsed since upload. */
  elapsedHours: number;
  /** Days elapsed since upload. */
  elapsedDays: number;
  /** Hours remaining until the next tier (0 if already past). */
  remainingHours: number;
  /** Fraction of the next tier reached (0..1). */
  fraction: number;
};

export function nextMilestoneProgress(
  milestoneStars: number,
  createdAt: string | null | undefined,
): MilestoneProgress | null {
  if (milestoneStars >= 5) return null;
  if (!createdAt) return null;

  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const elapsedHours = Math.max(0, elapsedMs / (60 * 60 * 1000));
  const elapsedDays = elapsedHours / 24;

  const nextHours = THRESHOLDS_HOURS[milestoneStars];
  const nextDays = nextHours / 24;
  const remainingHours = Math.max(0, nextHours - elapsedHours);
  const fraction = Math.min(1, elapsedHours / nextHours);

  return {
    stars: milestoneStars,
    nextHours,
    nextDays,
    elapsedHours,
    elapsedDays,
    remainingHours,
    fraction,
  };
}
