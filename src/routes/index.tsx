import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeed } from "@/lib/photos.functions";
import { PhotoGrid } from "@/components/app/PhotoGrid";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StarShot — Latest photos" },
      { name: "description", content: "Newest photos from the StarShot community." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const fn = useServerFn(listFeed);
  const { data, isLoading } = useQuery({
    queryKey: ["feed", "new"],
    queryFn: () => fn({ data: { sort: "new" } }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Latest shots</h1>
        <p className="mt-1 text-muted-foreground">Vote 1–5 stars. Photos that hold #1 earn permanent milestone stars.</p>
      </div>
      {isLoading ? <Skeleton /> : <PhotoGrid photos={data?.photos ?? []} />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}