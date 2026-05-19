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
  .inputValidator((d: { range?: Range; limit?: number; viewer_id?: string | null }) => d)
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
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const totalRanked = ranked.length;
    const top = ranked.slice(0, limit);

    // Find viewer's full-list entry (may be outside top N)
    const viewerId = data.viewer_id ?? null;
    const viewerRow = viewerId ? ranked.find((r) => r.user_id === viewerId) ?? null : null;

    if (top.length === 0 && !viewerRow) {
      return { entries: [] as any[], me: null, total: 0 };
    }

    const ids = new Set<string>(top.map((r) => r.user_id));
    if (viewerRow) ids.add(viewerRow.user_id);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", Array.from(ids));
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const toEntry = (r: typeof ranked[number]) => {
      const p = pmap.get(r.user_id);
      return {
        rank: r.rank,
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
    };

    return {
      entries: top.map(toEntry),
      me: viewerRow ? toEntry(viewerRow) : null,
      total: totalRanked,
    };
  });