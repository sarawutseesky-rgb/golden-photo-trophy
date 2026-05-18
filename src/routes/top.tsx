import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeed } from "@/lib/photos.functions";
import { PhotoGrid } from "@/components/app/PhotoGrid";

export const Route = createFileRoute("/top")({
  head: () => ({
    meta: [
      { title: "Top rated — StarShot" },
      { name: "description", content: "Highest-rated photos with at least 10 votes." },
    ],
  }),
  component: TopPage,
});

function TopPage() {
  const fn = useServerFn(listFeed);
  const { data, isLoading } = useQuery({
    queryKey: ["feed", "top"],
    queryFn: () => fn({ data: { sort: "top" } }),
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Top rated</h1>
        <p className="mt-1 text-muted-foreground">Sorted by average score (min 10 votes).</p>
      </div>
      {isLoading ? null : <PhotoGrid photos={data?.photos ?? []} />}
    </div>
  );
}