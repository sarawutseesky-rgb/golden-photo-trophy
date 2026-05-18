import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeed } from "@/lib/photos.functions";
import { PhotoGrid } from "@/components/app/PhotoGrid";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — StarShot" },
      { name: "description", content: "Photos that earned three or more milestone stars." },
    ],
  }),
  component: HoFPage,
});

function HoFPage() {
  const fn = useServerFn(listFeed);
  const { data } = useQuery({ queryKey: ["feed", "hof"], queryFn: () => fn({ data: { sort: "hof" } }) });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="mt-1 text-muted-foreground">Photos that earned 3★ or more.</p>
      </div>
      <PhotoGrid photos={data?.photos ?? []} />
    </div>
  );
}