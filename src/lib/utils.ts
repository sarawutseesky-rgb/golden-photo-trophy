import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize a vote-distribution array so it is always:
 * - exactly 5 non-negative integers (for scores 1-5)
 * - never NaN, Infinity, or negative
 * This prevents the bar chart from rendering incorrectly when server data is malformed.
 */
export function normalizeDistribution(input: unknown): number[] {
  const base = Array.isArray(input) ? input : [];
  return [0, 1, 2, 3, 4].map((i) => {
    const raw = Number(base[i] ?? 0);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.floor(raw);
  });
}

