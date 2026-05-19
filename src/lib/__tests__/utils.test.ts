import { describe, it, expect } from "vitest";
import { normalizeDistribution } from "@/lib/utils";

describe("normalizeDistribution", () => {
  it("returns exact copy for a clean 5-element array", () => {
    const result = normalizeDistribution([1, 2, 3, 4, 5]);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("replaces negative values with 0", () => {
    const result = normalizeDistribution([-1, -5, 3, -2, 0]);
    expect(result).toEqual([0, 0, 3, 0, 0]);
  });

  it("replaces NaN with 0", () => {
    const result = normalizeDistribution([NaN, 2, NaN, 4, NaN]);
    expect(result).toEqual([0, 2, 0, 4, 0]);
  });

  it("replaces Infinity with 0", () => {
    const result = normalizeDistribution([Infinity, 2, -Infinity, 4, 5]);
    expect(result).toEqual([0, 2, 0, 4, 5]);
  });

  it("coerces strings to numbers when possible, otherwise 0", () => {
    const result = normalizeDistribution(["3", "2.7", "abc", "-1", "Infinity"]);
    expect(result).toEqual([3, 2, 0, 0, 0]);
  });

  it("pads with zeros when input is shorter than 5", () => {
    const result = normalizeDistribution([10, 20]);
    expect(result).toEqual([10, 20, 0, 0, 0]);
  });

  it("ignores extra elements beyond index 4", () => {
    const result = normalizeDistribution([1, 2, 3, 4, 5, 99, 88]);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns [0,0,0,0,0] for undefined", () => {
    const result = normalizeDistribution(undefined);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("returns [0,0,0,0,0] for null", () => {
    const result = normalizeDistribution(null);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("returns [0,0,0,0,0] for non-array objects", () => {
    const result = normalizeDistribution({ a: 1, b: 2 });
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("floors decimal values to integers at every position", () => {
    const result = normalizeDistribution([1.9, 2.1, 3.5, 4.99, 0.1]);
    expect(result).toEqual([1, 2, 3, 4, 0]);
    // verify each position individually
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
    expect(result[3]).toBe(4);
    expect(result[4]).toBe(0);
  });

  it("floors large decimals at every position", () => {
    const result = normalizeDistribution([99.9, 88.1, 77.5, 66.99, 55.01]);
    expect(result).toEqual([99, 88, 77, 66, 55]);
    expect(result[0]).toBe(99);
    expect(result[1]).toBe(88);
    expect(result[2]).toBe(77);
    expect(result[3]).toBe(66);
    expect(result[4]).toBe(55);
  });

  it("floors negative decimal toward zero (becomes 0)", () => {
    const result = normalizeDistribution([-1.1, -2.9, -3.5, -0.1, -99.9]);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("floors string decimals correctly", () => {
    const result = normalizeDistribution(["1.9", "2.1", "3.5", "4.99", "0.1"]);
    expect(result).toEqual([1, 2, 3, 4, 0]);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
    expect(result[3]).toBe(4);
    expect(result[4]).toBe(0);
  });

  it("handles a mixed bag of bad values correctly", () => {
    const result = normalizeDistribution([
      -1,
      NaN,
      Infinity,
      "hello",
      7.8,
    ]);
    expect(result).toEqual([0, 0, 0, 0, 7]);
  });

  it("always returns exactly 5 elements", () => {
    const short = normalizeDistribution([]);
    const exact = normalizeDistribution([1, 2, 3, 4, 5]);
    const long = normalizeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(short).toHaveLength(5);
    expect(exact).toHaveLength(5);
    expect(long).toHaveLength(5);
  });

  it("never returns negative, NaN, or Infinity", () => {
    const result = normalizeDistribution([-5, NaN, Infinity, "", null as unknown as number]);
    result.forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });
});
