import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { timingSafeEqual } from "crypto";
import {
  buildMaxLaterScoreMap,
  decideMilestone,
} from "@/lib/milestone-rules";

export const Route = createFileRoute("/api/public/cron/rank")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require a server-only shared secret. Prefer CRON_SECRET, fall back
        // to SUPABASE_SERVICE_ROLE_KEY (also server-only) for backward compat.
        // Never accept the public anon key here.
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          request.headers.get("apikey") ??
          "";
        const expected =
          process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
        if (!expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const now = new Date();

        // Pull all active photos. We need every later-uploaded photo for the
        // "no later upload outscores me" check.
        const { data: rows, error } = await supabaseAdmin
          .from("photos")
          .select(
            "id, user_id, created_at, avg_score, vote_count, milestone_stars, milestone_achieved_at",
          )
          .eq("status", "active")
          .order("created_at", { ascending: true });

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const photos = (rows ?? []).map((r: any) => ({
          id: r.id as string,
          user_id: r.user_id as string,
          created_at: r.created_at as string,
          milestone_stars: (r.milestone_stars ?? 0) as number,
          milestone_achieved_at: (r.milestone_achieved_at ?? []) as string[],
          total_score: Number(r.avg_score ?? 0) * Number(r.vote_count ?? 0),
        }));

        const maxLater = buildMaxLaterScoreMap(photos);

        const updates: {
          id: string;
          user_id: string;
          newStars: number;
          newlyAchievedAt: string[];
          prevStars: number;
          merged: string[];
        }[] = [];

        for (const p of photos) {
          const d = decideMilestone(p, maxLater.get(p.id) ?? -Infinity, now);
          if (d.newStars > p.milestone_stars) {
            updates.push({
              id: p.id,
              user_id: p.user_id,
              newStars: d.newStars,
              newlyAchievedAt: d.newlyAchievedAt,
              prevStars: p.milestone_stars,
              merged: [...p.milestone_achieved_at, ...d.newlyAchievedAt],
            });
          }
        }

        for (const u of updates) {
          await supabaseAdmin
            .from("photos")
            .update({
              milestone_stars: u.newStars,
              milestone_achieved_at: u.merged,
            })
            .eq("id", u.id);

          await supabaseAdmin.from("notifications").insert({
            user_id: u.user_id,
            type: "milestone",
            photo_id: u.id,
            message: `Your photo earned ${u.newStars}★ milestone!`,
          });
        }

        return Response.json({
          ok: true,
          evaluated: photos.length,
          awarded: updates.length,
          awards: updates.map((u) => ({
            id: u.id,
            prev: u.prevStars,
            now: u.newStars,
          })),
        });
      },
    },
  },
});
