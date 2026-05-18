import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReports, removePhoto, resolveReport } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({ meta: [{ title: "Admin — StarShot" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const list = useServerFn(listReports);
  const remove = useServerFn(removePhoto);
  const resolve = useServerFn(resolveReport);
  const { data } = useQuery({ queryKey: ["admin-reports"], queryFn: () => list() });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ul className="space-y-3">
        {(data?.reports ?? []).map((r: any) => (
          <li key={r.id} className="flex gap-4 rounded-xl border border-border bg-card p-4">
            {r.photos?.image_url && (
              <img src={r.photos.image_url} alt="" className="h-24 w-24 rounded object-cover" />
            )}
            <div className="flex-1 text-sm">
              <div className="font-semibold">{r.photos?.title ?? "(deleted)"}</div>
              <div className="text-muted-foreground">Reason: {r.reason}</div>
              <div className="text-xs text-muted-foreground">
                Status: {r.status} · {new Date(r.created_at).toLocaleString()}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => {
                    await remove({ data: { photo_id: r.photo_id } });
                    await resolve({ data: { report_id: r.id, status: "resolved" } });
                    toast.success("Photo removed");
                    qc.invalidateQueries({ queryKey: ["admin-reports"] });
                  }}
                  className="rounded bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
                >
                  Remove photo
                </button>
                <button
                  onClick={async () => {
                    await resolve({ data: { report_id: r.id, status: "dismissed" } });
                    qc.invalidateQueries({ queryKey: ["admin-reports"] });
                  }}
                  className="rounded border border-border px-3 py-1 text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </li>
        ))}
        {(data?.reports ?? []).length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
            No reports.
          </li>
        )}
      </ul>
    </div>
  );
}