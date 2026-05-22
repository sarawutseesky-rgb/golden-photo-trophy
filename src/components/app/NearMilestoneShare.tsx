import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Facebook, Twitter, Link2, Share2, Flame, Clock } from "lucide-react";
import { toast } from "sonner";
import { getNearMilestonePhotos } from "@/lib/photos.functions";
import { StarRow } from "./StarRow";

function formatRemaining(h: number) {
  if (h < 1) return "<1h";
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function photoUrl(id: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/photo/${id}`;
  }
  return `https://photostarshot.com/photo/${id}`;
}

function ShareRow({ id, title, stars }: { id: string; title: string; stars: number }) {
  const url = photoUrl(id);
  const text = `ช่วยโหวตรูปนี้ขึ้น ${stars + 1}★ บน SEESTAR — "${title}"`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const tw = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const line = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  const open = (href: string) => {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w) w.opener = null;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("คัดลอกลิงก์แชร์แล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  };

  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => open(fb)} aria-label="Share on Facebook" className={btn}>
        <Facebook className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => open(tw)} aria-label="Share on X" className={btn}>
        <Twitter className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => open(line)}
        aria-label="Share on LINE"
        className={btn + " hover:!bg-[#06C755] hover:!text-white"}
      >
        <span className="text-[9px] font-bold">LINE</span>
      </button>
      <button type="button" onClick={copy} aria-label="Copy link" className={btn}>
        <Link2 className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={nativeShare} aria-label="More share" className={btn + " sm:hidden"}>
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function NearMilestoneShare() {
  const fn = useServerFn(getNearMilestonePhotos);
  const { data, isLoading } = useQuery({
    queryKey: ["near-milestone-photos"],
    queryFn: () => fn(),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return <div className="mb-6 h-44 animate-pulse rounded-2xl border border-border bg-card" />;
  }
  const photos = (data?.photos ?? []) as any[];
  if (photos.length === 0) return null;

  return (
    <section
      aria-label="ช่วยเพื่อนขึ้น milestone ถัดไป"
      className="mb-6 overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-background to-background"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider">ใกล้ได้ดาวถัดไป</h2>
            <p className="text-[11px] text-muted-foreground">แชร์เพื่อช่วยเพื่อนขึ้น milestone ก่อนหมดเวลา</p>
          </div>
        </div>
        <span className="hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:inline">
          {photos.length} รูป
        </span>
      </header>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:px-5">
        {photos.map((p) => {
          const stars = p.milestone_stars ?? 0;
          const remaining = p._remainingHours ?? 0;
          return (
            <article
              key={p.id}
              className="group flex w-[260px] flex-shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-orange-500/50"
            >
              <Link
                to="/photo/$id"
                params={{ id: p.id }}
                className="relative block aspect-[4/3] overflow-hidden"
              >
                <img
                  src={p.image_url}
                  alt={p.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-orange-500/95 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  <Clock className="h-3 w-3" />
                  เหลือ {formatRemaining(remaining)}
                </span>
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold)] shadow backdrop-blur">
                  {stars}★ → {stars + 1}★
                </span>
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <Link
                  to="/photo/$id"
                  params={{ id: p.id }}
                  className="line-clamp-1 text-sm font-semibold hover:text-[var(--gold)]"
                >
                  {p.title}
                </Link>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <StarRow count={Math.round(Number(p.avg_score))} size={10} />
                    <span className="tabular-nums">{Number(p.avg_score).toFixed(1)}</span>
                    <span>· {p.vote_count}</span>
                  </span>
                  <span className="truncate">by {p.profiles?.display_name ?? "Anonymous"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
                    แชร์ช่วยขึ้น {stars + 1}★
                  </span>
                  <ShareRow id={p.id} title={p.title} stars={stars} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
