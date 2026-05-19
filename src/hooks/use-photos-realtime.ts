import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime UPDATEs on public.photos and patch
 * react-query caches so avg_score / vote_count update instantly
 * across the feed and the photo detail page without a refresh.
 */
export function usePhotosRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("photos-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "photos" },
        (payload) => {
          const next = payload.new as {
            id: string;
            avg_score?: number;
            vote_count?: number;
            view_count?: number;
            milestone_stars?: number;
            current_rank?: number | null;
            rank_one_since?: string | null;
          };
          if (!next?.id) return;

          const patch = (ph: any) =>
            ph && ph.id === next.id
              ? {
                  ...ph,
                  avg_score: next.avg_score ?? ph.avg_score,
                  vote_count: next.vote_count ?? ph.vote_count,
                  view_count: next.view_count ?? ph.view_count,
                  milestone_stars: next.milestone_stars ?? ph.milestone_stars,
                  current_rank:
                    next.current_rank !== undefined ? next.current_rank : ph.current_rank,
                  rank_one_since:
                    next.rank_one_since !== undefined ? next.rank_one_since : ph.rank_one_since,
                }
              : ph;

          // Infinite feed pages: { pages: [{ photos: [...] }] }
          qc.setQueriesData({ queryKey: ["feed-infinite"] }, (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((p: any) =>
                p?.photos ? { ...p, photos: p.photos.map(patch) } : p,
              ),
            };
          });

          // Non-infinite feed caches
          qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
            if (!old?.photos) return old;
            return { ...old, photos: old.photos.map(patch) };
          });

          // Photo detail cache
          qc.setQueryData(["photo", next.id], (old: any) => {
            if (!old?.photo) return old;
            return { ...old, photo: patch(old.photo) };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
