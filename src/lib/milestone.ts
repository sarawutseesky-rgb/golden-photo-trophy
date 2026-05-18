export const THRESHOLDS_DAYS = [1, 7, 30, 90, 180];

export function nextMilestoneProgress(milestoneStars: number, rankOneSince: string | null) {
  if (milestoneStars >= 5) return null;
  if (!rankOneSince)
    return { stars: milestoneStars, nextDays: THRESHOLDS_DAYS[milestoneStars], elapsedDays: 0, holding: false };
  const elapsedMs = Date.now() - new Date(rankOneSince).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const nextDays = THRESHOLDS_DAYS[milestoneStars];
  return { stars: milestoneStars, nextDays, elapsedDays, holding: true };
}