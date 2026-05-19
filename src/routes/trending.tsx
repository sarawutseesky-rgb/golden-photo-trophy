import { createFileRoute } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending — StarShot" },
      { name: "description", content: "Photos with the most engagement right now." },
    ],
  }),
  component: TrendingPage,
});

function TrendingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trending</h1>
        <p className="mt-1 text-muted-foreground">Photos drawing the most votes right now.</p>
      </div>
      <InfinitePhotoFeed queryKey={["trending"]} params={{ sort: "trending" }} />
    </div>
  );
}