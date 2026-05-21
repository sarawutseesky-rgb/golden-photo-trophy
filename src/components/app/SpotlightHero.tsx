import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown, Medal, Sparkles, Star } from "lucide-react";
import { getTopTwoPhotos } from "@/lib/photos.functions";
import { nextMilestoneProgress, THRESHOLDS_HOURS } from "@/lib/milestone";
import { StarRow } from "./StarRow";
import { cn } from "@/lib/utils";

function formatHours(h: number) {
  if (h < 1) return "<1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(h < 240 ? 1 : 0)}d`;
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
      <div className="relative mb-6 h-36 animate-pulse overflow-hidden rounded-2xl border border-border bg-card md:h-48" />
    );
  }

  const photo: any = data?.first;
  const runnerUp: any = data?.second;
  if (!photo) return null;
  const held: boolean = !!data?.held;

  const prog = nextMilestoneProgress(photo.milestone_stars ?? 0, photo.created_at);
  const stars = photo.milestone_stars ?? 0;
  const elapsedH = prog?.elapsedHours ?? 0;
  const nextH = prog?.nextHours ?? THRESHOLDS_HOURS[Math.min(stars, THRESHOLDS_HOURS.length - 1)];
  const remainingH = Math.max(0, (nextH ?? 0) - elapsedH);
  const pct = nextH ? Math.min(100, (elapsedH / nextH) * 100) : 100;

  return (
    <section
      aria-label="Current #1 spotlight"
      className="relative mb-6 overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold)]/10 via-background to-background shadow-[0_0_60px_-20px_var(--gold-glow,rgba(255,200,0,0.4))]"
    >
      <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(circle_at_20%_30%,var(--gold)_0%,transparent_45%),radial-gradient(circle_at_85%_70%,var(--gold)_0%,transparent_40%)]" />

      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Image */}
        <Link
          to="/photo/$id"
          params={{ id: photo.id }}
          className="group relative block aspect-[3/2] overflow-hidden sm:aspect-[16/9] lg:aspect-auto lg:min-h-[420px]"
          aria-label={`Spotlight: ${photo.title}`}
        >
          <img
            src={photo.image_url}
            alt={photo.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-background/30" />
          <div className="absolute left-2 top-2 inline-flex min-w-[88px] items-center gap-1 rounded-full bg-[var(--gold)]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow-lg sm:left-3 sm:top-3 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
            <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={held ? "held" : "toprated"}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                className="inline-block"
              >
                {held ? "#1 Now" : "Top Rated"}
              </motion.span>
            </AnimatePresence>
          </div>
        </Link>

        {/* Content */}
        <div className="flex flex-col justify-between gap-8 border-t border-border/60 p-6 md:p-8 lg:border-l lg:border-t-0">
          <div className="flex flex-col gap-6">
            {/* Title + Author */}
            <div className="flex flex-col gap-4">
              <h2 className="text-4xl font-black leading-none tracking-tight md:text-5xl">
                <Link to="/photo/$id" params={{ id: photo.id }} className="hover:text-[var(--gold)]">
                  {photo.title}
                </Link>
              </h2>
              <Link
                to="/profile/$id"
                params={{ id: photo.user_id }}
                className="inline-flex w-fit items-center gap-3 text-sm hover:text-foreground"
              >
                {photo.profiles?.avatar_url ? (
                  <img
                    src={photo.profiles.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full border-2 border-[var(--gold)]/20 object-cover"
                  />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--gold)]/20 bg-muted text-sm font-semibold">
                    {(photo.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Artist
                  </span>
                  <span className="font-bold text-foreground">
                    {photo.profiles?.display_name ?? "Anonymous"}
                  </span>
                </span>
              </Link>
            </div>

            {/* Ratings + Milestones row */}
            <div className="flex items-start justify-between gap-4">
              <div
                className="flex flex-col gap-1"
                aria-label={`คะแนนเฉลี่ย ${Number(photo.avg_score).toFixed(2)} จาก 5 ดาว`}
              >
                <StarRow count={Math.round(Number(photo.avg_score))} size={20} />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="text-foreground">{Number(photo.avg_score).toFixed(2)}</span>
                  {" · "}
                  {photo.vote_count} votes
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
                  Milestones
                </span>
                <StarRow count={stars} size={14} />
              </div>
            </div>

            {/* CTA — full width */}
            <Link
              to="/photo/$id"
              params={{ id: photo.id }}
              className="group/cta inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-4 text-sm font-black uppercase tracking-widest text-background shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-110"
              aria-label={`View details for ${photo.title}`}
            >
              View photo details
              <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5" />
            </Link>

            {stars >= 5 && (
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--gold)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--gold)]">
                <Sparkles className="h-3.5 w-3.5" />
                Hall of Fame — Max milestones earned
              </div>
            )}
          </div>

          {/* Countdown — anchored at bottom */}
          {prog && stars < 5 && (
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Age: <span className="text-foreground">{formatHours(elapsedH)}</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Next ★ in{" "}
                  <span className="text-[var(--gold)]">{formatHours(remainingH)}</span>
                  <span className="ml-1 text-muted-foreground/70">/ {nextH}h</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted p-[2px]">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-glow,#ffd97a)] shadow-[0_0_12px_rgba(245,180,0,0.3)] transition-[width] duration-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
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
            <div
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-label={`คะแนนเฉลี่ย ${Number(runnerUp.avg_score).toFixed(2)} จาก 5 ดาว`}
            >
              <StarRow count={Math.round(Number(runnerUp.avg_score))} size={12} />
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