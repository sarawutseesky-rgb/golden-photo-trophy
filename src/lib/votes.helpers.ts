/**
 * Pure helpers extracted from the votes server functions so the
 * voting business rules can be unit-tested without a live DB.
 */

/** Postgres unique_violation error code, raised when a user tries to
 *  insert a second `(photo_id, voter_id)` row into `public.votes`. */
export const PG_UNIQUE_VIOLATION = "23505";

/** True when the supabase-js error represents "this user already voted on
 *  this photo" (i.e. the unique (photo_id, voter_id) constraint fired). */
export function isDuplicateVoteError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === PG_UNIQUE_VIOLATION;
}

/** Mirror of the `recalc_photo_aggregates` Postgres trigger:
 *   avg_score = round(avg(score), 2), 0 when no votes
 *   vote_count = number of rows in `votes` for the photo
 *  Kept in sync so the client can verify/compute expected values. */
export function computeAggregates(
  scores: ReadonlyArray<number>,
): { avg_score: number; vote_count: number } {
  const vote_count = scores.length;
  if (vote_count === 0) return { avg_score: 0, vote_count: 0 };
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = sum / vote_count;
  // round to 2 decimals, matching `round(avg(score)::numeric, 2)`
  const avg_score = Math.round(avg * 100) / 100;
  return { avg_score, vote_count };
}