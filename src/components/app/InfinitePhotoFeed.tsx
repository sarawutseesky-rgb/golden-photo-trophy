import { useEffect, useRef, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeed } from "@/lib/photos.functions";
import { PhotoCard, type FeedPhoto } from "./PhotoCard";
import { PhotoGridSkeleton } from "./PhotoGrid";
import { EmptyState } from "./EmptyState";

const PAGE_SIZE = 24;

type FeedParams = {
  sort?: "new" | "top" | "hof" | "trending" | "votes";
  tag?: string;
  range?: "all" | "day" | "week" | "month" | "year";
  following_of?: string | null;
};

export function InfinitePhotoFeed({
  queryKey,
  params,
  enabled = true,
  emptyState,
}: {
  queryKey: unknown[];
  params: FeedParams;
  enabled?: boolean;
  emptyState?: ReactNode;
}) {
  const fn = useServerFn(listFeed);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["feed-infinite", ...queryKey],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fn({ data: { ...params, limit: PAGE_SIZE, offset: pageParam as number } }),
    getNextPageParam: (last, all) => {
      const got = last?.photos?.length ?? 0;
      if (got < PAGE_SIZE) return undefined;
      return all.reduce((s, p) => s + (p.photos?.length ?? 0), 0);
    },
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  if (query.isLoading) return <PhotoGridSkeleton count={12} />;

  const photos: FeedPhoto[] = (query.data?.pages ?? []).flatMap((p) => p?.photos ?? []);

  if (photos.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <EmptyState
        variant="upload"
        title="ยังไม่มีรูปในฟีดนี้"
        description="เป็นคนแรกที่อัปโหลด แล้วให้ชุมชนได้โหวตให้คะแนน"
        actions={[
          { kind: "link", to: "/upload", label: "อัปโหลดรูปแรกของคุณ", primary: true },
        ]}
      />
    );
  }

  return (
    <div>
      <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-4">
        {photos.map((p) => (
          <PhotoCard key={p.id} photo={p} />
        ))}
      </div>
      {query.hasNextPage && (
        <div ref={sentinelRef} className="mt-4">
          <PhotoGridSkeleton count={6} />
        </div>
      )}
      {!query.hasNextPage && photos.length > PAGE_SIZE && (
        <p className="mt-8 text-center text-sm text-muted-foreground">— จบฟีดแล้ว —</p>
      )}
    </div>
  );
}
