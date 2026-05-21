import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(ctx: { supabase: ReturnType<typeof Object>; userId: string } & any) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, photo_id, reporter_id, reason, status, created_at, photos!reports_photo_id_fkey(id, title, image_url, status)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { reports: data ?? [] };
  });

export const removePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("photos").update({ status: "removed" }).eq("id", data.photo_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ report_id: z.string().uuid(), status: z.enum(["resolved", "dismissed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("reports").update({ status: data.status }).eq("id", data.report_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [photos, users, pending, removed] = await Promise.all([
      context.supabase.from("photos").select("id", { count: "exact", head: true }),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      context.supabase
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("status", "removed"),
    ]);
    return {
      photos: photos.count ?? 0,
      users: users.count ?? 0,
      pendingReports: pending.count ?? 0,
      removedPhotos: removed.count ?? 0,
    };
  });

export const listRecentUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const limit = data.limit ?? 50;

    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    // Pull email + provider from auth.users via admin client
    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: Math.max(limit, 200),
    });
    if (authErr) throw new Error(authErr.message);

    const map = new Map(authList.users.map((u) => [u.id, u]));
    // Pull admin roles in bulk
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    const adminSet = new Set((roleRows ?? []).map((r) => r.user_id));
    const users = (profiles ?? []).map((p) => {
      const u = map.get(p.id);
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      return {
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        bio: p.bio,
        created_at: p.created_at,
        email: u?.email ?? null,
        providers: u?.app_metadata?.providers ?? (u?.app_metadata?.provider ? [u.app_metadata.provider] : []),
        meta_full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
        meta_avatar_url: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        is_admin: adminSet.has(p.id),
      };
    });

    return { users };
  });

export const listAdminPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "active", "removed"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const limit = data.limit ?? 60;
    let q = context.supabase
      .from("photos")
      .select("id, title, image_url, status, avg_score, vote_count, view_count, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: photos, error } = await q;
    if (error) throw new Error(error.message);
    return { photos: photos ?? [] };
  });

export const setPhotoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ photo_id: z.string().uuid(), status: z.enum(["active", "removed"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("photos")
      .update({ status: data.status })
      .eq("id", data.photo_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePhotoHard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("photos").delete().eq("id", data.photo_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const limit = data.limit ?? 60;
    const { data: rows, error } = await context.supabase
      .from("comments")
      .select("id, content, created_at, user_id, photo_id, profiles!comments_user_id_fkey(display_name, avatar_url), photos!comments_photo_id_fkey(title, image_url)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      // Fallback without FK aliases (in case relationships aren't named)
      const { data: simple, error: e2 } = await context.supabase
        .from("comments")
        .select("id, content, created_at, user_id, photo_id")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (e2) throw new Error(e2.message);
      return { comments: simple ?? [] };
    }
    return { comments: rows ?? [] };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ comment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("comments").delete().eq("id", data.comment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), make_admin: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.make_admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      // Prevent self-demotion
      if (data.user_id === context.userId) throw new Error("ไม่สามารถถอดสิทธิ์ admin ของตัวเองได้");
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });