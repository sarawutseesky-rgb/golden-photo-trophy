import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Share2, Flag, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getPhoto, reportPhoto } from "@/lib/photos.functions";
import { castVote, getMyVote, addComment, removeVote } from "@/lib/votes.functions";
import { useAuth } from "@/lib/auth-context";
import { StarRow } from "@/components/app/StarRow";
import { THRESHOLDS_DAYS, nextMilestoneProgress } from "@/lib/milestone";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

export const Route = createFileRoute("/photo/$id")({
  head: () => ({ meta: [{ title: "Photo — StarShot" }] }),
  component: PhotoDetail,
});

function PhotoDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchPhoto = useServerFn(getPhoto);
  const fetchVote = useServerFn(getMyVote);
  const vote = useServerFn(castVote);
  const unvote = useServerFn(removeVote);
  const comment = useServerFn(addComment);
  const report = useServerFn(reportPhoto);

  const { data, isLoading } = useQuery({ queryKey: ["photo", id], queryFn: () => fetchPhoto({ data: { id } }) });
  const { data: myVote } = useQuery({
    queryKey: ["my-vote", id, user?.id],
    queryFn: () => fetchVote({ data: { photo_id: id } }),
    enabled: !!user,
  });

  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel(`photo:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `photo_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["photo", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!data?.photo) return <div className="py-12 text-center text-muted-foreground">Photo not found.</div>;

  const p = data.photo as any;
  const isOwner = user?.id === p.user_id;
  const hasVoted = myVote?.score != null;
  const total = data.distribution.reduce((a: number, b: number) => a + b, 0) || 1;
  const progress = nextMilestoneProgress(p.milestone_stars, p.rank_one_since);

  const handleVote = async (score: number) => {
    if (!user) return toast.error("Sign in to vote");
    const photoKey = ["photo", id];
    const voteKey = ["my-vote", id, user.id];
    const prevPhoto = qc.getQueryData<any>(photoKey);
    const prevVote = qc.getQueryData<any>(voteKey);
    // Optimistic update — apply new vote to cached aggregates
    qc.setQueryData(voteKey, { score });
    if (prevPhoto?.photo) {
      const dist = [...prevPhoto.distribution];
      const oldScore = prevVote?.score as number | null | undefined;
      if (oldScore && oldScore >= 1 && oldScore <= 5) dist[oldScore - 1] = Math.max(0, dist[oldScore - 1] - 1);
      dist[score - 1] += 1;
      const newCount = dist.reduce((a, b) => a + b, 0);
      const sum = dist.reduce((acc, c, i) => acc + c * (i + 1), 0);
      const newAvg = newCount > 0 ? Number((sum / newCount).toFixed(2)) : 0;
      qc.setQueryData(photoKey, {
        ...prevPhoto,
        distribution: dist,
        photo: { ...prevPhoto.photo, vote_count: newCount, avg_score: newAvg },
      });
    }
    try {
      await vote({ data: { photo_id: id, score } });
      toast.success(`You rated ${score}★`);
      qc.invalidateQueries({ queryKey: photoKey });
      qc.invalidateQueries({ queryKey: voteKey });
    } catch (e: any) {
      // Roll back optimistic update on failure
      qc.setQueryData(photoKey, prevPhoto);
      qc.setQueryData(voteKey, prevVote);
      toast.error(e.message);
    }
  };

  const handleUnvote = async () => {
    if (!user) return;
    const photoKey = ["photo", id];
    const voteKey = ["my-vote", id, user.id];
    const prevPhoto = qc.getQueryData<any>(photoKey);
    const prevVote = qc.getQueryData<any>(voteKey);
    qc.setQueryData(voteKey, { score: null });
    if (prevPhoto?.photo && prevVote?.score) {
      const dist = [...prevPhoto.distribution];
      dist[prevVote.score - 1] = Math.max(0, dist[prevVote.score - 1] - 1);
      const newCount = dist.reduce((a, b) => a + b, 0);
      const sum = dist.reduce((acc, c, i) => acc + c * (i + 1), 0);
      const newAvg = newCount > 0 ? Number((sum / newCount).toFixed(2)) : 0;
      qc.setQueryData(photoKey, {
        ...prevPhoto,
        distribution: dist,
        photo: { ...prevPhoto.photo, vote_count: newCount, avg_score: newAvg },
      });
    }
    try {
      await unvote({ data: { photo_id: id } });
      toast.success("ยกเลิกการโหวตแล้ว");
      qc.invalidateQueries({ queryKey: photoKey });
      qc.invalidateQueries({ queryKey: voteKey });
    } catch (e: any) {
      qc.setQueryData(photoKey, prevPhoto);
      qc.setQueryData(voteKey, prevVote);
      toast.error(e.message);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    try {
      await comment({ data: { photo_id: id, content: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["photo", id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReport = async () => {
    if (!user) return toast.error("Sign in to report");
    const reason = prompt("Why are you reporting this photo?");
    if (!reason) return;
    try {
      await report({ data: { photo_id: id, reason } });
      toast.success("Reported. Thanks for keeping the community safe.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้า Feed
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{p.title}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
        <img src={p.image_url} alt={p.title} className="w-full rounded-xl border border-border" />
        <div>
          <h1 className="text-2xl font-bold">{p.title}</h1>
          {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
          {p.tags?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.tags.map((t: string) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comments</h2>
          {user && !isOwner && (
            <form onSubmit={handleComment} className="mb-4 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something nice…"
                maxLength={500}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button className="rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Post</button>
            </form>
          )}
          <ul className="space-y-3">
            {(data.comments as any[]).map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">
                  {c.profiles?.display_name ?? "Anonymous"} ·{" "}
                  <span title={new Date(c.created_at).toLocaleString()}>
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: th })}
                  </span>
                </div>
                <p className="mt-1 text-sm">{c.content}</p>
              </li>
            ))}
            {data.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
          </ul>
        </section>
        </div>

        <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          {hasVoted || isOwner ? (
            <Link
              to="/profile/$id"
              params={{ id: p.user_id }}
              className="flex items-center gap-3 text-sm hover:text-[var(--gold)]"
            >
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div>
                <div className="font-semibold">{p.profiles?.display_name}</div>
                <div
                  className="text-xs text-muted-foreground"
                  title={new Date(p.created_at).toLocaleString()}
                >
                  {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: th })}
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div>
                <div className="font-semibold text-muted-foreground">ผู้โพสต์ที่ไม่เปิดเผย</div>
                <div className="text-xs text-muted-foreground">
                  โหวตเพื่อดูว่าใครเป็นเจ้าของภาพ
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Rating</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{Number(p.avg_score).toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">/ 5 · {p.vote_count} votes</span>
          </div>

          {!isOwner && user && (
            <div className="mt-3">
              {hasVoted ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--gold)]"
                    data-testid="voted-badge"
                    aria-live="polite"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    คุณโหวตแล้ว · {myVote!.score}★
                  </div>
                  <button
                    type="button"
                    onClick={handleUnvote}
                    data-testid="unvote-button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    ยกเลิกโหวต
                  </button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">แตะดาวเพื่อให้คะแนน</div>
              )}
              <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(null)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    disabled={hasVoted}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => handleVote(n)}
                    className="disabled:cursor-not-allowed"
                    aria-label={`Rate ${n} stars`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition",
                        (hover ?? myVote?.score ?? 0) >= n
                          ? "fill-[var(--gold)] text-[var(--gold)]"
                          : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                ))}
              </div>
              <div
                className="mt-2 text-xs text-muted-foreground"
                aria-live="polite"
                data-testid="vote-summary"
              >
                เฉลี่ย{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {Number(p.avg_score).toFixed(1)}
                </span>{" "}
                ★ จาก{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {p.vote_count}
                </span>{" "}
                โหวต
              </div>
            </div>
          )}

          <div className="mt-4 space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const c = data.distribution[s - 1];
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-muted-foreground">{s}★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-[var(--gold)]"
                      style={{ width: `${(c / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{c}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Milestone stars</div>
          <StarRow count={p.milestone_stars} size={22} />
          {progress && (
            <div className="mt-3 text-xs text-muted-foreground">
              {progress.holding
                ? `Held #1 for ${progress.elapsedDays.toFixed(1)}d · next ★ at ${progress.nextDays}d`
                : `Reach #1 (min 10 votes) to start the clock toward ${THRESHOLDS_DAYS[p.milestone_stars]}d for your next ★`}
              {progress.holding && (
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-[var(--gold)]"
                    style={{ width: `${Math.min(100, (progress.elapsedDays / progress.nextDays) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied");
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <button
            onClick={handleReport}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs hover:bg-muted"
          >
            <Flag className="h-3.5 w-3.5" /> Report
          </button>
        </div>
        </aside>
      </div>
    </div>
  );
}