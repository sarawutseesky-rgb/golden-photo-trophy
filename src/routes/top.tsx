import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";
import { CollectionPageSkeleton } from "@/components/app/CollectionPageSkeleton";
import { cn } from "@/lib/utils";

const topSearchSchema = z.object({
  range: fallback(z.enum(["day", "week", "month", "year", "all"]), "all").default("all"),
  sort: fallback(z.enum(["score", "votes"]), "score").default("score"),
});

export const Route = createFileRoute("/top")({
  validateSearch: zodValidator(topSearchSchema),
  head: () => ({
    meta: [
      { title: "Top rated — SEESTAR" },
      { name: "description", content: "Discover the highest-rated photos on SEESTAR, sorted by average star score with a minimum of 10 community votes." },
      { property: "og:title", content: "Top rated photos — SEESTAR" },
      { property: "og:description", content: "Discover the highest-rated SEESTAR photos, sorted by average star score with at least 10 community votes." },
      { property: "og:url", content: "https://golden-photo-trophy.lovable.app/top" },
    ],
    links: [
      { rel: "canonical", href: "https://golden-photo-trophy.lovable.app/top" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Top rated photos",
          url: "https://golden-photo-trophy.lovable.app/top",
          description: "Highest-rated SEESTAR photos with at least 10 votes.",
        }),
      },
    ],
  }),
  component: TopPage,
});

const RANGES: { id: "day" | "week" | "month" | "year" | "all"; label: string }[] = [
  { id: "day", label: "วันนี้" },
  { id: "week", label: "สัปดาห์นี้" },
  { id: "month", label: "เดือนนี้" },
  { id: "year", label: "ปีนี้" },
  { id: "all", label: "ตลอดกาล" },
];

const SORTS: { id: "score" | "votes"; label: string }[] = [
  { id: "score", label: "คะแนนสูงสุด" },
  { id: "votes", label: "โหวตเยอะสุด" },
];

function TopPage() {
  const { range, sort } = Route.useSearch();
  const backendSort = sort === "votes" ? "votes" : "top";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Top rated</h1>
        <p className="mt-1 text-muted-foreground">
          {sort === "votes"
            ? "เรียงตามจำนวนโหวต"
            : "เรียงตามคะแนนเฉลี่ย (อย่างน้อย 10 โหวต)"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="ช่วงเวลา"
        >
          {RANGES.map((r) => {
            const active = r.id === range;
            return (
              <Link
                key={r.id}
                to="/top"
                search={(prev: any) => ({ ...prev, range: r.id })}
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-[var(--gold)]/60 bg-[var(--gold)]/10 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1.5" role="tablist" aria-label="เรียงลำดับ">
          {SORTS.map((s) => {
            const active = s.id === sort;
            return (
              <Link
                key={s.id}
                to="/top"
                search={(prev: any) => ({ ...prev, sort: s.id })}
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-[var(--gold)]/70 bg-[var(--gold)]/15 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      <InfinitePhotoFeed
        queryKey={["top", range, sort]}
        params={{ sort: backendSort, range }}
        renderLoading={() => (
          <CollectionPageSkeleton titleWidth="160px" descWidth="300px" />
        )}
      />
    </div>
  );
}