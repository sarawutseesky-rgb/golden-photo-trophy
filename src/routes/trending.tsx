import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeed } from "@/lib/photos.functions";
import { PhotoGrid } from "@/components/app/PhotoGrid";

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
  const fn = useServerFn(listFeed);
  const { data } = useQuery({ queryKey: ["feed", "trending"], queryFn: () => fn({ data: { sort: "trending" } }) });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trending</h1>
        <p className="mt-1 text-muted-foreground">Photos drawing the most votes right now.</p>
      </div>
      <PhotoGrid photos={data?.photos ?? []} />
    </div>
  );
}