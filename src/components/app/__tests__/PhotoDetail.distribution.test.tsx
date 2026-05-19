import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { VoteDistribution } from "@/components/app/VoteDistribution";
import { computeDistribution } from "@/lib/votes.helpers";

/**
 * Integration test for the photo detail page's vote distribution chart.
 *
 * We mock the `getPhoto` server fn so we can control the data the route
 * loader would receive, then render the same query-driven flow the route
 * uses (`useQuery` -> `<VoteDistribution distribution={data.distribution} />`)
 * and assert the bars update when the server returns a fresh distribution.
 *
 * This avoids spinning up SSR / Supabase but exercises the real data path
 * the user sees: server response -> Query cache -> UI render.
 */

vi.mock("@/lib/photos.functions", () => ({
  getPhoto: vi.fn(),
}));

import { getPhoto } from "@/lib/photos.functions";
const mockedGetPhoto = getPhoto as unknown as ReturnType<typeof vi.fn>;

type PhotoPayload = {
  photo: { id: string; vote_count: number; avg_score: number };
  distribution: number[];
  comments: unknown[];
};

function makePayload(votes: number[]): PhotoPayload {
  const dist = computeDistribution(votes);
  const count = votes.length;
  const avg =
    count > 0 ? Math.round((votes.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0;
  return {
    photo: { id: "photo-1", vote_count: count, avg_score: avg },
    distribution: dist,
    comments: [],
  };
}

function PhotoDetailHarness({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["photo", id],
    queryFn: () => (getPhoto as unknown as (a: { data: { id: string } }) => Promise<PhotoPayload>)({ data: { id } }),
  });
  if (isLoading || !data) return <div>loading</div>;
  return (
    <div>
      <div data-testid="vote-count">{data.photo.vote_count}</div>
      <div data-testid="avg-score">{data.photo.avg_score}</div>
      <VoteDistribution distribution={data.distribution} />
    </div>
  );
}

function renderWithClient(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <PhotoDetailHarness id={id} />
    </QueryClientProvider>,
  );
  return { queryClient, ...utils };
}

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

afterEach(() => {
  cleanup();
  mockedGetPhoto.mockReset();
});

describe("Photo detail page — distribution chart loads from real query data", () => {
  it("renders the chart from data returned by getPhoto (3 users voted)", async () => {
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 4, 3]));
    renderWithClient("photo-1");

    await waitFor(() =>
      expect(screen.getByTestId("vote-distribution")).toBeTruthy(),
    );

    expect(countFor(5)).toBe(1);
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(countFor(2)).toBe(0);
    expect(countFor(1)).toBe(0);

    expect(screen.getByTestId("vote-count").textContent).toBe("3");
    expect(screen.getByTestId("avg-score").textContent).toBe("4");
    expect(mockedGetPhoto).toHaveBeenCalledWith({ data: { id: "photo-1" } });
  });

  it("aggregates 10 votes correctly across all five buckets", async () => {
    const votes = [5, 5, 5, 5, 4, 4, 3, 3, 2, 1];
    mockedGetPhoto.mockResolvedValueOnce(makePayload(votes));
    renderWithClient("photo-1");

    await waitFor(() =>
      expect(screen.getByTestId("vote-distribution")).toBeTruthy(),
    );

    expect(countFor(5)).toBe(4);
    expect(countFor(4)).toBe(2);
    expect(countFor(3)).toBe(2);
    expect(countFor(2)).toBe(1);
    expect(countFor(1)).toBe(1);

    // percentages: 40 / 20 / 20 / 10 / 10
    expect(percentFor(5)).toBeCloseTo(40, 1);
    expect(percentFor(4)).toBeCloseTo(20, 1);
    expect(percentFor(2)).toBeCloseTo(10, 1);
    expect(percentFor(1)).toBeCloseTo(10, 1);
  });

  it("updates the chart when a refetch returns a new distribution (new vote arrived)", async () => {
    // Initial load: 3 votes
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 4, 3]));
    // After refetch: a 4th user voted 5★
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 4, 3, 5]));

    const { queryClient } = renderWithClient("photo-1");

    await waitFor(() => expect(countFor(5)).toBe(1));
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(screen.getByTestId("vote-count").textContent).toBe("3");

    // Trigger a refetch as if invalidateQueries fired after castVote
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["photo", "photo-1"] });
    });

    await waitFor(() => expect(countFor(5)).toBe(2));
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(screen.getByTestId("vote-count").textContent).toBe("4");
    // avg: (5+4+3+5)/4 = 4.25
    expect(screen.getByTestId("avg-score").textContent).toBe("4.25");
    expect(mockedGetPhoto).toHaveBeenCalledTimes(2);
  });

  it("survives a malformed distribution from the server without crashing", async () => {
    mockedGetPhoto.mockResolvedValueOnce({
      photo: { id: "photo-1", vote_count: 0, avg_score: 0 },
      distribution: "broken" as unknown as number[],
      comments: [],
    });
    renderWithClient("photo-1");

    await waitFor(() =>
      expect(screen.getByTestId("vote-distribution")).toBeTruthy(),
    );
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(countFor(s)).toBe(0);
    }
  });
});