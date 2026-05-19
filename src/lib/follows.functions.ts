import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getFollowStats = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string; viewerId?: string | null }) => d)
  .handler(async ({ data }) => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabaseAdmin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.id),
      supabaseAdmin.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.id),
    ]);
    let isFollowing = false;
    if (data.viewerId && data.viewerId !== data.id) {
      const { data: row } = await supabaseAdmin
        .from("follows")
        .select("id")
        .eq("follower_id", data.viewerId)
        .eq("following_id", data.id)
        .maybeSingle();
      isFollowing = !!row;
    }
    return { followers: followers ?? 0, following: following ?? 0, isFollowing };
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.target_id === context.userId) throw new Error("Cannot follow yourself");
    const { error } = await context.supabase
      .from("follows")
      .insert({ follower_id: context.userId, following_id: data.target_id });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("follows")
      .delete()
      .eq("follower_id", context.userId)
      .eq("following_id", data.target_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const incrementPhotoView = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ photo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    // หา viewer key: ถ้า login จะใช้ user.id, ถ้าไม่ login ใช้ hash(ip+ua)
    let viewerKey: string | null = null;
    try {
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
        if (u?.user?.id) viewerKey = `u:${u.user.id}`;
      }
    } catch {
      // ignore
    }
    if (!viewerKey) {
      const ip = getRequestIP({ xForwardedFor: true }) ?? "0.0.0.0";
      const ua = getRequestHeader("user-agent") ?? "";
      viewerKey = "a:" + createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
    }

    // bucket 30 นาที
    const BUCKET_SECONDS = 30 * 60;
    const bucket = Math.floor(Date.now() / 1000 / BUCKET_SECONDS);

    // insert event; ถ้า unique conflict แสดงว่านับไปแล้วในช่วงนี้
    const { data: inserted, error } = await supabaseAdmin
      .from("photo_view_events")
      .insert({ photo_id: data.photo_id, viewer_key: viewerKey, time_bucket: bucket })
      .select("id");

    if (error) {
      // 23505 = unique_violation → ถือว่านับซ้ำ, ไม่เพิ่ม count
      if ((error as any).code === "23505") return { ok: true, counted: false };
      throw new Error(error.message);
    }

    if (inserted && inserted.length > 0) {
      await supabaseAdmin.rpc("increment_photo_view", { _photo_id: data.photo_id });
      return { ok: true, counted: true };
    }
    return { ok: true, counted: false };
  });