import { createFileRoute } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";

export const Route = createFileRoute("/top")({
  head: () => ({
    meta: [
      { title: "Top rated — SEESTAR" },
      { name: "description", content: "Highest-rated photos with at least 10 votes." },
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
      <InfinitePhotoFeed queryKey={["top"]} params={{ sort: "top" }} />
    </div>
  );
}