import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { castVote } from "@/lib/votes.functions";
import { useAuth } from "@/lib/auth-context";
import { cn, normalizeDistribution } from "@/lib/utils";
import { StarRow } from "./StarRow";

export type FeedPhoto = {
  id: string;
  title: string;
  image_url: string;
  avg_score: number;
  vote_count: number;
  milestone_stars: number;
  user_id?: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

export function PhotoCard({ photo }: { photo: FeedPhoto }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const vote = useServerFn(castVote);
  const [hover, setHover] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = !!user && photo.user_id === user.id;
  const hasVoted = myScore != null;

  const handleVote = async (score: number) => {
    if (!user) return toast.error("เข้าสู่ระบบเพื่อโหวต");
    if (isOwner) return toast.error("โหวตรูปตัวเองไม่ได้");
    if (hasVoted || busy) return;
    setBusy(true);
    setMyScore(score);

    // Snapshot current caches for rollback
    const prevFeeds = qc.getQueriesData<any>({ queryKey: ["feed"] });
    const photoKey = ["photo", photo.id] as const;
    const prevPhoto = qc.getQueryData<any>(photoKey);

    // Optimistic update on feed caches
    qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
      if (!old?.photos) return old;
      return {
        ...old,
        photos: old.photos.map((ph: any) => {
          if (ph.id !== photo.id) return ph;
          const oldCount = ph.vote_count ?? 0;
          const oldAvg = Number(ph.avg_score ?? 0);
          const newCount = oldCount + 1;
          const newAvg = newCount > 0 ? Number(((oldAvg * oldCount + score) / newCount).toFixed(2)) : 0;
          return { ...ph, vote_count: newCount, avg_score: newAvg };
        }),
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
      toast.success(`ให้ ${score}★ แล้ว`);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: photoKey });
    } catch (e: any) {
      setMyScore(null);
      // Rollback
      prevFeeds.forEach(([key, data]) => qc.setQueryData(key, data));
      qc.setQueryData(photoKey, prevPhoto);
      toast.error(e.message ?? "โหวตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card transition hover:border-[var(--gold)]/60">
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
          className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/80 px-2 py-1 backdrop-blur">
          <StarRow count={photo.milestone_stars} size={12} />
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur">
          ★ {Number(photo.avg_score).toFixed(1)}{" "}
          <span className="text-muted-foreground">· {photo.vote_count}</span>
        </div>
      </Link>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">
          <Link
            to="/photo/$id"
            params={{ id: photo.id }}
            className="hover:text-[var(--gold)]"
          >
            {photo.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          by {photo.profiles?.display_name ?? "Anonymous"}
        </p>
        <div
          className="mt-2 flex items-center gap-0.5"
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
