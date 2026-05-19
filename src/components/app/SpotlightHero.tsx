import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown, Medal, Sparkles, Star } from "lucide-react";
import { getTopTwoPhotos } from "@/lib/photos.functions";
import { nextMilestoneProgress, THRESHOLDS_DAYS } from "@/lib/milestone";
import { StarRow } from "./StarRow";
import { cn } from "@/lib/utils";

function formatDays(d: number) {
  if (d < 1 / 24) return "<1h";
  if (d < 1) return `${Math.max(1, Math.floor(d * 24))}h`;
  return `${d.toFixed(d < 10 ? 1 : 0)}d`;
}

export function SpotlightHero() {
  const fn = useServerFn(getTopTwoPhotos);
  const { data, isLoading } = useQuery({
    queryKey: ["spotlight-top-two"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="relative mb-6 h-48 animate-pulse overflow-hidden rounded-2xl border border-border bg-card md:h-64" />
    );
  }

  const photo: any = data?.first;
  const runnerUp: any = data?.second;
  if (!photo) return null;
  const held: boolean = !!data?.held;

  const prog = nextMilestoneProgress(photo.milestone_stars ?? 0, photo.rank_one_since);
  const stars = photo.milestone_stars ?? 0;
  const elapsed = prog?.elapsedDays ?? 0;
  const next = prog?.nextDays ?? THRESHOLDS_DAYS[Math.min(stars, THRESHOLDS_DAYS.length - 1)];
  const remaining = Math.max(0, (next ?? 0) - elapsed);
  const pct = next ? Math.min(100, (elapsed / next) * 100) : 100;

  return (
    <section
      aria-label="Current #1 spotlight"
      className="relative mb-6 overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold)]/10 via-background to-background shadow-[0_0_60px_-20px_var(--gold-glow,rgba(255,200,0,0.4))]"
    >
      <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(circle_at_20%_30%,var(--gold)_0%,transparent_45%),radial-gradient(circle_at_85%_70%,var(--gold)_0%,transparent_40%)]" />

      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Image */}
        <Link
          to="/photo/$id"
          params={{ id: photo.id }}
          className="group relative block aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[280px]"
          aria-label={`Spotlight: ${photo.title}`}
        >
          <img
            src={photo.image_url}
            alt={photo.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-background/70 via-background/10 to-transparent md:bg-gradient-to-r" />
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/95 px-3 py-1 text-xs font-bold uppercase tracking-wider text-background shadow-lg">
            <Crown className="h-3.5 w-3.5" />
            {held ? "#1 Now" : "Top Rated"}
          </div>
        </Link>

        {/* Content */}
        <div className="flex flex-col justify-center gap-4 p-5 md:p-7">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
            <Sparkles className="h-3.5 w-3.5" />
            {held ? "Spotlight · Holding #1" : "Spotlight · Top of the feed"}
          </div>

          <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            <Link to="/photo/$id" params={{ id: photo.id }} className="hover:text-[var(--gold)]">
              {photo.title}
            </Link>
          </h2>

          <Link
            to="/profile/$id"
            params={{ id: photo.user_id }}
            className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {photo.profiles?.avatar_url ? (
              <img
                src={photo.profiles.avatar_url}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px]">
                {(photo.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            by {photo.profiles?.display_name ?? "Anonymous"}
          </Link>

          <Link
            to="/photo/$id"
            params={{ id: photo.id }}
            className="group/cta inline-flex w-fit items-center gap-2 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-background shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-110"
            aria-label={`View details for ${photo.title}`}
          >
            View photo details
            <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5" />
          </Link>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" />
              <span className="font-semibold">{Number(photo.avg_score).toFixed(2)}</span>
              <span className="text-muted-foreground">· {photo.vote_count} votes</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Milestones</span>
              <StarRow count={stars} size={14} />
            </div>
          </div>

          {/* Countdown — only meaningful while actually holding #1 */}
          {held && stars < 5 && (
            <div className="rounded-xl border border-border bg-background/60 p-3 backdrop-blur">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-muted-foreground">
                  Held #1 for{" "}
                  <span className="font-bold text-foreground">{formatDays(elapsed)}</span>
                </span>
                <span className="text-muted-foreground">
                  Next ★ in{" "}
                  <span className="font-bold text-[var(--gold)]">{formatDays(remaining)}</span>
                  <span className="ml-1">/ {next}d</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-glow,#ffd97a)] transition-[width] duration-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {!held && (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-3 text-xs text-muted-foreground backdrop-blur">
              Reach #1 with at least 10 votes to start the milestone clock toward your next ★.
            </div>
          )}

          {stars >= 5 && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--gold)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--gold)]">
              <Sparkles className="h-3.5 w-3.5" />
              Hall of Fame — Max milestones earned
            </div>
          )}
        </div>
      </div>

      {runnerUp && (
        <div
          aria-label="Runner-up #2"
          className="flex flex-col gap-4 border-t border-border/60 bg-background/40 p-4 backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-5"
        >
          <Link
            to="/photo/$id"
            params={{ id: runnerUp.id }}
            className="group relative block h-24 w-full overflow-hidden rounded-xl sm:h-20 sm:w-28 sm:flex-shrink-0"
            aria-label={`Runner-up: ${runnerUp.title}`}
          >
            <img
              src={runnerUp.image_url}
              alt={runnerUp.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground shadow">
              <Medal className="h-3 w-3 text-[var(--gold)]" />
              #2
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Runner-up
            </div>
            <Link
              to="/photo/$id"
              params={{ id: runnerUp.id }}
              className="truncate text-base font-semibold leading-tight hover:text-[var(--gold)]"
            >
              {runnerUp.title}
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />
              <span className="font-semibold text-foreground">
                {Number(runnerUp.avg_score).toFixed(2)}
              </span>
              <span>· {runnerUp.vote_count} votes</span>
              <span className="mx-1">·</span>
              <span className="truncate">
                by {runnerUp.profiles?.display_name ?? "Anonymous"}
              </span>
            </div>
          </div>

          <Link
            to="/photo/$id"
            params={{ id: runnerUp.id }}
            className="group/cta2 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--gold)]/60 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] sm:flex-shrink-0"
            aria-label={`View photo details for runner-up ${runnerUp.title}`}
          >
            View #2 photo details
            <ArrowRight className="h-4 w-4 transition-transform group-hover/cta2:translate-x-0.5" />
          </Link>
        </div>
      )}
    </section>
  );
}