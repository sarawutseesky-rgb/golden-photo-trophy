import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUserProfile } from "@/lib/photos.functions";
import { StarRow } from "@/components/app/StarRow";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({ meta: [{ title: "Profile — StarShot" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getUserProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!data?.profile) return <div className="py-12 text-center text-muted-foreground">Profile not found.</div>;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted" />
        <div>
          <h1 className="text-2xl font-bold">{data.profile.display_name}</h1>
          {data.profile.bio && <p className="text-sm text-muted-foreground">{data.profile.bio}</p>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Photos" value={data.stats!.total_photos} />
        <Stat label="Votes received" value={data.stats!.total_votes} />
        <Stat label="Total stars" value={data.stats!.total_stars} gold />
        <Stat label="Highest score" value={data.stats!.highest_score.toFixed(1)} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Photos</h2>
        {data.photos.length === 0 ? (
          <p className="text-muted-foreground">No photos uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.photos.map((p: any) => (
              <Link key={p.id} to="/photo/$id" params={{ id: p.id }} className="relative block overflow-hidden rounded-lg">
                <img src={p.image_url} alt={p.title} className="aspect-square w-full object-cover" />
                <div className="absolute right-1 top-1 rounded bg-background/80 px-1.5 py-0.5 backdrop-blur">
                  <StarRow count={p.milestone_stars} size={10} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: number | string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-1 text-2xl font-bold " + (gold ? "text-[var(--gold)]" : "")}>{value}</div>
    </div>
  );
}