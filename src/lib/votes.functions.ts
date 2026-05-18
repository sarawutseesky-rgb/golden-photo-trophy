import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_id: z.string().uuid(), score: z.number().int().min(1).max(5) }).parse(d))
  .handler(async ({ data, context }) => {
    // self-vote guarded by RLS and uniqueness guarded by table constraint
    const { error } = await context.supabase
      .from("votes")
      .insert({ photo_id: data.photo_id, voter_id: context.userId, score: data.score });
    if (error) {
      if (error.code === "23505") throw new Error("You already voted on this photo");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const getMyVote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { photo_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("votes")
      .select("score")
      .eq("photo_id", data.photo_id)
      .eq("voter_id", context.userId)
      .maybeSingle();
    return { score: row?.score ?? null };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ photo_id: z.string().uuid(), content: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("comments")
      .insert({ photo_id: data.photo_id, user_id: context.userId, content: data.content })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });