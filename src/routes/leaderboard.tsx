import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Medal, ArrowDownToLine, Star, Image as ImageIcon, Users } from "lucide-react";
import { getMemberLeaderboard, getPhotoLeaderboard } from "@/lib/leaderboard.functions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type Range = "day" | "week" | "month" | "year" | "all";
type Mode = "members" | "photos";

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
      { property: "og:title", content: "Member Leaderboard — SEESTAR" },
      {
        property: "og:description",
        content:
          "อันดับสมาชิก SEESTAR ที่ได้รับโหวตมากที่สุด รายวัน รายสัปดาห์ รายเดือน รายปี และตลอดกาล",
      },
      { property: "og:url", content: "https://golden-photo-trophy.lovable.app/leaderboard" },
    ],
    links: [
      { rel: "canonical", href: "https://golden-photo-trophy.lovable.app/leaderboard" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Member Leaderboard",
          url: "https://golden-photo-trophy.lovable.app/leaderboard",
          description: "Top SEESTAR members ranked by votes received across day, week, month, year, and all-time.",
        }),
      },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [range, setRange] = useState<Range>("week");
  const [mode, setMode] = useState<Mode>("members");
  const { user } = useAuth();
  const fn = useServerFn(getMemberLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["member-leaderboard", range, user?.id ?? null],
    enabled: mode === "members",
    queryFn: () =>
      fn({ data: { range, limit: 50, viewer_id: user?.id ?? null } }),
  });

  const entries = data?.entries ?? [];
  const me = data?.me ?? null;
  const total = data?.total ?? 0;
  const meInTop = !!me && entries.some((e: any) => e.user_id === me.user_id);
  const meRowRef = useRef<HTMLLIElement | null>(null);
  const [flash, setFlash] = useState(false);

  const scrollToMe = useCallback(() => {
    const el = meRowRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(true);
    window.setTimeout(() => setFlash(false), 5000);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Trophy className="h-7 w-7 text-[var(--gold)]" />
            {mode === "members" ? "อันดับสมาชิก" : "อันดับภาพถ่าย"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "members"
              ? "จัดอันดับจากจำนวนโหวตที่ได้รับ — คะแนนจะถูกตัดทิ้งตามช่วงเวลาที่อัปโหลดรูป"
              : "จัดอันดับจากค่าเฉลี่ยคะแนน (ต้องมีอย่างน้อย 10 โหวต)"}
          </p>
        </div>
      </header>

      <div className="inline-flex rounded-full border border-border bg-card p-1">
        <button
          onClick={() => setMode("members")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            mode === "members" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="h-4 w-4" /> สมาชิก
        </button>
        <button
          onClick={() => setMode("photos")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            mode === "photos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ImageIcon className="h-4 w-4" /> ภาพถ่าย
        </button>
      </div>

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

      {mode === "photos" ? (
        <PhotoLeaderboard range={range} />
      ) : (
        <>
      {user && (
        <MyRankPanel
          me={me}
          total={total}
          highlighted={meInTop}
          canScroll={meInTop}
          onScrollToMe={scrollToMe}
        />
      )}

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          ยังไม่มีโหวตในช่วงเวลานี้
        </div>
      ) : (
        <div className="space-y-2">
          {meInTop && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={scrollToMe}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                ไปยังแถวของฉัน (อันดับ {me!.rank})
              </button>
            </div>
          )}
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {entries.map((e: any) => (
            <li
              key={e.user_id}
              ref={me?.user_id === e.user_id ? meRowRef : undefined}
              className={cn(
                "relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-5 text-center transition-colors hover:bg-accent/40",
                e.rank === 1 &&
                  "border-[var(--gold)]/60 bg-gradient-to-b from-[var(--gold)]/15 to-transparent shadow-[0_0_24px_-8px_var(--gold)]",
                e.rank === 2 &&
                  "border-zinc-300/50 bg-gradient-to-b from-zinc-300/10 to-transparent",
                e.rank === 3 &&
                  "border-amber-700/50 bg-gradient-to-b from-amber-700/10 to-transparent",
                me?.user_id === e.user_id && "bg-[var(--gold)]/5",
                me?.user_id === e.user_id && flash && "me-row-flash",
              )}
            >
              <div className="absolute left-2 top-2">
                <RankBadge rank={e.rank} />
              </div>
              <Link
                to="/profile/$id"
                params={{ id: e.user_id }}
                className="flex w-full flex-col items-center gap-2 min-w-0"
              >
                {e.avatar_url ? (
                  <img
                    src={e.avatar_url}
                    alt={e.display_name}
                    className="h-16 w-16 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                    {e.display_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0 w-full">
                  <div className="truncate font-semibold">{e.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.total_photos} รูป · เฉลี่ย {e.avg_score.toFixed(2)}★
                  </div>
                </div>
              </Link>
              <div className="text-center">
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
        </div>
      )}
        </>
      )}
    </div>
  );
}

function PhotoLeaderboard({ range }: { range: Range }) {
  const fn = useServerFn(getPhotoLeaderboard);
  const PAGE_SIZE = 24;
  const query = useInfiniteQuery({
    queryKey: ["photo-leaderboard", range],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fn({ data: { range, limit: PAGE_SIZE, offset: pageParam as number, min_votes: 10 } }),
    getNextPageParam: (last, all) => {
      const got = last?.entries?.length ?? 0;
      if (got < PAGE_SIZE) return undefined;
      return all.reduce((s, p) => s + (p?.entries?.length ?? 0), 0);
    },
  });
  const entries = (query.data?.pages ?? []).flatMap((p) => p?.entries ?? []);
  const minVotes = query.data?.pages?.[0]?.min_votes ?? 10;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  if (query.isLoading) {
    return <PhotoLeaderboardSkeleton count={8} />;
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <Star className="mx-auto h-10 w-10 text-[var(--gold)]" strokeWidth={1.5} />
        <h3 className="mt-3 text-lg font-semibold">ยังไม่มีภาพที่ผ่านเกณฑ์</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          ต้องได้รับอย่างน้อย {minVotes} โหวตจึงจะถูกจัดอันดับ — ช่วยกันโหวตภาพถ่ายให้ครบเกณฑ์กันเถอะ
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
    <ol className="overflow-hidden rounded-xl border border-border bg-card">
      {entries.map((e: any) => (
        <li
          key={e.photo_id}
          className="flex min-h-[80px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/40"
        >
          <RankBadge rank={e.rank} />
          <Link
            to="/photo/$id"
            params={{ id: e.photo_id }}
            className="flex flex-1 items-center gap-3 min-w-0"
          >
            <img
              src={e.image_url}
              alt={e.title}
              loading="lazy"
              className="h-14 w-14 rounded-md object-cover ring-1 ring-border"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{e.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                โดย {e.display_name} · {e.vote_count.toLocaleString()} โหวต
              </div>
            </div>
          </Link>
          <div className="w-20 shrink-0 text-right">
            <div className="flex items-center justify-end gap-1 text-lg font-bold tabular-nums text-[var(--gold)]">
              {e.avg_score.toFixed(2)}
              <Star className="h-4 w-4 fill-current" />
            </div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              avg score
            </div>
          </div>
        </li>
      ))}
      {query.isFetchingNextPage &&
        Array.from({ length: Math.min(PAGE_SIZE, 6) }).map((_, i) => (
          <SkeletonRow key={`sk-${i}`} index={i} />
        ))}
    </ol>
      <div ref={sentinelRef} />
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-full border border-input bg-background px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            {query.isFetchingNextPage ? "กำลังโหลด…" : "โหลดเพิ่ม"}
          </button>
        </div>
      ) : (
        entries.length > PAGE_SIZE && (
          <p className="text-center text-sm text-muted-foreground">— จบอันดับแล้ว —</p>
        )
      )}
    </div>
  );
}

function SkeletonRow({ index = 0 }: { index?: number }) {
  return (
    <li
      className="flex min-h-[80px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
      aria-hidden="true"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="h-9 w-9 shrink-0 rounded-full shimmer" />
      <div className="h-14 w-14 shrink-0 rounded-md shimmer" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-[18px] w-2/3 rounded shimmer" />
        <div className="h-[14px] w-1/3 rounded shimmer" />
      </div>
      <div className="flex w-20 shrink-0 flex-col items-end gap-1.5">
        <div className="flex h-7 items-center justify-end gap-1">
          <div className="h-5 w-12 rounded shimmer" />
          <Star
            className="h-4 w-4 text-[var(--gold)]/30"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <div className="h-3 w-16 rounded shimmer" />
      </div>
    </li>
  );
}

function PhotoLeaderboardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ol
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-busy="true"
      aria-label="กำลังโหลดอันดับ"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </ol>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
        <Medal className="h-5 w-5" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-300/15 text-zinc-400">
        <Medal className="h-5 w-5" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-700/15 text-amber-600">
        <Medal className="h-5 w-5" />
      </div>
    );
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground tabular-nums">
      {rank}
    </div>
  );
}

function MyRankPanel({
  me,
  total,
  highlighted,
  canScroll,
  onScrollToMe,
}: {
  me: any | null;
  total: number;
  highlighted: boolean;
  canScroll: boolean;
  onScrollToMe: () => void;
}) {
  if (!me) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        คุณยังไม่ติดอันดับในช่วงนี้ — อัปโหลดรูปและรับโหวตเพื่อขึ้นบอร์ด
      </div>
    );
  }
  const Wrapper: any = canScroll ? "button" : "div";
  return (
    <Wrapper
      type={canScroll ? "button" : undefined}
      onClick={canScroll ? onScrollToMe : undefined}
      title={canScroll ? "ไปยังแถวของฉันในตาราง" : undefined}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/5 px-4 py-3 text-left",
        canScroll && "cursor-pointer hover:bg-[var(--gold)]/10 transition-colors",
        highlighted && "ring-1 ring-[var(--gold)]/40",
      )}
    >
      <RankBadge rank={me.rank} />
      <div className="flex flex-1 items-center gap-3 min-w-0">
        {me.avatar_url ? (
          <img
            src={me.avatar_url}
            alt={me.display_name}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
            {me.display_name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            อันดับของคุณ · {me.display_name}
          </div>
          <div className="text-xs text-muted-foreground">
            อันดับ {me.rank} จาก {total} · {me.total_photos} รูป · เฉลี่ย {me.avg_score.toFixed(2)}★
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold tabular-nums">
          {me.total_votes.toLocaleString()}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          votes
        </div>
      </div>
      {canScroll && (
        <span className="hidden sm:inline text-xs font-medium text-[var(--gold)]">
          ไปยังแถวของฉัน ↓
        </span>
      )}
    </Wrapper>
  );
}