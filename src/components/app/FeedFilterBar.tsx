import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, X, Flame, Sparkles, RotateCcw } from "lucide-react";
import { getPopularTags } from "@/lib/photos.functions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type FeedTab = "latest" | "trending" | "top-day" | "top-week" | "top-month" | "top-year" | "following";
export type FeedSort = "new" | "score" | "votes";

const TABS: { id: FeedTab; label: string; icon: any; tooltip: string }[] = [
  { id: "latest", label: "Latest", icon: Sparkles, tooltip: "ภาพล่าสุดที่อัปโหลด" },
  { id: "trending", label: "Trending", icon: Flame, tooltip: "ภาพกำลังมาแรง" },
];

const SORT_LABELS: Record<FeedSort, string> = {
  new: "ใหม่สุด",
  score: "คะแนนสูงสุด",
  votes: "โหวตเยอะสุด",
};

export function FeedFilterBar({
  tab,
  sort,
  tag,
  showSort = true,
  showTags = true,
}: {
  tab?: FeedTab;
  sort?: FeedSort;
  tag?: string;
  showSort?: boolean;
  showTags?: boolean;
}) {
  const navigate = useNavigate({ from: "/" });
  const tagsFn = useServerFn(getPopularTags);
  const { data } = useQuery({ queryKey: ["popular-tags"], queryFn: () => tagsFn() });
  const tags = data?.tags ?? [];

  const isDefault = tab === "latest" && sort === "new" && !tag;
  const activeSort: FeedSort = sort ?? "new";

  return (
    <div className="sticky top-[57px] z-30 -mx-4 mb-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-6 md:px-6">
      <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-3">
        {/* Tabs + Sort */}
        <div className="flex items-center justify-between gap-3">
          <div
            className="-mx-4 flex flex-1 items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
            role="tablist"
            aria-label="Feed view"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      search={(prev: any) => ({ ...prev, tab: t.id })}
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-[var(--gold)]/60 bg-[var(--gold)]/10 text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", active && "text-[var(--gold)]")} />
                      {t.label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>{t.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
            {([1, 2, 3, 4, 5] as const).map((n) => (
                <Tooltip key={`stars-${n}`}>
                  <TooltipTrigger asChild>
                    <Link
                      to="/stars/$n"
                      params={{ n: String(n) }}
                      role="tab"
                      className={cn(
                        "inline-flex shrink-0 items-center gap-0.5 rounded-full border border-transparent px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      activeProps={{
                        className:
                          "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition border-[var(--gold)]/60 bg-[var(--gold)]/10 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      }}
                      aria-label={`ดูภาพที่ได้ ${n} ดาว`}
                    >
                      <span>
                        {n}
                        <span className="text-[var(--gold)]">★</span>
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    ดูภาพที่ได้ {n} ดาว
                  </TooltipContent>
                </Tooltip>
              ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showSort && !isDefault && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/"
                    search={{ tab: "latest", sort: "new" }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Reset filters"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>ล้างตัวกรองทั้งหมด</TooltipContent>
              </Tooltip>
            )}

            {showSort && (<DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    aria-label="Sort"
                  >
                    <span className="hidden text-muted-foreground sm:inline">Sort:</span>
                    <span>{SORT_LABELS[activeSort]}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>เรียงลำดับฟีด</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {(Object.keys(SORT_LABELS) as FeedSort[]).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => navigate({ search: (prev: any) => ({ ...prev, sort: s }) })}
                    className={cn(s === activeSort && "font-semibold text-[var(--gold)]")}
                  >
                    {SORT_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>)}
          </div>
        </div>

        {/* Tag chips */}
        {showTags && tags.length > 0 && (
          <div
            className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
            aria-label="Tag filters"
          >
            <Link
              to="/"
              search={(prev: any) => ({ ...prev, tag: undefined })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
                !tag
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              All
            </Link>
            {tags.map(({ tag: t, count }) => {
              const active = tag === t;
              return (
                <Link
                  key={t}
                  to="/"
                  search={(prev: any) => ({ ...prev, tag: active ? undefined : t })}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                    active
                      ? "border-[var(--gold)] bg-[var(--gold)]/15 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  <span>#{t}</span>
                  <span className="text-[10px] opacity-60">{count}</span>
                  {active && <X className="h-3 w-3" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </TooltipProvider>
    </div>
  );
}