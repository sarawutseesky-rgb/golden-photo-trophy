import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeDistribution } from "@/lib/utils";

const PHOTO_BASE_SELECT = `
  id, user_id, title, description, tags, image_url, width, height,
  avg_score, vote_count, view_count, current_rank, rank_one_since,
  milestone_stars, milestone_achieved_at, status, created_at
`;

async function attachPhotoProfiles<T extends { user_id: string | null }>(photos: T[]) {
  const userIds = Array.from(new Set(photos.map((photo) => photo.user_id).filter(Boolean)));

  if (userIds.length === 0) {
    return photos.map((photo) => ({ ...photo, profiles: null }));
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  if (error) throw new Error(error.message);

  const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  return photos.map((photo) => ({ ...photo, profiles: photo.user_id ? (profileMap.get(photo.user_id) ?? null) : null }));
}

export const listFeed = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      limit?: number;
      offset?: number;
      sort?: "new" | "top" | "hof" | "trending" | "votes";
      tag?: string;
      search?: string;
      range?: "all" | "day" | "week" | "month" | "year";
      following_of?: string | null;
      stars?: number;
    }) => d,
  )
  .handler(async ({ data }) => {
    const limit = Math.min(data.limit ?? 30, 60);
    const offset = Math.max(0, data.offset ?? 0);
    let q = supabaseAdmin.from("photos").select(PHOTO_BASE_SELECT).eq("status", "active").range(offset, offset + limit - 1);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    if (typeof data.stars === "number" && data.stars >= 1 && data.stars <= 5) {
      q = q.eq("milestone_stars", data.stars);
    }
    const RANGE_MS: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    if (data.range && data.range !== "all" && RANGE_MS[data.range]) {
      const since = new Date(Date.now() - RANGE_MS[data.range]).toISOString();
      q = q.gte("created_at", since);
    }
    if (data.following_of) {
      const { data: rows } = await supabaseAdmin
        .from("follows")
        .select("following_id")
        .eq("follower_id", data.following_of);
      const ids = (rows ?? []).map((r: any) => r.following_id);
      if (ids.length === 0) return { photos: [] };
      q = q.in("user_id", ids);
    }
    if (data.sort === "top") {
      q = q.gte("vote_count", 10).order("avg_score", { ascending: false }).order("vote_count", { ascending: false });
    } else if (data.sort === "hof") {
      q = q.gte("milestone_stars", 3).order("milestone_stars", { ascending: false }).order("avg_score", { ascending: false });
    } else if (data.sort === "trending") {
      // Photos with most recent votes (last 48h) — approximate via created_at + vote_count fallback
      q = q.order("vote_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (data.sort === "votes") {
      q = q.order("vote_count", { ascending: false }).order("avg_score", { ascending: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const photos = await attachPhotoProfiles(rows ?? []);
    // Attach comment counts
    const ids = photos.map((p: any) => p.id);
    let countMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: cRows } = await supabaseAdmin
        .from("comments")
        .select("photo_id")
        .in("photo_id", ids);
      (cRows ?? []).forEach((r: any) => {
        countMap.set(r.photo_id, (countMap.get(r.photo_id) ?? 0) + 1);
      });
    }
    return {
      photos: photos.map((p: any) => ({ ...p, comment_count: countMap.get(p.id) ?? 0 })),
    };
  });

export const getPopularTags = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("photos")
      .select("tags")
      .eq("status", "active")
      .not("tags", "is", null)
      .limit(500);
    const counts = new Map<string, number>();
    (data ?? []).forEach((row: any) => {
      (row.tags ?? []).forEach((t: string) => {
        if (!t) return;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      });
    });
    const tags = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
    return { tags };
  });

export const getRankOnePhoto = createServerFn({ method: "GET" })
  .handler(async () => {
    // Prefer the photo currently holding #1 (rank_one_since set).
    const { data: held, error: heldErr } = await supabaseAdmin
      .from("photos")
      .select(PHOTO_BASE_SELECT)
      .eq("status", "active")
      .not("rank_one_since", "is", null)
      .order("rank_one_since", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (heldErr) throw new Error(heldErr.message);
    if (held) {
      const [photo] = await attachPhotoProfiles([held]);
      return { photo, held: true };
    }

    // Fallback: top-rated active photo (so the spotlight always renders).
    const { data: top, error: topErr } = await supabaseAdmin
      .from("photos")
      .select(PHOTO_BASE_SELECT)
      .eq("status", "active")
      .gte("vote_count", 1)
      .order("avg_score", { ascending: false })
      .order("vote_count", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (topErr) throw new Error(topErr.message);
    if (!top) return { photo: null, held: false };
    const [photo] = await attachPhotoProfiles([top]);
    return { photo, held: false };
  });

export const getTopTwoPhotos = createServerFn({ method: "GET" })
  .handler(async () => {
    // #1 — same selection rule as getRankOnePhoto.
    const { data: held, error: heldErr } = await supabaseAdmin
      .from("photos")
      .select(PHOTO_BASE_SELECT)
      .eq("status", "active")
      .not("rank_one_since", "is", null)
      .order("rank_one_since", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (heldErr) throw new Error(heldErr.message);

    let first: any = held ?? null;
    const isHeld = !!held;
    if (!first) {
      const { data: top, error: topErr } = await supabaseAdmin
        .from("photos")
        .select(PHOTO_BASE_SELECT)
        .eq("status", "active")
        .gte("vote_count", 1)
        .order("avg_score", { ascending: false })
        .order("vote_count", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (topErr) throw new Error(topErr.message);
      first = (top as any) ?? null;
    }

    // #2 — next top-rated active photo, excluding the #1 id.
    let secondQuery = supabaseAdmin
      .from("photos")
      .select(PHOTO_BASE_SELECT)
      .eq("status", "active")
      .gte("vote_count", 1)
      .order("avg_score", { ascending: false })
      .order("vote_count", { ascending: false })
      .limit(1);
    if (first?.id) secondQuery = secondQuery.neq("id", first.id);
    const { data: second, error: secondErr } = await secondQuery.maybeSingle();
    if (secondErr) throw new Error(secondErr.message);

    const enriched = await attachPhotoProfiles([first, second].filter(Boolean) as any[]);
    return {
      first: enriched[0] ?? null,
      second: enriched[1] ?? null,
      held: isHeld,
    };
  });

export const getPhoto = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { data: photoRow, error } = await supabaseAdmin
      .from("photos")
      .select(PHOTO_BASE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!photoRow) return { photo: null, distribution: [0, 0, 0, 0, 0], comments: [] };
    const [photo] = await attachPhotoProfiles([photoRow]);

    const { data: votes } = await supabaseAdmin.from("votes").select("score").eq("photo_id", data.id);
    const rawDistribution = [0, 0, 0, 0, 0];
    (votes ?? []).forEach((v) => {
      if (v.score >= 1 && v.score <= 5) rawDistribution[v.score - 1]++;
    });
    const distribution = normalizeDistribution(rawDistribution);

    const { data: commentRows, error: commentsError } = await supabaseAdmin
      .from("comments")
      .select("id, content, created_at, user_id")
      .eq("photo_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (commentsError) throw new Error(commentsError.message);

    const commentUserIds = Array.from(new Set((commentRows ?? []).map((comment: any) => comment.user_id).filter(Boolean)));
    let commentProfileMap = new Map<string, any>();
    if (commentUserIds.length > 0) {
      const { data: commentProfiles, error: commentProfilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", commentUserIds);
      if (commentProfilesError) throw new Error(commentProfilesError.message);
      commentProfileMap = new Map((commentProfiles ?? []).map((profile: any) => [profile.id, profile]));
    }

    const comments = (commentRows ?? []).map((comment: any) => ({
      ...comment,
      profiles: comment.user_id ? (commentProfileMap.get(comment.user_id) ?? null) : null,
    }));

    return { photo, distribution, comments };
  });

export const getAdjacentPhotos = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { data: cur } = await supabaseAdmin
      .from("photos")
      .select("id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur) return { prev: null, next: null };

    // "next" in feed = older photo (feed is newest first)
    const { data: nextRow } = await supabaseAdmin
      .from("photos")
      .select("id, title, image_url")
      .eq("status", "active")
      .lt("created_at", cur.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: prevRow } = await supabaseAdmin
      .from("photos")
      .select("id, title, image_url")
      .eq("status", "active")
      .gt("created_at", cur.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return { prev: prevRow ?? null, next: nextRow ?? null };
  });

export const getUserProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, bio, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!profile) return { profile: null, photos: [], stats: null };

    const { data: photos } = await supabaseAdmin
      .from("photos")
      .select("id, title, image_url, avg_score, vote_count, view_count, milestone_stars, created_at")
      .eq("user_id", data.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabaseAdmin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.id),
      supabaseAdmin.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.id),
    ]);

    const stats = {
      total_photos: photos?.length ?? 0,
      total_votes: photos?.reduce((s, p) => s + (p.vote_count ?? 0), 0) ?? 0,
      total_stars: photos?.reduce((s, p) => s + (p.milestone_stars ?? 0), 0) ?? 0,
      highest_score: photos?.reduce((m, p) => Math.max(m, Number(p.avg_score ?? 0)), 0) ?? 0,
      total_views: photos?.reduce((s, p) => s + (p.view_count ?? 0), 0) ?? 0,
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
    };
    return { profile, photos: photos ?? [], stats };
  });

export const createPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional().default(""),
        tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
        storage_path: z.string().min(1),
        image_url: z.string().url(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("photos")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description,
        tags: data.tags,
        storage_path: data.storage_path,
        image_url: data.image_url,
        width: data.width,
        height: data.height,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getUploadQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count } = await context.supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", start.toISOString());
    return { used: count ?? 0, limit: 5 };
  });

export const reportPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reports")
      .insert({ photo_id: data.photo_id, reporter_id: context.userId, reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional().default(""),
        tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("photos")
      .update({ title: data.title, description: data.description, tags: data.tags })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Fetch to get storage_path for cleanup; RLS enforces ownership
    const { data: row, error: selErr } = await context.supabase
      .from("photos")
      .select("id, storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Photo not found");
    if (row.user_id !== context.userId) throw new Error("Forbidden");

    const { error } = await context.supabase.from("photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row.storage_path) {
      await context.supabase.storage.from("photos").remove([row.storage_path]).catch(() => {});
    }
    return { ok: true };
  });