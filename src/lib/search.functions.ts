import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(20).optional().default(8),
});

export const searchAll = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    const q = data.q;
    const limit = data.limit;
    // Escape % and _ for ILIKE; cmdk-style "starts with" + contains.
    const safe = q.replace(/[\\%_]/g, (m) => `\\${m}`);
    const like = `%${safe}%`;

    const [titlesRes, tagsRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("photos")
        .select("id,title,image_url,user_id,avg_score,vote_count")
        .eq("status", "active")
        .ilike("title", like)
        .order("avg_score", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("photos")
        .select("id,title,image_url,user_id,avg_score,vote_count,tags")
        .eq("status", "active")
        .contains("tags", [q.toLowerCase()])
        .order("avg_score", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("profiles")
        .select("id,display_name,avatar_url")
        .ilike("display_name", like)
        .limit(limit),
    ]);

    // De-dupe photos by id, prefer title hits first.
    const photoMap = new Map<string, any>();
    for (const p of titlesRes.data ?? []) photoMap.set(p.id, p);
    for (const p of tagsRes.data ?? []) if (!photoMap.has(p.id)) photoMap.set(p.id, p);

    return {
      photos: Array.from(photoMap.values()).slice(0, limit),
      profiles: profilesRes.data ?? [],
    };
  });
