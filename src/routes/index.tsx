import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";
import { FeedFilterBar, type FeedTab, type FeedSort } from "@/components/app/FeedFilterBar";
import { SpotlightHero } from "@/components/app/SpotlightHero";
import { EmptyState } from "@/components/app/EmptyState";

const feedSearchSchema = z.object({
  tab: fallback(
    z.enum(["latest", "trending", "top-day", "top-week", "top-month", "top-year", "following"]),
    "latest",
  ).default("latest"),
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
  let range: "all" | "day" | "week" | "month" | "year" = "all";
  let following_of: string | null = null;

  if (tab === "trending") backendSort = "trending";
  else if (tab === "top-day") {
    backendSort = "top";
    range = "day";
  }
  else if (tab === "top-week") {
    backendSort = "top";
    range = "week";
  }
  else if (tab === "top-month") {
    backendSort = "top";
    range = "month";
  }
  else if (tab === "top-year") {
    backendSort = "top";
    range = "year";
  }
  else if (tab === "following") {
    following_of = userId;
  }

  // Sort override (only when user explicitly picks something other than the default for this tab)
  if (sort === "score") backendSort = "top";
  else if (sort === "votes") backendSort = "votes";
  else if (
    sort === "new" &&
    tab !== "trending" &&
    tab !== "top-day" &&
    tab !== "top-week" &&
    tab !== "top-month" &&
    tab !== "top-year"
  )
    backendSort = "new";

  return { sort: backendSort, range, tag, following_of };
}

function HomePage() {
  const { user } = useAuth();
  const { tab, sort, tag } = Route.useSearch();
  const params = buildFeedParams(tab, sort, tag, user?.id ?? null);

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Latest shots</h1>
        <p className="mt-1 text-muted-foreground">Vote 1–5 stars. Photos that hold #1 earn permanent milestone stars.</p>
      </div>
      <SpotlightHero />
      <FeedFilterBar tab={tab} sort={sort} tag={tag} />
      {tab === "following" && !user ? (
        <EmptyState
          variant="follow"
          title="ติดตามช่างภาพที่คุณชอบ"
          description="เข้าสู่ระบบเพื่อสร้างฟีดส่วนตัวจากผู้ที่คุณติดตาม และไม่พลาดรูปใหม่ ๆ"
          actions={[
            { kind: "link", to: "/login", label: "เริ่มโหวต / เข้าสู่ระบบ", primary: true },
            { kind: "link", to: "/signup", label: "สมัครสมาชิก" },
          ]}
        />
      ) : (
        <InfinitePhotoFeed
          queryKey={[tab, sort, tag ?? null, params.following_of ?? null]}
          params={params}
          enabled={tab !== "following" || !!user}
          emptyState={
            !user ? (
              <EmptyState
                variant="vote"
                title="ยังไม่มีรูปให้ดูตอนนี้"
                description="เข้าสู่ระบบเพื่อเริ่มโหวตและอัปโหลดรูปของคุณเองให้ชุมชน"
                actions={[
                  { kind: "link", to: "/login", label: "เริ่มโหวต", primary: true },
                  { kind: "link", to: "/signup", label: "สมัครสมาชิก" },
                ]}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}