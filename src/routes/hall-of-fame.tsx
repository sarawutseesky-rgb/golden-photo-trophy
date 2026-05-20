import { createFileRoute } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";
import { CollectionPageSkeleton } from "@/components/app/CollectionPageSkeleton";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — SEESTAR" },
      { name: "description", content: "Celebrating SEESTAR photos that earned three or more milestone stars by repeatedly holding the #1 spot." },
      { property: "og:title", content: "Hall of Fame — SEESTAR" },
      { property: "og:description", content: "Celebrating SEESTAR photos that earned three or more milestone stars by repeatedly holding the #1 spot." },
      { property: "og:url", content: "https://golden-photo-trophy.lovable.app/hall-of-fame" },
    ],
    links: [
      { rel: "canonical", href: "https://golden-photo-trophy.lovable.app/hall-of-fame" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Hall of Fame",
          url: "https://golden-photo-trophy.lovable.app/hall-of-fame",
          description: "SEESTAR photos that earned three or more milestone stars.",
        }),
      },
    ],
  }),
  component: HoFPage,
});

function HoFPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="mt-1 text-muted-foreground">Photos that earned 3★ or more.</p>
      </div>
      <InfinitePhotoFeed
        queryKey={["hof"]}
        params={{ sort: "hof" }}
        renderLoading={() => (
          <CollectionPageSkeleton titleWidth="180px" descWidth="240px" />
        )}
      />
    </div>
  );
}