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
      };
    });

    return { users };
  });