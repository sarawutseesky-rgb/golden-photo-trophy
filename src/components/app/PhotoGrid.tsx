import { PhotoCard, type FeedPhoto } from "./PhotoCard";
import { Star } from "lucide-react";

const MASONRY_COLS =
  "columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 [&>*]:mb-4";

export function PhotoGrid({ photos }: { photos: FeedPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
        No photos yet — be the first to upload ✨
      </div>
    );
  }
  return (
    <div className={MASONRY_COLS}>
      {photos.map((p) => (
        <PhotoCard key={p.id} photo={p} />
      ))}
    </div>
  );
}

export function PhotoGridSkeleton({ count = 8 }: { count?: number }) {
  // Varied aspect ratios so masonry feels natural while loading
  const aspects = ["aspect-[3/4]", "aspect-[4/5]", "aspect-square", "aspect-[2/3]", "aspect-[4/3]"];
  return (
    <div className={MASONRY_COLS} aria-busy="true" aria-label="กำลังโหลดรูปภาพ">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-testid="photo-card-skeleton"
          className="break-inside-avoid overflow-hidden rounded-xl border border-border bg-card"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Image area with reserved bottom info strip (stars + score) */}
          <div className={`relative ${aspects[i % aspects.length]} shimmer`}>
            {/* Bottom strip — mirror PhotoCard: text-xs (line-height 1rem) + py-2 + gap-2 */}
            <div
              data-testid="photo-card-bottom-strip"
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-2.5 py-2 text-xs"
            >
              {/* Left: 5-star row + avg score + vote count — sized to match real <StarRow size={12}/> + tabular text */}
              <span className="inline-flex h-4 items-center gap-1 font-semibold leading-none">
                <span className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star
                      key={k}
                      className="h-3 w-3 text-white/40"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="inline-block h-3 w-6 rounded bg-white/45" />
                <span className="inline-block h-3 w-8 rounded bg-white/30" />
              </span>
              {/* Right: eye + comment counters (icon + number) */}
              <span className="flex h-4 items-center gap-2 leading-none opacity-90">
                <span className="inline-flex items-center gap-0.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-white/35" />
                  <span className="inline-block h-3 w-5 rounded bg-white/30" />
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-white/35" />
                  <span className="inline-block h-3 w-5 rounded bg-white/30" />
                </span>
              </span>
            </div>
          </div>
          {/* Footer: title + author — matches real card's p-3 block (text-sm + text-xs) */}
          <div data-testid="photo-card-footer" className="space-y-2 p-3">
            <div className="h-[18px] w-3/4 rounded shimmer" />
            <div className="h-4 w-1/2 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}