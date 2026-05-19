import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decideMilestone } from "@/lib/milestone-rules";

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
          .order("id", { ascending: true })
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

        const decision = decideMilestone(
          {
            id: top.id,
            milestone_stars: top.milestone_stars ?? 0,
            milestone_achieved_at: (top.milestone_achieved_at ?? []) as string[],
            rank_one_since: top.rank_one_since ?? null,
          },
          now,
        );

        if (decision.startClock) {
          await supabaseAdmin
            .from("photos")
            .update({ rank_one_since: now.toISOString() })
            .eq("id", top.id);
        }

        if (decision.newlyAchievedAt.length > 0) {
          const achieved = (top.milestone_achieved_at ?? []) as string[];
          await supabaseAdmin
            .from("photos")
            .update({
              milestone_stars: decision.newStars,
              milestone_achieved_at: [...achieved, ...decision.newlyAchievedAt],
            })
            .eq("id", top.id);

          await supabaseAdmin.from("notifications").insert({
            user_id: top.user_id,
            type: "milestone",
            photo_id: top.id,
            message: `Your photo earned ${decision.newStars}★ for holding #1!`,
          });
        }

        return Response.json({
          ok: true,
          top: top.id,
          stars: decision.newStars,
          elapsed_ms: decision.elapsedMs,
        });
      },
    },
  },
});