import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications, markAllRead } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SEESTAR" }] }),
  component: NotifPage,
});

function NotifPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listNotifications);
  const mark = useServerFn(markAllRead);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          onClick={async () => {
            await mark();
            qc.invalidateQueries({ queryKey: ["notifications"] });
          }}
          className="text-xs text-[var(--gold)] hover:underline"
        >
          Mark all as read
        </button>
      </div>
      <ul className="space-y-2">
        {(data?.notifications ?? []).map((n: any) => (
          <li
            key={n.id}
            className={"rounded-lg border border-border p-3 text-sm " + (n.read ? "bg-card" : "bg-card/80 border-[var(--gold)]/40")}
          >
            {n.photo_id ? (
              <Link to="/photo/$id" params={{ id: n.photo_id }} className="hover:underline">
                {n.message}
              </Link>
            ) : (
              n.message
            )}
            <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
          </li>
        ))}
        {(data?.notifications ?? []).length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
            No notifications yet.
          </li>
        )}
      </ul>
    </div>
  );
}