import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Eye, MessageCircle, Trophy, Flame, Sparkles, Loader2, CheckCircle2, CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { castVote, getMyVote } from "@/lib/votes.functions";
import { useAuth } from "@/lib/auth-context";
import { cn, normalizeDistribution } from "@/lib/utils";
import {
  formatVoteSummary,
  isDuplicateVoteMessage,
  toastDuplicateVote,
  toastVoteSuccess,
} from "@/lib/vote-toast";
import { StarRow } from "./StarRow";
import { Skeleton } from "@/components/ui/skeleton";

export type FeedPhoto = {
  id: string;
  title: string;
  image_url: string;
  avg_score: number;
  vote_count: number;
  milestone_stars: number;
  user_id?: string;
  view_count?: number;
  comment_count?: number;
  current_rank?: number | null;
  rank_one_since?: string | null;
  created_at?: string;
  milestone_achieved_at?: string[] | null;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

export function PhotoCard({
  photo,
  showMilestoneTimeline = false,
}: {
  photo: FeedPhoto;
  showMilestoneTimeline?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const vote = useServerFn(castVote);
  const [hover, setHover] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ score: number; avg: number; count: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hydratedFromServer, setHydratedFromServer] = useState(false);
  const quickRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Hydrate existing vote on mount / refresh so screen readers can announce "โหวตแล้ว"
  const fetchMyVote = useServerFn(getMyVote);
  const isOwner = !!user && photo.user_id === user.id;
  const myVoteQuery = useQuery({
    queryKey: ["my-vote", photo.id, user?.id ?? "anon"],
    queryFn: async () => {
      try {
        const res = await fetchMyVote({ data: { photo_id: photo.id } });
        if (res.score != null) {
          setMyScore(res.score);
          setHydratedFromServer(true);
        }
        return res;
      } catch {
        // Not authenticated (e.g. just logged out) — treat as no vote
        return { score: null };
      }
    },
    enabled: !!user && !isOwner,
    staleTime: 60_000,
    retry: false,
  });
  // True once we know the user's vote status (query resolved, or no query needed).
  const voteKnown = !user || isOwner || myVoteQuery.isFetched;

  const focusQuick = (idx: number) => {
    const clamped = Math.max(0, Math.min(4, idx));
    const btn = quickRefs.current[clamped];
    if (btn) {
      btn.focus();
      if (!hasVoted) setHover(clamped + 1);
    }
  };

  const handleQuickKey = (e: React.KeyboardEvent<HTMLButtonElement>, n: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusQuick(n); // n is 1-based, so n -> index n
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusQuick(n - 2);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusQuick(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusQuick(4);
    } else if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      const score = Number(e.key);
      setHover(score);
      handleVote(score);
    }
  };

  const hasVoted = myScore != null;

  const now = Date.now();
  const createdMs = photo.created_at ? new Date(photo.created_at).getTime() : 0;
  const isNew = createdMs > 0 && now - createdMs < 48 * 60 * 60 * 1000;
  const isRankOne = photo.current_rank === 1;
  const rankOneSinceMs = photo.rank_one_since ? new Date(photo.rank_one_since).getTime() : 0;
  const isRising =
    !isRankOne &&
    rankOneSinceMs > 0 &&
    now - rankOneSinceMs < 24 * 60 * 60 * 1000;

  const handleVote = async (score: number) => {
    if (!user) return toast.error("เข้าสู่ระบบเพื่อโหวต");
    if (isOwner) return toast.error("โหวตรูปตัวเองไม่ได้");
    if (hasVoted || busy) return;
    setBusy(true);
    setMyScore(score);
    setErrorMsg(null);
    setConfirmed(null);
    setHydratedFromServer(false);

    // Snapshot current caches for rollback
    const prevFeeds = qc.getQueriesData<any>({ queryKey: ["feed"] });
    const prevInfinite = qc.getQueriesData<any>({ queryKey: ["feed-infinite"] });
    const photoKey = ["photo", photo.id] as const;
    const prevPhoto = qc.getQueryData<any>(photoKey);

    // Optimistic update on feed caches
    let optimisticAvg = Number(photo.avg_score ?? 0);
    let optimisticCount = (photo.vote_count ?? 0) + 1;
    const patchPhoto = (ph: any) => {
      if (!ph || ph.id !== photo.id) return ph;
      const oldCount = ph.vote_count ?? 0;
      const oldAvg = Number(ph.avg_score ?? 0);
      const newCount = oldCount + 1;
      const newAvg = newCount > 0 ? Number(((oldAvg * oldCount + score) / newCount).toFixed(2)) : 0;
      optimisticAvg = newAvg;
      optimisticCount = newCount;
      return { ...ph, vote_count: newCount, avg_score: newAvg };
    };
    qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
      if (!old?.photos) return old;
      return { ...old, photos: old.photos.map(patchPhoto) };
    });
    qc.setQueriesData({ queryKey: ["feed-infinite"] }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) =>
          p?.photos ? { ...p, photos: p.photos.map(patchPhoto) } : p,
        ),
      };
    });

    // Optimistic update on detail cache if present
    if (prevPhoto?.photo) {
      const dist = normalizeDistribution(prevPhoto.distribution);
      dist[score - 1] += 1;
      const newCount = dist.reduce((a: number, b: number) => a + b, 0);
      const sum = dist.reduce((acc: number, c: number, i: number) => acc + c * (i + 1), 0);
      const newAvg = newCount > 0 ? Number((sum / newCount).toFixed(2)) : 0;
      qc.setQueryData(photoKey, {
        ...prevPhoto,
        distribution: dist,
        photo: { ...prevPhoto.photo, vote_count: newCount, avg_score: newAvg },
      });
    }

    try {
      await vote({ data: { photo_id: photo.id, score } });
      toastVoteSuccess(score, optimisticAvg, optimisticCount);
      setConfirmed({ score, avg: optimisticAvg, count: optimisticCount });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feed-infinite"] });
      qc.invalidateQueries({ queryKey: photoKey });
      qc.invalidateQueries({ queryKey: ["my-vote", photo.id] });
      qc.invalidateQueries({ queryKey: ["spotlight-top-two"] });
      qc.invalidateQueries({ queryKey: ["community-stats-today"] });
    } catch (e: any) {
      setMyScore(null);
      setConfirmed(null);
      // Rollback
      prevFeeds.forEach(([key, data]) => qc.setQueryData(key, data));
      prevInfinite.forEach(([key, data]) => qc.setQueryData(key, data));
      qc.setQueryData(photoKey, prevPhoto);
      const msg = e?.message ?? "โหวตไม่สำเร็จ";
      const isDuplicate = isDuplicateVoteMessage(msg);
      if (isDuplicate) {
        // Refresh authoritative state so UI reflects the existing vote
        try {
          const res = await fetchMyVote({ data: { photo_id: photo.id } });
          const curAvg = Number(photo.avg_score ?? 0);
          const curCount = photo.vote_count ?? 0;
          if (res.score != null) {
            setMyScore(res.score);
            setHydratedFromServer(true);
            setConfirmed({ score: res.score, avg: curAvg, count: curCount });
          }
          toastDuplicateVote(res.score ?? null, curAvg, curCount);
        } catch {
          toastDuplicateVote(null, Number(photo.avg_score ?? 0), photo.vote_count ?? 0);
        }
        qc.invalidateQueries({ queryKey: ["feed"] });
        qc.invalidateQueries({ queryKey: ["feed-infinite"] });
        qc.invalidateQueries({ queryKey: photoKey });
        qc.invalidateQueries({ queryKey: ["my-vote", photo.id] });
        setErrorMsg(null);
      } else {
        toast.error(msg);
        setErrorMsg(`โหวตไม่สำเร็จ: ${msg} กรุณาลองอีกครั้ง`);
      }
    } finally {
      setBusy(false);
    }
  };

  const voteGroupLabel = isOwner
    ? `โหวตด่วนสำหรับรูป ${photo.title} (เจ้าของรูปโหวตเองไม่ได้)`
    : hasVoted
      ? `คุณให้คะแนนรูป ${photo.title} ${myScore} จาก 5 ดาวแล้ว`
      : `โหวตด่วนสำหรับรูป ${photo.title} คะแนนเฉลี่ย ${Number(photo.avg_score).toFixed(1)} จาก ${photo.vote_count} โหวต`;
  const liveStatus = (() => {
    if (errorMsg) return errorMsg;
    if (busy && myScore != null) return `สถานะการโหวต: กำลังส่งคะแนน ${myScore} ดาว กรุณารอสักครู่`;
    if (confirmed)
      return `โหวตสำเร็จ! คุณให้คะแนนรูปนี้ ${confirmed.score} ดาว คะแนนเฉลี่ยใหม่ ${confirmed.avg.toFixed(1)} จาก ${confirmed.count} โหวต`;
    if (hydratedFromServer && myScore != null)
      return `คุณได้โหวตรูปนี้ไว้แล้ว ${myScore} ดาว`;
    if (!hasVoted && hover != null) return `เลือก ${hover} ดาว`;
    return "";
  })();

  return (
    <article
      data-testid="photo-card"
      className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card transition hover:border-[var(--gold)]/60 hover:shadow-lg"
    >
      <Link
        to="/photo/$id"
        params={{ id: photo.id }}
        className="relative block overflow-hidden"
        aria-label={`ดูรูป ${photo.title}`}
      >
        <img
          src={photo.image_url}
          alt={photo.title}
          loading="lazy"
          className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.05]"
        />
        {/* Badges top-left */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
          {isRankOne && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--gold)]/95 px-1.5 py-0.5 text-[10px] font-bold text-background shadow">
              <Trophy className="h-3 w-3" /> #1
            </span>
          )}
          {isRising && (
            <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/95 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
              <Flame className="h-3 w-3" /> Rising
            </span>
          )}
          {isNew && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/95 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
              <Sparkles className="h-3 w-3" /> New
            </span>
          )}
          {photo.milestone_stars > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold)] shadow backdrop-blur">
              ✨ {photo.milestone_stars}
            </span>
          )}
          {user && !isOwner && voteKnown && (
            hasVoted ? (
              <span
                data-testid="vote-status-badge"
                className="inline-flex items-center gap-1 rounded-md bg-[var(--gold)]/95 px-1.5 py-0.5 text-[10px] font-bold text-background shadow"
                aria-label={`คุณโหวตแล้ว ${myScore} ดาว`}
              >
                <CheckCircle2 className="h-3 w-3" /> โหวตแล้ว · {myScore}★
              </span>
            ) : (
              <span
                data-testid="vote-status-badge"
                className="inline-flex items-center gap-1 rounded-md border border-[var(--gold)]/70 bg-background/85 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold)] shadow backdrop-blur"
                aria-label="คุณยังไม่ได้โหวตรูปนี้"
              >
                <CircleDashed className="h-3 w-3" /> ยังไม่ได้โหวต
              </span>
            )
          )}
        </div>
        {/* Milestone star row top-right (compact) */}
        {photo.milestone_stars > 0 && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/80 px-2 py-1 backdrop-blur">
            <StarRow count={photo.milestone_stars} size={10} />
          </div>
        )}
        {/* Bottom info strip */}
        <div
          data-testid="photo-card-bottom-strip"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2.5 py-2 text-xs text-white"
        >
          <span
            className="inline-flex items-center gap-1 font-semibold"
            aria-label={`คะแนนเฉลี่ย ${Number(photo.avg_score).toFixed(1)} จาก 5 ดาว`}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Skeleton className="h-3 w-[68px] rounded-sm bg-white/30" />
                <Skeleton className="h-3 w-6 rounded-sm bg-white/30" />
                <Skeleton className="h-3 w-6 rounded-sm bg-white/30" />
              </>
            ) : (
              <>
                <StarRow count={Math.round(Number(photo.avg_score))} size={12} />
                <span className="tabular-nums">{Number(photo.avg_score).toFixed(1)}</span>
                <span className="opacity-75">· {photo.vote_count}</span>
              </>
            )}
          </span>
          <span className="flex items-center gap-2 opacity-90">
            <span className="inline-flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {photo.view_count ?? 0}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {photo.comment_count ?? 0}
            </span>
          </span>
        </div>
        {/* Quick-vote stars overlay (visible on hover) */}
        <div
          className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center justify-center gap-1.5 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
          onMouseLeave={() => setHover(null)}
        >
          <div
            role="radiogroup"
            aria-label={voteGroupLabel}
            aria-disabled={hasVoted || busy || isOwner}
            aria-busy={busy}
            className="relative flex items-center gap-0.5 rounded-full bg-background/85 px-3 py-1.5 shadow-lg backdrop-blur"
          >
            {busy ? (
              [1, 2, 3, 4, 5].map((n) => (
                <span key={`quick-skel-${n}`} className="p-0.5" aria-hidden="true">
                  <Skeleton className="h-6 w-6 rounded-full" />
                </span>
              ))
            ) : [1, 2, 3, 4, 5].map((n) => {
              const filled = (hover ?? myScore ?? 0) >= n;
              const checked = myScore === n;
              return (
                <button
                  key={`quick-${n}`}
                  ref={(el) => { quickRefs.current[n - 1] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={hasVoted || busy || isOwner}
                  disabled={hasVoted || busy || isOwner}
                  onMouseEnter={() => !hasVoted && setHover(n)}
                  onFocus={() => !hasVoted && setHover(n)}
                  onKeyDown={(e) => handleQuickKey(e, n)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVote(n);
                  }}
                  className={cn(
                    "p-0.5 disabled:cursor-not-allowed",
                    busy && "opacity-40",
                  )}
                  aria-label={`ให้ ${n} จาก 5 ดาว`}
                  title={
                    isOwner
                      ? "โหวตรูปตัวเองไม่ได้"
                      : busy
                        ? "กำลังบันทึกโหวต..."
                        : hasVoted
                          ? `คุณให้ ${myScore}★ แล้ว`
                          : `ให้ ${n} ดาว`
                  }
                >
                  <Star
                    aria-hidden="true"
                    className={cn(
                      "h-6 w-6 transition",
                      filled
                        ? "fill-[var(--gold)] text-[var(--gold)]"
                        : "text-muted-foreground/60",
                    )}
                  />
                </button>
              );
            })}
            {busy && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-background/60 backdrop-blur-sm"
              >
                <Loader2 className="h-4 w-4 animate-spin text-[var(--gold)]" />
              </span>
            )}
          </div>
          {busy ? (
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--gold)] shadow backdrop-blur"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              กำลังบันทึก {myScore}★
            </span>
          ) : !hasVoted && !isOwner && (
            <span
              aria-hidden="true"
              className="hidden rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground shadow backdrop-blur md:inline-block"
            >
              {hover != null ? `ให้ ${hover}★` : "แตะดาวเพื่อโหวต"}
            </span>
          )}
          <span
            role={errorMsg ? "alert" : "status"}
            aria-live={errorMsg ? "assertive" : "polite"}
            aria-atomic="true"
            className="sr-only"
          >
            {liveStatus}
          </span>
        </div>
      </Link>
      <div data-testid="photo-card-footer" className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">
          <Link
            to="/photo/$id"
            params={{ id: photo.id }}
            className="hover:text-[var(--gold)]"
          >
            {photo.title}
          </Link>
        </h3>
        {(isOwner || hasVoted) && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            by {photo.profiles?.display_name ?? "Anonymous"}
          </p>
        )}
        <div
          className="mt-2 flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100"
          onMouseLeave={() => setHover(null)}
          aria-label="ให้คะแนนรูปนี้"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover ?? myScore ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                disabled={hasVoted || busy || isOwner}
                onMouseEnter={() => !hasVoted && setHover(n)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote(n);
                }}
                className="p-0.5 disabled:cursor-not-allowed"
                aria-label={`ให้ ${n} ดาว`}
                title={
                  isOwner
                    ? "โหวตรูปตัวเองไม่ได้"
                    : hasVoted
                      ? `คุณให้ ${myScore}★ แล้ว`
                      : `ให้ ${n} ดาว`
                }
              >
                <Star
                  className={cn(
                    "h-5 w-5 transition",
                    filled
                      ? "fill-[var(--gold)] text-[var(--gold)]"
                      : "text-muted-foreground/50",
                  )}
                />
              </button>
            );
          })}
          {hasVoted && (
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold)]">
              โหวตแล้ว
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
