import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { VoteDistribution } from "@/components/app/VoteDistribution";
import {
  applyOptimisticVote,
  computeDistribution,
  type PhotoDetailPayload,
} from "@/lib/votes.helpers";

/**
 * E2E-style test for the vote click flow on the photo detail page.
 *
 * We re-create the exact data path the route uses:
 *   1. `useQuery(['photo', id], getPhoto)` loads the payload
 *   2. on vote click, the cache is patched optimistically via
 *      `applyOptimisticVote` and the server fn `castVote` is awaited
 *   3. on success, `invalidateQueries` triggers a refetch with the
 *      authoritative server numbers
 *
 * Both `getPhoto` and `castVote` are mocked so we can drive the timeline
 * deterministically and assert what the user sees immediately after click
 * AND after the refetch completes.
 */

vi.mock("@/lib/photos.functions", () => ({ getPhoto: vi.fn() }));
vi.mock("@/lib/votes.functions", () => ({ castVote: vi.fn() }));

import { getPhoto } from "@/lib/photos.functions";
import { castVote } from "@/lib/votes.functions";
const mockedGetPhoto = getPhoto as unknown as ReturnType<typeof vi.fn>;
const mockedCastVote = castVote as unknown as ReturnType<typeof vi.fn>;

function makePayload(votes: number[]): PhotoDetailPayload {
  const dist = computeDistribution(votes);
  const count = votes.length;
  const avg =
    count > 0 ? Math.round((votes.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0;
  return {
    photo: { id: "photo-1", user_id: "owner-1", vote_count: count, avg_score: avg },
    distribution: dist,
    comments: [],
  };
}

function VoteHarness({ id }: { id: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["photo", id],
    queryFn: () =>
      (getPhoto as unknown as (a: { data: { id: string } }) => Promise<PhotoDetailPayload>)({
        data: { id },
      }),
  });

  if (!data) return <div>loading</div>;

  async function handleVote(score: number) {
    if (busy) return;
    setBusy(true);
    const photoKey = ["photo", id];
    const prev = qc.getQueryData<PhotoDetailPayload>(photoKey);
    if (prev) {
      qc.setQueryData(photoKey, applyOptimisticVote(prev, score, null));
    }
    try {
      await (castVote as unknown as (a: { data: { photo_id: string; score: number } }) => Promise<unknown>)({
        data: { photo_id: id, score },
      });
      await qc.invalidateQueries({ queryKey: photoKey });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div data-testid="vote-count">{data.photo.vote_count}</div>
      <div data-testid="avg-score">{data.photo.avg_score}</div>
      <VoteDistribution distribution={data.distribution} />
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} data-testid={`vote-${s}`} onClick={() => handleVote(s)}>
          {s}★
        </button>
      ))}
    </div>
  );
}

function renderWithClient(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <VoteHarness id={id} />
    </QueryClientProvider>,
  );
  return { queryClient, ...utils };
}

const countFor = (s: 1 | 2 | 3 | 4 | 5) =>
  Number(screen.getByTestId(`vote-dist-count-${s}`).textContent ?? "0");

afterEach(() => {
  cleanup();
  mockedGetPhoto.mockReset();
  mockedCastVote.mockReset();
});

describe("Photo detail — vote click updates chart & avg immediately, then reconciles", () => {
  it("optimistic update: chart and avg change as soon as the user clicks", async () => {
    // Initial server state: 3 votes [5,4,3] -> avg=4, count=3
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 4, 3]));
    // Hold castVote open so we can observe the OPTIMISTIC state only
    let resolveVote!: () => void;
    mockedCastVote.mockReturnValueOnce(
      new Promise<void>((res) => {
        resolveVote = res;
      }),
    );

    renderWithClient("photo-1");
    await waitFor(() => expect(screen.getByTestId("vote-count").textContent).toBe("3"));
    expect(countFor(5)).toBe(1);
    expect(screen.getByTestId("avg-score").textContent).toBe("4");

    // User clicks 5★
    await act(async () => {
      fireEvent.click(screen.getByTestId("vote-5"));
    });

    // BEFORE the server resolves, UI must already reflect the new vote
    expect(countFor(5)).toBe(2);
    expect(countFor(4)).toBe(1);
    expect(countFor(3)).toBe(1);
    expect(screen.getByTestId("vote-count").textContent).toBe("4");
    // (5+5+4+3)/4 = 4.25
    expect(screen.getByTestId("avg-score").textContent).toBe("4.25");

    // Let castVote resolve so we don't leak the open promise
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 4, 3, 5]));
    await act(async () => {
      resolveVote();
    });
  });

  it("after the server confirms, chart reconciles with authoritative numbers", async () => {
    mockedGetPhoto.mockResolvedValueOnce(makePayload([4, 4, 3])); // initial
    mockedCastVote.mockResolvedValueOnce({ ok: true });
    // refetch after invalidate returns the new server-side truth
    mockedGetPhoto.mockResolvedValueOnce(makePayload([4, 4, 3, 5]));

    renderWithClient("photo-1");
    await waitFor(() => expect(screen.getByTestId("vote-count").textContent).toBe("3"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("vote-5"));
    });

    // After castVote resolves + invalidate, chart shows server data
    await waitFor(() => {
      expect(screen.getByTestId("vote-count").textContent).toBe("4");
      expect(countFor(5)).toBe(1);
      expect(countFor(4)).toBe(2);
      expect(countFor(3)).toBe(1);
    });
    // (4+4+3+5)/4 = 4
    expect(screen.getByTestId("avg-score").textContent).toBe("4");
    expect(mockedCastVote).toHaveBeenCalledWith({ data: { photo_id: "photo-1", score: 5 } });
    expect(mockedGetPhoto).toHaveBeenCalledTimes(2);
  });

  it("two sequential votes from different users both update the chart in order", async () => {
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5])); // initial: 1 vote
    // First click (user A votes 3★)
    mockedCastVote.mockResolvedValueOnce({ ok: true });
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 3]));
    // Second click (user B votes 5★)
    mockedCastVote.mockResolvedValueOnce({ ok: true });
    mockedGetPhoto.mockResolvedValueOnce(makePayload([5, 3, 5]));

    renderWithClient("photo-1");
    await waitFor(() => expect(screen.getByTestId("vote-count").textContent).toBe("1"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("vote-3"));
    });
    await waitFor(() => expect(screen.getByTestId("vote-count").textContent).toBe("2"));
    expect(countFor(5)).toBe(1);
    expect(countFor(3)).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId("vote-5"));
    });
    await waitFor(() => expect(screen.getByTestId("vote-count").textContent).toBe("3"));
    expect(countFor(5)).toBe(2);
    expect(countFor(3)).toBe(1);
    // (5+3+5)/3 = 4.33
    expect(screen.getByTestId("avg-score").textContent).toBe("4.33");
  });
});