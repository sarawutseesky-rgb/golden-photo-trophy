import { describe, it, expect } from "vitest";
import { computeDistribution } from "@/lib/votes.helpers";
import { normalizeDistribution } from "@/lib/utils";

describe("computeDistribution — buckets votes into 1★…5★ slots", () => {
  it("returns [0,0,0,0,0] when there are no votes", () => {
    expect(computeDistribution([])).toEqual([0, 0, 0, 0, 0]);
  });

  it("counts a single vote into the correct slot", () => {
    expect(computeDistribution([1])).toEqual([1, 0, 0, 0, 0]);
    expect(computeDistribution([3])).toEqual([0, 0, 1, 0, 0]);
    expect(computeDistribution([5])).toEqual([0, 0, 0, 0, 1]);
  });

  it("aggregates multiple votes per slot", () => {
    // 3× 5★, 2× 4★, 1× 1★
    expect(computeDistribution([5, 5, 5, 4, 4, 1])).toEqual([1, 0, 0, 2, 3]);
  });

  it("matches the inline loop used in getPhoto for a mixed dataset", () => {
    const votes = [5, 4, 5, 3, 2, 5, 4, 1, 3, 5];
    const inline = [0, 0, 0, 0, 0];
    votes.forEach((s) => {
      if (s >= 1 && s <= 5) inline[s - 1]++;
    });
    expect(computeDistribution(votes)).toEqual(inline);
    // sanity: 1× 1★, 1× 2★, 2× 3★, 2× 4★, 4× 5★
    expect(computeDistribution(votes)).toEqual([1, 1, 2, 2, 4]);
  });

  it("ignores scores outside 1–5 instead of crashing", () => {
    expect(computeDistribution([0, 6, -1, 99, 3])).toEqual([0, 0, 1, 0, 0]);
  });

  it("ignores NaN / Infinity and truncates fractional scores", () => {
    expect(computeDistribution([NaN, Infinity, -Infinity])).toEqual([0, 0, 0, 0, 0]);
    // 4.7 -> 4, 2.2 -> 2
    expect(computeDistribution([4.7, 2.2])).toEqual([0, 1, 0, 1, 0]);
  });

  it("sum of all buckets equals the number of valid votes", () => {
    const votes = [1, 2, 3, 4, 5, 5, 5, 2, 2, 4];
    const dist = computeDistribution(votes);
    const total = dist.reduce((a, b) => a + b, 0);
    expect(total).toBe(votes.length);
  });
});

describe("normalizeDistribution — defensive sanitization for the UI", () => {
  it("returns 5 zeros for a missing / non-array payload", () => {
    expect(normalizeDistribution(undefined)).toEqual([0, 0, 0, 0, 0]);
    expect(normalizeDistribution(null)).toEqual([0, 0, 0, 0, 0]);
    expect(normalizeDistribution("nope")).toEqual([0, 0, 0, 0, 0]);
  });

  it("pads a short array to length 5", () => {
    expect(normalizeDistribution([2, 3])).toEqual([2, 3, 0, 0, 0]);
  });

  it("clamps negative / NaN / Infinity entries to 0 and floors floats", () => {
    expect(normalizeDistribution([-1, NaN, Infinity, 2.9, 4])).toEqual([0, 0, 0, 2, 4]);
  });

  it("passes through a valid 5-bucket distribution unchanged", () => {
    expect(normalizeDistribution([1, 1, 2, 2, 4])).toEqual([1, 1, 2, 2, 4]);
  });
});

describe("end-to-end: vote distribution after multiple users vote", () => {
  it("reflects each cast vote in the correct bucket", () => {
    // Simulate the votes table: each row is one user's score for the photo
    const voteRows = [
      { voter_id: "u1", score: 5 },
      { voter_id: "u2", score: 4 },
      { voter_id: "u3", score: 5 },
      { voter_id: "u4", score: 3 },
      { voter_id: "u5", score: 5 },
      { voter_id: "u6", score: 2 },
    ];
    const dist = computeDistribution(voteRows.map((r) => r.score));
    // 0× 1★, 1× 2★, 1× 3★, 1× 4★, 3× 5★
    expect(dist).toEqual([0, 1, 1, 1, 3]);
    expect(dist.reduce((a, b) => a + b, 0)).toBe(voteRows.length);
  });
});