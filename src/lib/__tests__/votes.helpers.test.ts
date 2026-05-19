import { describe, it, expect } from "vitest";
import {
  PG_UNIQUE_VIOLATION,
  computeAggregates,
  isDuplicateVoteError,
} from "@/lib/votes.helpers";

describe("isDuplicateVoteError — one-vote-per-user rule", () => {
  it("flags Postgres unique_violation (23505) as a duplicate vote", () => {
    const err = {
      code: PG_UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint "votes_photo_id_voter_id_key"',
    };
    expect(isDuplicateVoteError(err)).toBe(true);
  });

  it("does not flag unrelated supabase errors as duplicates", () => {
    expect(isDuplicateVoteError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isDuplicateVoteError({ code: "23514", message: "check constraint" })).toBe(false);
    expect(isDuplicateVoteError({ message: "boom" })).toBe(false);
  });

  it("handles null / undefined / non-object safely", () => {
    expect(isDuplicateVoteError(null)).toBe(false);
    expect(isDuplicateVoteError(undefined)).toBe(false);
    expect(isDuplicateVoteError("23505")).toBe(false);
    expect(isDuplicateVoteError(23505)).toBe(false);
  });
});

describe("computeAggregates — mirrors recalc_photo_aggregates trigger", () => {
  it("returns zeros when there are no votes", () => {
    expect(computeAggregates([])).toEqual({ avg_score: 0, vote_count: 0 });
  });

  it("returns the score itself for a single vote", () => {
    expect(computeAggregates([5])).toEqual({ avg_score: 5, vote_count: 1 });
    expect(computeAggregates([3])).toEqual({ avg_score: 3, vote_count: 1 });
  });

  it("computes the average across multiple votes", () => {
    expect(computeAggregates([5, 4, 3, 2, 1])).toEqual({ avg_score: 3, vote_count: 5 });
    expect(computeAggregates([5, 5, 5, 5])).toEqual({ avg_score: 5, vote_count: 4 });
  });

  it("rounds the average to 2 decimal places (matching numeric(.,2))", () => {
    // 5 + 4 + 4 = 13 / 3 = 4.3333... -> 4.33
    expect(computeAggregates([5, 4, 4])).toEqual({ avg_score: 4.33, vote_count: 3 });
    // 5 + 4 = 9 / 2 = 4.5
    expect(computeAggregates([5, 4])).toEqual({ avg_score: 4.5, vote_count: 2 });
    // 1 + 2 = 3 / 2 = 1.5
    expect(computeAggregates([1, 2])).toEqual({ avg_score: 1.5, vote_count: 2 });
  });

  it("treats each vote as one row — vote_count equals scores.length", () => {
    const scores = Array.from({ length: 17 }, (_, i) => ((i % 5) + 1));
    const { vote_count } = computeAggregates(scores);
    expect(vote_count).toBe(17);
  });
});

describe("voting flow contract (integration intent)", () => {
  // These tests document and verify the invariants enforced by the DB:
  //   * UNIQUE (photo_id, voter_id) on public.votes => one vote per (user, photo)
  //   * recalc_photo_aggregates trigger keeps photos.avg_score / vote_count in sync
  // The real enforcement lives in Postgres; here we verify the client-side
  // contract that castVote relies on to translate the constraint into UX.

  it("simulates: first vote succeeds, second vote by same user is rejected", () => {
    // Simulated supabase insert results
    const firstInsert = { error: null };
    const secondInsert = {
      error: { code: PG_UNIQUE_VIOLATION, message: "duplicate key value" },
    };

    expect(firstInsert.error).toBeNull();
    expect(isDuplicateVoteError(secondInsert.error)).toBe(true);
  });

  it("simulates: aggregates after 3 sequential votes from different users", () => {
    const votes: number[] = [];
    votes.push(5); // user A
    expect(computeAggregates(votes)).toEqual({ avg_score: 5, vote_count: 1 });
    votes.push(3); // user B
    expect(computeAggregates(votes)).toEqual({ avg_score: 4, vote_count: 2 });
    votes.push(4); // user C
    expect(computeAggregates(votes)).toEqual({ avg_score: 4, vote_count: 3 });
  });
});