import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { VoteDistribution } from "@/components/app/VoteDistribution";
import { computeDistribution } from "@/lib/votes.helpers";

/**
 * End-to-end-ish UI test: simulate several users casting votes, feed the
 * resulting distribution into <VoteDistribution />, and assert the rendered
 * bars + counts match what the user would see on the photo detail page.
 *
 * (Full browser-level E2E with Playwright isn't wired up in this project;
 * this RTL test exercises the same component the route renders, with no
 * mocking of the distribution math.)
 */

function countFor(star: 1 | 2 | 3 | 4 | 5): number {
  return Number(
    screen.getByTestId(`vote-dist-count-${star}`).textContent ?? "0",
  );
}

function percentFor(star: 1 | 2 | 3 | 4 | 5): number {
  return Number(
    screen.getByTestId(`vote-dist-bar-${star}`).getAttribute("data-percent") ?? "0",
  );
}

afterEach(() => cleanup());

describe("<VoteDistribution /> — UI reflects multi-user voting", () => {
  it("renders all five rows with zero counts when no one has voted", () => {
    render(<VoteDistribution distribution={[0, 0, 0, 0, 0]} />);
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(countFor(s)).toBe(0);
      // With no votes, total fallback (1) means every bar renders at 0%
      expect(percentFor(s)).toBe(0);
    }
    // 5 rows present, ordered 5★ -> 1★ visually
    const list = screen.getByTestId("vote-distribution");
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });

  it("reflects the distribution after 6 users vote (3×5★, 1×4★, 1×3★, 1×2★)", () => {
    const userVotes = [5, 5, 5, 4, 3, 2];
    const dist = computeDistribution(userVotes);
    render(<VoteDistribution distribution={dist} />);

    expect(countFor(5)).toBe(3);
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(countFor(2)).toBe(1);
    expect(countFor(1)).toBe(0);

    // percentages relative to total = 6
    expect(percentFor(5)).toBeCloseTo(50, 1);     // 3/6
    expect(percentFor(4)).toBeCloseTo(16.67, 1);  // 1/6
    expect(percentFor(2)).toBeCloseTo(16.67, 1);
    expect(percentFor(1)).toBe(0);
  });

  it("aria-label on each row announces star count and vote count", () => {
    const dist = computeDistribution([5, 5, 4, 1]);
    render(<VoteDistribution distribution={dist} />);
    expect(screen.getByTestId("vote-dist-row-5").getAttribute("aria-label")).toBe("5 ดาว: 2 โหวต");
    expect(screen.getByTestId("vote-dist-row-4").getAttribute("aria-label")).toBe("4 ดาว: 1 โหวต");
    expect(screen.getByTestId("vote-dist-row-1").getAttribute("aria-label")).toBe("1 ดาว: 1 โหวต");
    expect(screen.getByTestId("vote-dist-row-3").getAttribute("aria-label")).toBe("3 ดาว: 0 โหวต");
  });

  it("re-renders correctly when a new vote arrives (optimistic update)", () => {
    const initialVotes = [5, 4, 3];
    const { rerender } = render(
      <VoteDistribution distribution={computeDistribution(initialVotes)} />,
    );
    expect(countFor(5)).toBe(1);
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(percentFor(5)).toBeCloseTo(33.33, 1);

    // A new user votes 5★ -> distribution updates
    const nextVotes = [...initialVotes, 5];
    rerender(
      <VoteDistribution distribution={computeDistribution(nextVotes)} />,
    );
    expect(countFor(5)).toBe(2);
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(percentFor(5)).toBeCloseTo(50, 1);    // 2/4
    expect(percentFor(4)).toBeCloseTo(25, 1);    // 1/4
    expect(percentFor(3)).toBeCloseTo(25, 1);    // 1/4
  });

  it("handles a malformed distribution without crashing (defensive)", () => {
    render(<VoteDistribution distribution={"oops" as unknown as number[]} />);
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(countFor(s)).toBe(0);
    }
  });

  it("sum of rendered counts equals total user votes", () => {
    const userVotes = [1, 2, 3, 4, 5, 5, 4, 3, 5, 2, 1, 5];
    render(
      <VoteDistribution distribution={computeDistribution(userVotes)} />,
    );
    const total =
      countFor(1) + countFor(2) + countFor(3) + countFor(4) + countFor(5);
    expect(total).toBe(userVotes.length);
  });
});