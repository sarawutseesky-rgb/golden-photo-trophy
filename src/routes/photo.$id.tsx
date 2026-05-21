import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Star, Flag, ArrowLeft, ArrowRight, CheckCircle2, Pencil, Trash2, X, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPhoto, getAdjacentPhotos, reportPhoto, updatePhoto, deletePhoto } from "@/lib/photos.functions";
import { castVote, getMyVote, addComment, removeVote } from "@/lib/votes.functions";
import { incrementPhotoView } from "@/lib/follows.functions";
import { useAuth } from "@/lib/auth-context";
import { StarRow } from "@/components/app/StarRow";
import { VoteDistribution } from "@/components/app/VoteDistribution";
import { ExifInfo } from "@/components/app/ExifInfo";
import { ShareButtons } from "@/components/app/ShareButtons";
import { THRESHOLDS_HOURS, nextMilestoneProgress } from "@/lib/milestone";
import { supabase } from "@/integrations/supabase/client";
import { cn, normalizeDistribution } from "@/lib/utils";
import { applyOptimisticVote } from "@/lib/votes.helpers";
import { isDuplicateVoteMessage, toastDuplicateVote, toastVoteSuccess } from "@/lib/vote-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { ClientOnly } from "@tanstack/react-router";
const LightboxClient = lazy(async () => {
  const [{ default: Lightbox }, { default: Zoom }] = await Promise.all([
    import("yet-another-react-lightbox"),
    import("yet-another-react-lightbox/plugins/zoom"),
    import("yet-another-react-lightbox/styles.css"),
  ]);
  return {
    default: (props: React.ComponentProps<typeof Lightbox>) => (
      <Lightbox {...props} plugins={[Zoom, ...(props.plugins ?? [])]} />
    ),
  };
});

export const Route = createFileRoute("/photo/$id")({
  head: () => ({ meta: [{ title: "Photo — SEESTAR" }] }),
  component: PhotoDetail,
});

function PhotoDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchPhoto = useServerFn(getPhoto);
  const fetchAdjacent = useServerFn(getAdjacentPhotos);
  const fetchVote = useServerFn(getMyVote);
  const vote = useServerFn(castVote);
  const unvote = useServerFn(removeVote);
  const comment = useServerFn(addComment);
  const report = useServerFn(reportPhoto);
  const editPhoto = useServerFn(updatePhoto);
  const removePhoto = useServerFn(deletePhoto);
  const bumpView = useServerFn(incrementPhotoView);

  const { data, isLoading } = useQuery({ queryKey: ["photo", id], queryFn: () => fetchPhoto({ data: { id } }) });
  const { data: adjacent } = useQuery({
    queryKey: ["photo-adjacent", id],
    queryFn: () => fetchAdjacent({ data: { id } }),
  });
  const { data: myVote, isLoading: myVoteLoading } = useQuery({
    queryKey: ["my-vote", id, user?.id],
    queryFn: async () => {
      try {
        return await fetchVote({ data: { photo_id: id } });
      } catch {
        // Not authenticated (e.g. just logged out) — treat as no vote
        return { score: null };
      }
    },
    enabled: !!user,
    retry: false,
  });

  const [hover, setHover] = useState<number | null>(null);
  const [bouncedStar, setBouncedStar] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [debug, setDebug] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [debugLog, setDebugLog] = useState<
    Array<{ t: number; action: string; avg: number; count: number; latencyMs?: number }>
  >([]);

  const logDebug = (action: string, avg: number, count: number, latencyMs?: number) => {
    setDebugLog((prev) =>
      [{ t: Date.now(), action, avg, count, latencyMs }, ...prev].slice(0, 8),
    );
  };

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const THROTTLE_MS = 30 * 60 * 1000; // 30 นาที
    const key = `photo-view:${id}`;
    try {
      // กันซ้ำภายใน session (ครั้งเดียวต่อการเปิด tab)
      if (sessionStorage.getItem(key)) return;
      // กันซ้ำข้าม session ด้วย throttle 30 นาที
      const last = Number(localStorage.getItem(key) || 0);
      if (last && Date.now() - last < THROTTLE_MS) {
        sessionStorage.setItem(key, "1");
        return;
      }
      sessionStorage.setItem(key, "1");
      localStorage.setItem(key, String(Date.now()));
    } catch {
      // storage ไม่พร้อมใช้ (private mode ฯลฯ) — ปล่อยให้นับตามปกติ
    }
    bumpView({ data: { photo_id: id } }).catch(() => {});
  }, [id, bumpView]);

  useEffect(() => {
    setSwitching(false);
  }, [id]);

  // Prefetch adjacent photo data + preload images for instant navigation
  useEffect(() => {
    if (!adjacent) return;
    const targets = [adjacent.prev, adjacent.next].filter(Boolean) as Array<{ id: string; image_url?: string }>;
    targets.forEach((t) => {
      qc.prefetchQuery({
        queryKey: ["photo", t.id],
        queryFn: () => fetchPhoto({ data: { id: t.id } }),
        staleTime: 60_000,
      });
      qc.prefetchQuery({
        queryKey: ["photo-adjacent", t.id],
        queryFn: () => fetchAdjacent({ data: { id: t.id } }),
        staleTime: 60_000,
      });
      if (t.image_url && typeof window !== "undefined") {
        const img = new Image();
        img.decoding = "async";
        img.src = t.image_url;
      }
    });
  }, [adjacent, qc, fetchPhoto, fetchAdjacent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (switching) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (lightboxOpen || editOpen) return;
      if (e.key === "ArrowLeft" && adjacent?.prev) {
        e.preventDefault();
        setSwitching(true);
        navigate({ to: "/photo/$id", params: { id: adjacent.prev.id } });
      } else if (e.key === "ArrowRight" && adjacent?.next) {
        e.preventDefault();
        setSwitching(true);
        navigate({ to: "/photo/$id", params: { id: adjacent.next.id } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjacent?.prev?.id, adjacent?.next?.id, lightboxOpen, editOpen, navigate, switching]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-32 rounded-sm" />
          <Skeleton className="h-4 w-24 rounded-sm" />
        </div>
        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-8 w-2/3 rounded-sm" />
            <Skeleton className="h-4 w-1/2 rounded-sm" />
          </div>
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded-sm" />
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Rating</div>
              <div className="flex items-baseline gap-2" aria-busy="true">
                <Skeleton className="h-8 w-12 rounded-sm" />
                <Skeleton className="h-4 w-24 rounded-sm" />
              </div>
              <div className="mt-1 flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Skeleton key={`avg-skel-${n}`} className="h-[18px] w-[18px] rounded-full" />
                ))}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5" aria-hidden="true">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-3 w-12 rounded-sm" />
                <Skeleton className="h-3 w-6 rounded-sm" />
              </div>
              {user && (
                <div className="mt-3" aria-hidden="true">
                  <Skeleton className="h-4 w-32 rounded-sm" />
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Skeleton key={`qv-skel-${n}`} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5">
                    <Skeleton className="h-3 w-10 rounded-sm" />
                    <Skeleton className="h-3 w-8 rounded-sm" />
                    <Skeleton className="h-3 w-10 rounded-sm" />
                  </div>
                </div>
              )}
              <VoteDistribution distribution={[]} loading={true} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Milestone stars</div>
              <div className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Skeleton key={`ms-skel-${n}`} className="h-[22px] w-[22px] rounded-full" />
                ))}
              </div>
              <Skeleton className="h-3 w-full rounded-sm" />
            </div>
          </aside>
        </div>
      </div>
    );
  }
  if (!data?.photo) return <div className="py-12 text-center text-muted-foreground">Photo not found.</div>;

  const p = data.photo as any;
  const isOwner = user?.id === p.user_id;
  const hasVoted = myVote?.score != null;
  const normalizedDist = normalizeDistribution(data.distribution);
  const progress = nextMilestoneProgress(p.milestone_stars, p.created_at);

  const handleVote = async (score: number) => {
    if (!user || busy) return;
    if (isOwner) return toast.error("โหวตรูปตัวเองไม่ได้");
    const photoKey = ["photo", id];
    const voteKey = ["my-vote", id, user.id];
    const prevPhoto = qc.getQueryData<any>(photoKey);
    const prevVote = qc.getQueryData<any>(voteKey);
    const prevFeeds = qc.getQueriesData<any>({ queryKey: ["feed"] });
    const prevInfinite = qc.getQueriesData<any>({ queryKey: ["feed-infinite"] });

    setBusy(true);
    // Optimistic update — vote cache
    qc.setQueryData(voteKey, { score });

    // Optimistic update — detail cache
    if (prevPhoto?.photo) {
      const next = applyOptimisticVote(prevPhoto, score, prevVote?.score);
      qc.setQueryData(photoKey, next);
      if (debug) logDebug(`vote ${score}★ (optimistic)`, next.photo.avg_score, next.photo.vote_count);
    }

    // Optimistic update — feed caches
    const patchVote = (ph: any) => {
      if (!ph || ph.id !== id) return ph;
      const oldCount = ph.vote_count ?? 0;
      const oldAvg = Number(ph.avg_score ?? 0);
      const newCount = oldCount + 1;
      const newAvg = newCount > 0 ? Number(((oldAvg * oldCount + score) / newCount).toFixed(2)) : 0;
      return { ...ph, vote_count: newCount, avg_score: newAvg };
    };
    qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
      if (!old?.photos) return old;
      return { ...old, photos: old.photos.map(patchVote) };
    });
    qc.setQueriesData({ queryKey: ["feed-infinite"] }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) =>
          p?.photos ? { ...p, photos: p.photos.map(patchVote) } : p,
        ),
      };
    });

    const t0 = performance.now();
    try {
      await vote({ data: { photo_id: id, score } });
      {
        const cur = qc.getQueryData<any>(photoKey);
        const avg = Number(cur?.photo?.avg_score ?? p.avg_score ?? 0);
        const count = Number(cur?.photo?.vote_count ?? p.vote_count ?? 0);
        toastVoteSuccess(score, avg, count);
      }
      qc.invalidateQueries({ queryKey: photoKey });
      qc.invalidateQueries({ queryKey: voteKey });
      if (debug) {
        const cur = qc.getQueryData<any>(photoKey);
        logDebug(
          `vote ${score}★ (server ok)`,
          Number(cur?.photo?.avg_score ?? 0),
          Number(cur?.photo?.vote_count ?? 0),
          Math.round(performance.now() - t0),
        );
      }
    } catch (e: any) {
      // Roll back optimistic update on failure
      qc.setQueryData(photoKey, prevPhoto);
      qc.setQueryData(voteKey, prevVote);
      prevFeeds.forEach(([key, data]) => qc.setQueryData(key, data));
      prevInfinite.forEach(([key, data]) => qc.setQueryData(key, data));
      const msg = e?.message ?? "โหวตไม่สำเร็จ";
      if (isDuplicateVoteMessage(msg)) {
        const existing = prevVote?.score ?? null;
        const avg = Number(prevPhoto?.photo?.avg_score ?? p.avg_score ?? 0);
        const count = Number(prevPhoto?.photo?.vote_count ?? p.vote_count ?? 0);
        toastDuplicateVote(existing, avg, count);
        qc.invalidateQueries({ queryKey: photoKey });
        qc.invalidateQueries({ queryKey: voteKey });
      } else {
        toast.error(msg);
      }
      if (debug) logDebug(`vote ${score}★ (rollback)`, Number(prevPhoto?.photo?.avg_score ?? 0), Number(prevPhoto?.photo?.vote_count ?? 0));
    } finally {
      setBusy(false);
    }
  };

  const handleUnvote = async () => {
    if (!user || busy) return;
    const photoKey = ["photo", id];
    const voteKey = ["my-vote", id, user.id];
    const prevPhoto = qc.getQueryData<any>(photoKey);
    const prevVote = qc.getQueryData<any>(voteKey);
    const prevFeeds = qc.getQueriesData<any>({ queryKey: ["feed"] });
    const prevInfinite = qc.getQueriesData<any>({ queryKey: ["feed-infinite"] });

    setBusy(true);
    qc.setQueryData(voteKey, { score: null });
    if (prevPhoto?.photo && prevVote?.score) {
      const dist = normalizeDistribution(prevPhoto.distribution);
      dist[prevVote.score - 1] = Math.max(0, dist[prevVote.score - 1] - 1);
      const newCount = dist.reduce((a, b) => a + b, 0);
      const sum = dist.reduce((acc, c, i) => acc + c * (i + 1), 0);
      const newAvg = newCount > 0 ? Number((sum / newCount).toFixed(2)) : 0;
      qc.setQueryData(photoKey, {
        ...prevPhoto,
        distribution: dist,
        photo: { ...prevPhoto.photo, vote_count: newCount, avg_score: newAvg },
      });
      if (debug) logDebug(`unvote (optimistic)`, newAvg, newCount);
    }

    // Optimistic update — feed caches
    const patchUnvote = (ph: any) => {
      if (!ph || ph.id !== id) return ph;
      const oldCount = ph.vote_count ?? 0;
      const oldAvg = Number(ph.avg_score ?? 0);
      const prevScore = prevVote?.score ?? 0;
      const newCount = Math.max(0, oldCount - 1);
      const newAvg = newCount > 0
        ? Number(((oldAvg * oldCount - prevScore) / newCount).toFixed(2))
        : 0;
      return { ...ph, vote_count: newCount, avg_score: newAvg };
    };
    qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
      if (!old?.photos) return old;
      return { ...old, photos: old.photos.map(patchUnvote) };
    });
    qc.setQueriesData({ queryKey: ["feed-infinite"] }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) =>
          p?.photos ? { ...p, photos: p.photos.map(patchUnvote) } : p,
        ),
      };
    });

    const t0 = performance.now();
    try {
      await unvote({ data: { photo_id: id } });
      toast.success("ยกเลิกการโหวตแล้ว");
      qc.invalidateQueries({ queryKey: photoKey });
      qc.invalidateQueries({ queryKey: voteKey });
      if (debug) {
        const cur = qc.getQueryData<any>(photoKey);
        logDebug(
          `unvote (server ok)`,
          Number(cur?.photo?.avg_score ?? 0),
          Number(cur?.photo?.vote_count ?? 0),
          Math.round(performance.now() - t0),
        );
      }
    } catch (e: any) {
      qc.setQueryData(photoKey, prevPhoto);
      qc.setQueryData(voteKey, prevVote);
      prevFeeds.forEach(([key, data]) => qc.setQueryData(key, data));
      prevInfinite.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e.message ?? "ยกเลิกโหวตไม่สำเร็จ");
      if (debug) logDebug(`unvote (rollback)`, Number(prevPhoto?.photo?.avg_score ?? 0), Number(prevPhoto?.photo?.vote_count ?? 0));
    } finally {
      setBusy(false);
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

  const openEdit = () => {
    setEditTitle(p.title ?? "");
    setEditDesc(p.description ?? "");
    setEditTags((p.tags ?? []).join(", "));
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 8);
      await editPhoto({
        data: { id, title: editTitle.trim(), description: editDesc.trim(), tags },
      });
      toast.success("บันทึกแล้ว");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["photo", id] });
    } catch (err: any) {
      toast.error(err.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("ลบรูปนี้ถาวร? ดำเนินการนี้ย้อนกลับไม่ได้")) return;
    try {
      await removePhoto({ data: { id } });
      toast.success("ลบรูปแล้ว");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <nav aria-label="Breadcrumb">
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
        <div className="flex items-center gap-1.5">
          {adjacent?.prev && !switching ? (
            <Link
              to="/photo/$id"
              params={{ id: adjacent.prev.id }}
              onClick={() => setSwitching(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              aria-label={`ภาพก่อนหน้า: ${adjacent.prev.title ?? ""}`}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> ก่อนหน้า
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border/50 px-2.5 py-1 text-xs opacity-50">
              <ArrowLeft className="h-3.5 w-3.5" /> ก่อนหน้า
            </span>
          )}
          {adjacent?.next && !switching ? (
            <Link
              to="/photo/$id"
              params={{ id: adjacent.next.id }}
              onClick={() => setSwitching(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              aria-label={`ภาพถัดไป: ${adjacent.next.title ?? ""}`}
            >
              ถัดไป <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border/50 px-2.5 py-1 text-xs opacity-50">
              ถัดไป <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-black/40 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          aria-label="เปิดดูรูปขนาดเต็ม"
        >
          <img
            src={p.image_url}
            alt={p.title}
            className={cn(
              "block h-auto max-h-[85vh] w-auto max-w-full object-contain transition group-hover:opacity-95",
              switching && "opacity-40 blur-sm",
            )}
          />
          {switching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)]" />
              <span className="text-sm font-medium text-foreground/90">กำลังโหลดภาพถัดไป…</span>
            </div>
          )}
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-background/70 px-2 py-1 text-[10px] uppercase tracking-wide text-foreground/80 opacity-0 backdrop-blur transition group-hover:opacity-100">
            คลิกเพื่อขยาย
          </span>
        </button>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-2xl font-bold">{p.title}</h1>
            {isOwner && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={openEdit}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> แก้ไข
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> ลบ
                </button>
              </div>
            )}
          </div>
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
          <div className="mt-4">
            <ShareButtons
              url={`https://photostarshot.com/photo/${id}`}
              title={p.title}
            />
          </div>
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
          {busy ? (
            <>
              <div className="flex items-baseline gap-2" aria-busy="true" aria-label="กำลังอัปเดตคะแนน">
                <Skeleton className="h-8 w-12 rounded-sm" />
                <Skeleton className="h-4 w-24 rounded-sm" />
              </div>
              <div className="mt-1 flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Skeleton key={`avg-skel-${n}`} className="h-[18px] w-[18px] rounded-full" />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{Number(p.avg_score).toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">/ 5 · {p.vote_count} votes</span>
              </div>
              <div
                className="mt-1"
                aria-label={`คะแนนเฉลี่ย ${Number(p.avg_score).toFixed(1)} จาก 5 ดาว`}
              >
                <StarRow count={Math.round(Number(p.avg_score))} size={18} />
              </div>
            </>
          )}

          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
            data-testid="view-count"
            aria-live="polite"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="tabular-nums font-semibold text-foreground">
              {Number(p.view_count ?? 0).toLocaleString()}
            </span>
            <span>วิว</span>
          </div>

          {!isOwner && user && (
            <div className="mt-3">
              {busy || myVoteLoading ? (
                <>
                  <Skeleton className="h-4 w-32 rounded-sm" aria-hidden="true" />
                  <div className="mt-1 flex gap-1" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Skeleton key={`vote-skel-${n}`} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5" aria-hidden="true">
                    <Skeleton className="h-3 w-10 rounded-sm" />
                    <Skeleton className="h-3 w-8 rounded-sm" />
                    <Skeleton className="h-3 w-10 rounded-sm" />
                  </div>
                </>
              ) : (
                <>
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
                        disabled={busy}
                        data-testid="unvote-button"
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        ยกเลิกโหวต
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">แตะดาวเพื่อให้คะแนน</div>
                  )}
                  <div
                    className="mt-1 flex gap-1"
                    onMouseLeave={() => setHover(null)}
                    aria-busy={busy}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <motion.button
                        key={n}
                        disabled={hasVoted || busy}
                        onMouseEnter={() => !hasVoted && !busy && setHover(n)}
                        onClick={() => {
                          setBouncedStar(n);
                          setTimeout(() => setBouncedStar(null), 400);
                          handleVote(n);
                        }}
                        className="disabled:cursor-not-allowed"
                        aria-label={`Rate ${n} stars`}
                        whileTap={{ scale: 0.85 }}
                        animate={
                          bouncedStar === n
                            ? { scale: [1, 1.5, 1], rotate: [0, 15, -15, 0] }
                            : { scale: 1, rotate: 0 }
                        }
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      >
                        <Star
                          className={cn(
                            "h-7 w-7 transition",
                            (hover ?? myVote?.score ?? 0) >= n
                              ? "fill-[var(--gold)] text-[var(--gold)]"
                              : "text-muted-foreground/40",
                          )}
                        />
                      </motion.button>
                    ))}
                  </div>
                  <div
                    className="mt-2 text-xs text-muted-foreground"
                    aria-live="polite"
                    data-testid="vote-summary"
                    aria-busy={busy}
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
                </>
              )}
              <button
                type="button"
                onClick={() => setDebug((d) => !d)}
                data-testid="toggle-debug"
                className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
              >
                {debug ? "ปิดโหมดดีบัก" : "โหมดดีบัก"}
              </button>
              {debug && (
                <div
                  className="mt-2 rounded-md border border-dashed border-border bg-muted/30 p-2 text-[11px]"
                  data-testid="debug-panel"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-muted-foreground">
                      cache → avg {Number(p.avg_score).toFixed(2)} · count {p.vote_count}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDebugLog([])}
                      disabled={debugLog.length === 0}
                      data-testid="clear-debug-log"
                      className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      ล้าง log
                    </button>
                  </div>
                  {debugLog.length === 0 ? (
                    <div className="text-muted-foreground">กดโหวตหรือยกเลิกเพื่อดู log</div>
                  ) : (
                    <ul className="space-y-0.5 font-mono">
                      {debugLog.map((e) => (
                        <li key={e.t} className="flex justify-between gap-2">
                          <span>
                            {new Date(e.t).toLocaleTimeString()} · {e.action}
                          </span>
                          <span className="tabular-nums">
                            {e.avg.toFixed(2)}★ / {e.count}
                            {e.latencyMs != null && ` · ${e.latencyMs}ms`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <VoteDistribution distribution={normalizedDist} busy={busy} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Milestone stars</div>
          <StarRow count={p.milestone_stars} size={22} />
          {progress && (
            <div className="mt-3 text-xs text-muted-foreground">
              {progress.elapsedHours.toFixed(progress.elapsedHours < 48 ? 0 : 1)}h since upload · next ★ at {progress.nextHours}h
              {" "}({THRESHOLDS_HOURS[p.milestone_stars] / 24}d)
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-[var(--gold)]"
                  style={{ width: `${progress.fraction * 100}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] opacity-70">
                Earned if no later upload outscores it at the checkpoint.
              </div>
            </div>
          )}
        </div>

        <ExifInfo exif={p.exif} />

        <button
          onClick={handleReport}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs hover:bg-muted"
        >
          <Flag className="h-3.5 w-3.5" /> Report
        </button>
        </aside>
      </div>
      {lightboxOpen && (
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <LightboxClient
              open={lightboxOpen}
              close={() => setLightboxOpen(false)}
              slides={[{ src: p.image_url, alt: p.title }]}
              carousel={{ finite: true }}
              zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true }}
              controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
              labels={{
                Previous: "ก่อนหน้า",
                Next: "ถัดไป",
                Close: "ปิด (Esc)",
                "Zoom in": "ซูมเข้า",
                "Zoom out": "ซูมออก",
              }}
              animation={{ fade: 200, swipe: 300 }}
            />
          </Suspense>
        </ClientOnly>
      )}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => !saving && setEditOpen(false)}
        >
          <form
            onSubmit={handleEditSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">แก้ไขรูป</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground"
                aria-label="ปิด"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อรูป</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={120}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">คำบรรยาย</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  แท็ก (คั่นด้วย , สูงสุด 8)
                </label>
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="เด็ก, ครอบครัว"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={saving}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving || !editTitle.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}