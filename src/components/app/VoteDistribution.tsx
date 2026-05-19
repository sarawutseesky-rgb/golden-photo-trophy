import { normalizeDistribution } from "@/lib/utils";

interface VoteDistributionProps {
  /** Raw distribution array `[c1★, c2★, c3★, c4★, c5★]` from the server. */
  distribution: unknown;
}

/**
 * 5-row bar chart showing how many votes each star value has received.
 * Rendered on the photo detail page and exercised by the
 * `VoteDistribution.test.tsx` UI tests.
 */
export function VoteDistribution({ distribution }: VoteDistributionProps) {
  const dist = normalizeDistribution(distribution);
  const total = dist.reduce((a, b) => a + b, 0) || 1;

  return (
    <div
      className="mt-4 space-y-1"
      role="list"
      aria-label="การกระจายคะแนนโหวต 1 ถึง 5 ดาว"
      data-testid="vote-distribution"
    >
      {[5, 4, 3, 2, 1].map((s) => {
        const c = dist[s - 1] ?? 0;
        const pct = (c / total) * 100;
        return (
          <div
            key={s}
            role="listitem"
            data-testid={`vote-dist-row-${s}`}
            aria-label={`${s} ดาว: ${c} โหวต`}
            className="flex items-center gap-2 text-xs"
          >
            <span className="w-4 text-muted-foreground">{s}★</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
              <div
                data-testid={`vote-dist-bar-${s}`}
                data-percent={pct.toFixed(2)}
                className="h-full bg-[var(--gold)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              data-testid={`vote-dist-count-${s}`}
              className="w-6 text-right text-muted-foreground"
            >
              {c}
            </span>
          </div>
        );
      })}
    </div>
  );
}