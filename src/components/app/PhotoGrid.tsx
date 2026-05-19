import { PhotoCard, type FeedPhoto } from "./PhotoCard";

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
          className={`${aspects[i % aspects.length]} animate-pulse rounded-xl bg-muted break-inside-avoid`}
        />
      ))}
    </div>
  );
}