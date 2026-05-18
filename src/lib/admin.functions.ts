import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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