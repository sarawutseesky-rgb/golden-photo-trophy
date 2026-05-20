import { PhotoGridSkeleton } from "./PhotoGrid";

export function CollectionPageSkeleton({
  titleWidth = "180px",
  descWidth = "260px",
}: {
  titleWidth?: string;
  descWidth?: string;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="space-y-2">
        <div
          className="h-9 max-w-full rounded shimmer"
          style={{ width: titleWidth }}
        />
        <div
          className="h-5 max-w-full rounded shimmer"
          style={{ width: descWidth }}
        />
      </div>
      <PhotoGridSkeleton count={12} />
    </div>
  );
}
