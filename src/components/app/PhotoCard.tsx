import { Link } from "@tanstack/react-router";
import { StarRow } from "./StarRow";

export type FeedPhoto = {
  id: string;
  title: string;
  image_url: string;
  avg_score: number;
  vote_count: number;
  milestone_stars: number;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

export function PhotoCard({ photo }: { photo: FeedPhoto }) {
  return (
    <Link
      to="/photo/$id"
      params={{ id: photo.id }}
      className="group relative block overflow-hidden rounded-xl border border-border bg-card transition hover:border-[var(--gold)]/60"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={photo.image_url}
          alt={photo.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute right-2 top-2 rounded-md bg-background/80 px-2 py-1 backdrop-blur">
          <StarRow count={photo.milestone_stars} size={12} />
        </div>
        <div className="absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur">
          ★ {Number(photo.avg_score).toFixed(1)} <span className="text-muted-foreground">· {photo.vote_count}</span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{photo.title}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          by {photo.profiles?.display_name ?? "Anonymous"}
        </p>
      </div>
    </Link>
  );
}