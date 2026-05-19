import { PhotoCard, type FeedPhoto } from "./PhotoCard";

export function PhotoGrid({ photos }: { photos: FeedPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
        No photos yet — be the first to upload ✨
      </div>
    );
  }
  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-4">
      {photos.map((p) => (
        <PhotoCard key={p.id} photo={p} />
      ))}
    </div>
  );
}