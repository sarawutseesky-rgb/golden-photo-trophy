import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: { id: string; display_name: string | null; avatar_url: string | null } | null;
};

async function attachProfiles(rows: { id: string; user_id: string; content: string; created_at: string }[]): Promise<ChatMessage[]> {
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (ids.length === 0) return rows.map((r) => ({ ...r, profile: null }));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
}

export const listChatMessages = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 50;
    const { data: rows, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    const enriched = await attachProfiles(rows ?? []);
    return { messages: enriched.reverse() };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { content: string }) =>
    z.object({ content: z.string().trim().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, content: data.content })
      .select("id, user_id, content, created_at")
      .single();
    if (error) throw new Error(error.message);
    const [enriched] = await attachProfiles([row as any]);
    return { message: enriched };
  });

export const deleteChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("chat_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });