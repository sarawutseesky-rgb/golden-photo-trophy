import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Milestone thresholds in milliseconds
const THRESHOLDS_MS = [
  1 * 24 * 60 * 60 * 1000,   // 1 day  -> 1 star
  7 * 24 * 60 * 60 * 1000,   // 7 days -> 2 stars
  30 * 24 * 60 * 60 * 1000,  // 30 days -> 3 stars
  90 * 24 * 60 * 60 * 1000,  // 90 days -> 4 stars
  180 * 24 * 60 * 60 * 1000, // 180 days -> 5 stars
];

export const Route = createFileRoute("/api/public/cron/rank")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();

        // Find the current #1 among qualified photos
        const { data: top } = await supabaseAdmin
          .from("photos")
          .select("id, user_id, milestone_stars, milestone_achieved_at, rank_one_since")
          .eq("status", "active")
          .gte("vote_count", 10)
          .order("avg_score", { ascending: false })
          .order("vote_count", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Reset rank_one_since for any photo that's no longer #1
        if (top) {
          await supabaseAdmin
            .from("photos")
            .update({ rank_one_since: null })
            .neq("id", top.id)
            .not("rank_one_since", "is", null);
        } else {
          await supabaseAdmin.from("photos").update({ rank_one_since: null }).not("rank_one_since", "is", null);
        }

        if (!top) return Response.json({ ok: true, top: null });

        // Start clock if needed
        let since: Date;
        if (!top.rank_one_since) {
          since = now;
          await supabaseAdmin.from("photos").update({ rank_one_since: now.toISOString() }).eq("id", top.id);
        } else {
          since = new Date(top.rank_one_since);
        }

        // Check thresholds
        const elapsed = now.getTime() - since.getTime();
        let stars = top.milestone_stars ?? 0;
        const achieved: string[] = (top.milestone_achieved_at ?? []) as string[];
        const newAchieved: string[] = [];
        for (let i = stars; i < THRESHOLDS_MS.length; i++) {
          if (elapsed >= THRESHOLDS_MS[i]) {
            stars = i + 1;
            newAchieved.push(now.toISOString());
          } else break;
        }

        if (newAchieved.length > 0) {
          await supabaseAdmin
            .from("photos")
            .update({
              milestone_stars: stars,
              milestone_achieved_at: [...achieved, ...newAchieved],
            })
            .eq("id", top.id);

          await supabaseAdmin.from("notifications").insert({
            user_id: top.user_id,
            type: "milestone",
            photo_id: top.id,
            message: `Your photo earned ${stars}★ for holding #1!`,
          });
        }

        return Response.json({ ok: true, top: top.id, stars, elapsed_ms: elapsed });
      },
    },
  },
});