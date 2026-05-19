import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Medal } from "lucide-react";
import { getMemberLeaderboard } from "@/lib/leaderboard.functions";
import { cn } from "@/lib/utils";

type Range = "day" | "week" | "month" | "year" | "all";

const TABS: { id: Range; label: string }[] = [
  { id: "day", label: "วันนี้" },
  { id: "week", label: "สัปดาห์นี้" },
  { id: "month", label: "เดือนนี้" },
  { id: "year", label: "ปีนี้" },
  { id: "all", label: "All time" },
];

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Member Leaderboard — SEESTAR" },
      {
        name: "description",
        content:
          "อันดับสมาชิกที่ได้รับโหวตมากที่สุด รายวัน รายสัปดาห์ รายเดือน รายปี และตลอดกาล",
      },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [range, setRange] = useState<Range>("week");
  const fn = useServerFn(getMemberLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["member-leaderboard", range],
    queryFn: () => fn({ data: { range, limit: 50 } }),
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Trophy className="h-7 w-7 text-[var(--gold)]" />
            อันดับสมาชิก
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            จัดอันดับจากจำนวนโหวตที่ได้รับ — คะแนนจะถูกตัดทิ้งตามช่วงเวลาที่อัปโหลดรูป
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setRange(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              range === t.id
                ? "bg-primary text-primary-foreground"
                : "border border-input bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          ยังไม่มีโหวตในช่วงเวลานี้
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {entries.map((e: any) => (
            <li
              key={e.user_id}
              className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/40"
            >
              <RankBadge rank={e.rank} />
              <Link
                to="/profile/$id"
                params={{ id: e.user_id }}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                {e.avatar_url ? (
                  <img
                    src={e.avatar_url}
                    alt={e.display_name}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {e.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.total_photos} รูป · เฉลี่ย {e.avg_score.toFixed(2)}★
                  </div>
                </div>
              </Link>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">
                  {e.total_votes.toLocaleString()}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  votes
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
        <Medal className="h-5 w-5" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-300/15 text-zinc-400">
        <Medal className="h-5 w-5" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-700/15 text-amber-600">
        <Medal className="h-5 w-5" />
      </div>
    );
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground tabular-nums">
      {rank}
    </div>
  );
}