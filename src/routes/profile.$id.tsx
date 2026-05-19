import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getUserProfile } from "@/lib/photos.functions";
import { getFollowStats, followUser, unfollowUser } from "@/lib/follows.functions";
import { StarRow } from "@/components/app/StarRow";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({ meta: [{ title: "Profile — StarShot" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(getUserProfile);
  const statsFn = useServerFn(getFollowStats);
  const followFn = useServerFn(followUser);
  const unfollowFn = useServerFn(unfollowUser);
  const { data, isLoading } = useQuery({ queryKey: ["profile", id], queryFn: () => fn({ data: { id } }) });
  const { data: follow } = useQuery({
    queryKey: ["follow-stats", id, user?.id ?? null],
    queryFn: () => statsFn({ data: { id, viewerId: user?.id ?? null } }),
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!data?.profile) return <div className="py-12 text-center text-muted-foreground">Profile not found.</div>;

  const isSelf = user?.id === id;
  const onToggleFollow = async () => {
    if (!user) {
      toast.error("กรุณาเข้าสู่ระบบก่อนติดตาม");
      return;
    }
    const wasFollowing = !!follow?.isFollowing;
    qc.setQueryData(["follow-stats", id, user.id], (prev: any) => ({
      ...(prev ?? { followers: 0, following: 0 }),
      isFollowing: !wasFollowing,
      followers: (prev?.followers ?? 0) + (wasFollowing ? -1 : 1),
    }));
    try {
      if (wasFollowing) await unfollowFn({ data: { target_id: id } });
      else await followFn({ data: { target_id: id } });
      qc.invalidateQueries({ queryKey: ["follow-stats", id] });
    } catch (err: any) {
      qc.setQueryData(["follow-stats", id, user.id], (prev: any) => ({
        ...(prev ?? {}),
        isFollowing: wasFollowing,
        followers: (prev?.followers ?? 0) + (wasFollowing ? 1 : -1),
      }));
      toast.error(err.message || "ทำรายการไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-5">
        {data.profile.avatar_url ? (
          <img
            src={data.profile.avatar_url}
            alt={data.profile.display_name}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground ring-2 ring-border">
            {data.profile.display_name?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{data.profile.display_name}</h1>
          {data.profile.bio && <p className="mt-1 text-sm text-muted-foreground">{data.profile.bio}</p>}
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span><span className="font-bold">{follow?.followers ?? 0}</span> <span className="text-muted-foreground">Followers</span></span>
            <span><span className="font-bold">{follow?.following ?? 0}</span> <span className="text-muted-foreground">Following</span></span>
          </div>
        </div>
        {!isSelf && user && (
          <button
            onClick={onToggleFollow}
            className={
              "rounded-full px-5 py-2 text-sm font-semibold transition-colors " +
              (follow?.isFollowing
                ? "border border-input bg-background hover:bg-accent"
                : "bg-primary text-primary-foreground hover:opacity-90")
            }
          >
            {follow?.isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Photos" value={data.stats!.total_photos} />
        <Stat label="Total views" value={data.stats!.total_views ?? 0} />
        <Stat label="Votes received" value={data.stats!.total_votes} />
        <Stat label="Total stars" value={data.stats!.total_stars} gold />
        <Stat label="Highest score" value={data.stats!.highest_score.toFixed(1)} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Photos</h2>
        {data.photos.length === 0 ? (
          <p className="text-muted-foreground">No photos uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.photos.map((p: any) => (
              <Link key={p.id} to="/photo/$id" params={{ id: p.id }} className="relative block overflow-hidden rounded-lg">
                <img src={p.image_url} alt={p.title} className="aspect-square w-full object-cover" />
                <div className="absolute right-1 top-1 rounded bg-background/80 px-1.5 py-0.5 backdrop-blur">
                  <StarRow count={p.milestone_stars} size={10} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: number | string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-1 text-2xl font-bold " + (gold ? "text-[var(--gold)]" : "")}>{value}</div>
    </div>
  );
}