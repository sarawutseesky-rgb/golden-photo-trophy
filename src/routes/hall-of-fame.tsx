import { createFileRoute } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="mt-1 text-muted-foreground">Photos that earned 3★ or more.</p>
      </div>
      <InfinitePhotoFeed queryKey={["hof"]} params={{ sort: "hof" }} />
    </div>
  );
}