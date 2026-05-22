import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Camera, Sparkles, Star, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { getFeaturedPhotographer } from "@/lib/photos.functions";
import { getFollowStats, followUser, unfollowUser } from "@/lib/follows.functions";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export function FeaturedPhotographer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(getFeaturedPhotographer);
  const { data, isLoading } = useQuery({
    queryKey: ["featured-photographer"],
    queryFn: () => fn(),
    staleTime: 10 * 60_000,
  });

  const featuredId = data?.profile?.id ?? null;

  const statsFn = useServerFn(getFollowStats);
  const { data: follow } = useQuery({
    queryKey: ["follow-stats", featuredId, user?.id ?? null],
    queryFn: () => statsFn({ data: { id: featuredId!, viewerId: user?.id ?? null } }),
    enabled: !!featuredId,
    staleTime: 60_000,
  });

  const followFn = useServerFn(followUser);
  const unfollowFn = useServerFn(unfollowUser);

  if (isLoading) {
    return <div className="mb-6 h-44 animate-pulse rounded-2xl border border-border bg-card" />;
  }
  if (!data?.profile) return null;

  const profile = data.profile;
  const stats = data.stats!;
  const topPhotos = data.photos ?? [];
  const isSelf = user?.id === profile.id;
  const isFollowing = !!follow?.isFollowing;

  const toggleFollow = async () => {
    if (!user) return toast.error("เข้าสู่ระบบเพื่อติดตาม");
    if (isSelf) return;
    const wasFollowing = isFollowing;
    qc.setQueryData(["follow-stats", profile.id, user.id], (prev: any) => ({
      ...(prev ?? { followers: 0, following: 0 }),
      isFollowing: !wasFollowing,
      followers: (prev?.followers ?? data.followers ?? 0) + (wasFollowing ? -1 : 1),
    }));
    try {
      if (wasFollowing) await unfollowFn({ data: { target_id: profile.id } });
      else await followFn({ data: { target_id: profile.id } });
      qc.invalidateQueries({ queryKey: ["follow-stats", profile.id] });
      toast.success(wasFollowing ? "เลิกติดตามแล้ว" : `ติดตาม ${profile.display_name} แล้ว`);
    } catch (e: any) {
      qc.setQueryData(["follow-stats", profile.id, user.id], (prev: any) => ({
        ...(prev ?? { followers: 0, following: 0 }),
        isFollowing: wasFollowing,
        followers: (prev?.followers ?? 0) + (wasFollowing ? 1 : -1),
      }));
      toast.error(e?.message ?? "ดำเนินการไม่สำเร็จ");
    }
  };

  const followers = follow?.followers ?? data.followers ?? 0;

  return (
    <section
      aria-label="Featured photographer of the week"
      className="mb-6 overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold)]/8 via-background to-background"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--gold)]">
            <Sparkles className="h-3 w-3" />
            Photographer of the Week
          </div>

          <div className="flex items-start gap-4">
            <Link to="/profile/$id" params={{ id: profile.id }} aria-label={`ดูโปรไฟล์ ${profile.display_name}`}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-16 w-16 rounded-full border-2 border-[var(--gold)]/40 object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--gold)]/40 bg-muted text-xl font-bold sm:h-20 sm:w-20 sm:text-2xl">
                  {(profile.display_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                to="/profile/$id"
                params={{ id: profile.id }}
                className="truncate text-xl font-bold leading-tight hover:text-[var(--gold)] sm:text-2xl"
              >
                {profile.display_name}
              </Link>
              {profile.bio && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{profile.bio}</p>
              )}
              <span className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{followers}</span>{" "}
                ผู้ติดตาม
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-center">
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Camera className="h-3 w-3" /> รูป
              </div>
              <div className="text-lg font-black tabular-nums">{stats.photos_this_week}</div>
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Star className="h-3 w-3" /> โหวต
              </div>
              <div className="text-lg font-black tabular-nums">{stats.total_votes_this_week}</div>
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                <Sparkles className="h-3 w-3" /> ดาว
              </div>
              <div className="text-lg font-black tabular-nums text-[var(--gold)]">
                {stats.milestone_stars_this_week}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isSelf && (
              <button
                type="button"
                onClick={toggleFollow}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition",
                  isFollowing
                    ? "border border-border bg-background hover:bg-accent"
                    : "bg-[var(--gold)] text-background hover:brightness-110",
                )}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="h-4 w-4" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" /> Follow
                  </>
                )}
              </button>
            )}
            <Link
              to="/profile/$id"
              params={{ id: profile.id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold transition hover:bg-accent"
            >
              ดูโปรไฟล์
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 border-t border-border/60 bg-background/40 p-1 md:border-l md:border-t-0">
          {topPhotos.map((p: any) => (
            <Link
              key={p.id}
              to="/photo/$id"
              params={{ id: p.id }}
              className="group relative block aspect-square overflow-hidden rounded-md"
              aria-label={`ดูรูป ${p.title}`}
            >
              <img
                src={p.image_url}
                alt={p.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 py-1 text-[10px] text-white">
                <span className="inline-flex items-center gap-0.5 font-semibold">
                  <Star className="h-2.5 w-2.5 fill-[var(--gold)] text-[var(--gold)]" />
                  {Number(p.avg_score).toFixed(1)}
                </span>
                {p.milestone_stars > 0 && (
                  <span className="font-bold text-[var(--gold)]">{p.milestone_stars}★</span>
                )}
              </div>
            </Link>
          ))}
          {topPhotos.length === 0 && (
            <div className="col-span-3 grid place-items-center p-8 text-xs text-muted-foreground">
              ยังไม่มีรูปจากช่างภาพคนนี้
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
