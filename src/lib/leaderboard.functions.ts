import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Range = "day" | "week" | "month" | "year" | "all";

const RANGE_MS: Record<Exclude<Range, "all">, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export const getMemberLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: { range?: Range; limit?: number }) => d)
  .handler(async ({ data }) => {
    const range: Range = data.range ?? "all";
    const limit = Math.min(Math.max(data.limit ?? 50, 1), 100);

    let q = supabaseAdmin
      .from("photos")
      .select("user_id, vote_count, avg_score, created_at")
      .eq("status", "active");

    if (range !== "all") {
      const since = new Date(Date.now() - RANGE_MS[range]).toISOString();
      q = q.gte("created_at", since);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const agg = new Map<
      string,
      { user_id: string; total_votes: number; total_photos: number; weighted_score: number }
    >();
    for (const r of rows ?? []) {
      const uid = (r as any).user_id as string;
      const votes = Number((r as any).vote_count ?? 0);
      const avg = Number((r as any).avg_score ?? 0);
      const prev = agg.get(uid) ?? {
        user_id: uid,
        total_votes: 0,
        total_photos: 0,
        weighted_score: 0,
      };
      prev.total_votes += votes;
      prev.total_photos += 1;
      prev.weighted_score += avg * votes;
      agg.set(uid, prev);
    }

    const ranked = Array.from(agg.values())
      .filter((u) => u.total_votes > 0)
      .sort((a, b) => b.total_votes - a.total_votes || b.weighted_score - a.weighted_score)
      .slice(0, limit);

    if (ranked.length === 0) return { entries: [] as any[] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in(
        "id",
        ranked.map((r) => r.user_id),
      );
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return {
      entries: ranked.map((r, i) => {
        const p = pmap.get(r.user_id);
        return {
          rank: i + 1,
          user_id: r.user_id,
          display_name: p?.display_name ?? "Unknown",
          avatar_url: p?.avatar_url ?? null,
          total_votes: r.total_votes,
          total_photos: r.total_photos,
          avg_score:
            r.total_votes > 0
              ? Number((r.weighted_score / r.total_votes).toFixed(2))
              : 0,
        };
      }),
    };
  });