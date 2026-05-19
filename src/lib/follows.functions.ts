import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
    await supabaseAdmin.rpc("increment_photo_view", { _photo_id: data.photo_id });
    return { ok: true };
  });