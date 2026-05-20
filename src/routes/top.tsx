import { createFileRoute } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";
import { CollectionPageSkeleton } from "@/components/app/CollectionPageSkeleton";

export const Route = createFileRoute("/top")({
  head: () => ({
    meta: [
      { title: "Top rated — SEESTAR" },
      { name: "description", content: "Discover the highest-rated photos on SEESTAR, sorted by average star score with a minimum of 10 community votes." },
      { property: "og:title", content: "Top rated photos — SEESTAR" },
      { property: "og:description", content: "Discover the highest-rated SEESTAR photos, sorted by average star score with at least 10 community votes." },
      { property: "og:url", content: "https://golden-photo-trophy.lovable.app/top" },
    ],
    links: [
      { rel: "canonical", href: "https://golden-photo-trophy.lovable.app/top" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Top rated photos",
          url: "https://golden-photo-trophy.lovable.app/top",
          description: "Highest-rated SEESTAR photos with at least 10 votes.",
        }),
      },
    ],
  }),
  component: TopPage,
});

function TopPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Top rated</h1>
        <p className="mt-1 text-muted-foreground">Sorted by average score (min 10 votes).</p>
      </div>
      <InfinitePhotoFeed
        queryKey={["top"]}
        params={{ sort: "top" }}
        renderLoading={() => (
          <CollectionPageSkeleton titleWidth="160px" descWidth="300px" />
        )}
      />
    </div>
  );
}