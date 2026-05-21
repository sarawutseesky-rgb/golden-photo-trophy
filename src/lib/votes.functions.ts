import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isDuplicateVoteError } from "@/lib/votes.helpers";

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_id: z.string().uuid(), score: z.number().int().min(1).max(5) }).parse(d))
  .handler(async ({ data, context }) => {
    // Idempotent insert: rely on UNIQUE (photo_id, voter_id) — duplicates
    // are silently ignored and reported back as { duplicate: true }.
    // Self-vote is still blocked by RLS.
    const { data: inserted, error } = await context.supabase
      .from("votes")
      .upsert(
        { photo_id: data.photo_id, voter_id: context.userId, score: data.score },
        { onConflict: "photo_id,voter_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) {
      if (isDuplicateVoteError(error)) {
        console.warn("[castVote] duplicate vote (unique violation)", {
          photo_id: data.photo_id,
          user_id: context.userId,
          score: data.score,
          source: "pg_unique_violation",
        });
        return { ok: false, duplicate: true } as { ok: false; duplicate: true };
      }
      throw new Error(error.message);
    }
    const duplicate = !inserted || inserted.length === 0;
    if (duplicate) {
      console.warn("[castVote] duplicate vote (upsert ignored)", {
        photo_id: data.photo_id,
        user_id: context.userId,
        score: data.score,
        source: "upsert_ignore_duplicates",
      });
      return { ok: false, duplicate: true } as { ok: false; duplicate: true };
    }
    console.info("[castVote] vote recorded", {
      photo_id: data.photo_id,
      user_id: context.userId,
      score: data.score,
    });
    return { ok: true, duplicate: false } as { ok: true; duplicate: false };
  });

export const removeVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("votes")
      .delete()
      .eq("photo_id", data.photo_id)
      .eq("voter_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyVote = createServerFn({ method: "GET" })
  .inputValidator((d: { photo_id: string }) => d)
  .handler(async ({ data }) => {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) return { score: null };
    const token = authHeader.slice(7);
    if (!token) return { score: null };
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return { score: null };
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return { score: null };
    const { data: row } = await supabase
      .from("votes")
      .select("score")
      .eq("photo_id", data.photo_id)
      .eq("voter_id", userId)
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