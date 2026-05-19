import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { listFeed } from "@/lib/photos.functions";
import { PhotoGrid } from "@/components/app/PhotoGrid";
import { FeedFilterBar, type FeedTab, type FeedSort } from "@/components/app/FeedFilterBar";
import { SpotlightHero } from "@/components/app/SpotlightHero";

const feedSearchSchema = z.object({
  tab: fallback(z.enum(["latest", "trending", "top-week", "following"]), "latest").default("latest"),
  sort: fallback(z.enum(["new", "score", "votes"]), "new").default("new"),
  tag: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(feedSearchSchema),
  head: () => ({
    meta: [
      { title: "StarShot — Latest photos" },
      { name: "description", content: "Newest photos from the StarShot community." },
    ],
  }),
  component: HomePage,
});

function buildFeedParams(tab: FeedTab, sort: FeedSort, tag: string | undefined, userId: string | null) {
  // Base sort: tab determines default ordering, sort overrides if not "new"
  let backendSort: "new" | "top" | "trending" | "votes" = "new";
  let range: "all" | "week" = "all";
  let following_of: string | null = null;

  if (tab === "trending") backendSort = "trending";
  else if (tab === "top-week") {
    backendSort = "top";
    range = "week";
  } else if (tab === "following") {
    following_of = userId;
  }

  // Sort override (only when user explicitly picks something other than the default for this tab)
  if (sort === "score") backendSort = "top";
  else if (sort === "votes") backendSort = "votes";
  else if (sort === "new" && tab !== "trending" && tab !== "top-week") backendSort = "new";

  return { sort: backendSort, range, tag, following_of };
}

function HomePage() {
  const { user } = useAuth();
  const { tab, sort, tag } = Route.useSearch();
  const fn = useServerFn(listFeed);
  const params = buildFeedParams(tab, sort, tag, user?.id ?? null);
  const { data, isLoading } = useQuery({
    queryKey: ["feed", tab, sort, tag ?? null, params.following_of ?? null],
    queryFn: () => fn({ data: params }),
    enabled: tab !== "following" || !!user,
  });

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Latest shots</h1>
        <p className="mt-1 text-muted-foreground">Vote 1–5 stars. Photos that hold #1 earn permanent milestone stars.</p>
      </div>
      <SpotlightHero />
      <FeedFilterBar tab={tab} sort={sort} tag={tag} />
      {tab === "following" && !user ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground">
          <p>เข้าสู่ระบบเพื่อดูฟีดของคนที่คุณติดตาม</p>
          <Link to="/login" className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
            Login
          </Link>
        </div>
      ) : isLoading ? (
        <Skeleton />
      ) : (
        <PhotoGrid photos={data?.photos ?? []} />
      )}
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