import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeDistribution } from "@/lib/utils";

const PHOTO_SELECT = `
  id, user_id, title, description, tags, image_url, width, height,
  avg_score, vote_count, view_count, current_rank, rank_one_since,
  milestone_stars, milestone_achieved_at, status, created_at,
  profiles!photos_user_id_fkey ( id, display_name, avatar_url )
`;

export const listFeed = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      limit?: number;
      sort?: "new" | "top" | "hof" | "trending" | "votes";
      tag?: string;
      search?: string;
      range?: "all" | "week";
      following_of?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const limit = Math.min(data.limit ?? 30, 60);
    let q = supabaseAdmin.from("photos").select(PHOTO_SELECT).eq("status", "active").limit(limit);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    if (data.range === "week") {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
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
    return { photos: rows ?? [] };
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
    const { data, error } = await supabaseAdmin
      .from("photos")
      .select(PHOTO_SELECT)
      .eq("status", "active")
      .not("rank_one_since", "is", null)
      .order("rank_one_since", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { photo: data ?? null };
  });

export const getPhoto = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { data: photo, error } = await supabaseAdmin
      .from("photos")
      .select(PHOTO_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!photo) return { photo: null, distribution: [0, 0, 0, 0, 0], comments: [] };

    const { data: votes } = await supabaseAdmin.from("votes").select("score").eq("photo_id", data.id);
    const rawDistribution = [0, 0, 0, 0, 0];
    (votes ?? []).forEach((v) => {
      if (v.score >= 1 && v.score <= 5) rawDistribution[v.score - 1]++;
    });
    const distribution = normalizeDistribution(rawDistribution);

    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select("id, content, created_at, user_id, profiles!comments_user_id_fkey(id, display_name, avatar_url)")
      .eq("photo_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);

    return { photo, distribution, comments: comments ?? [] };
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
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { count } = await context.supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", start.toISOString());
    return { used: count ?? 0, limit: 3 };
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