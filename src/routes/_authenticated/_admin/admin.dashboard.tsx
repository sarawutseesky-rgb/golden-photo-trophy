import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats } from "@/lib/admin.functions";
import { Image, Users, Flag, ShieldAlert, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_admin/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — StarShot" },
      { name: "description", content: "Overview of platform stats for admins." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">
        {loading ? "—" : value.toLocaleString()}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const stats = useServerFn(getAdminStats);
  const { data, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => stats(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            ภาพรวมสถิติของแพลตฟอร์ม
            {dataUpdatedAt > 0 && (
              <span className="ml-2 text-xs">
                · อัปเดตล่าสุด {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-busy={isFetching}
            data-testid="refresh-stats"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
            {isFetching ? "กำลังรีเฟรช..." : "รีเฟรช"}
          </button>
          <Link
            to="/admin"
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            ดู Reports
          </Link>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          โหลดสถิติไม่สำเร็จ{" "}
          <button
            onClick={() => refetch()}
            className="ml-2 underline underline-offset-2"
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Photos"
          value={data?.photos ?? 0}
          icon={Image}
          loading={isLoading}
        />
        <StatCard
          label="Users"
          value={data?.users ?? 0}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          label="Pending reports"
          value={data?.pendingReports ?? 0}
          icon={Flag}
          loading={isLoading}
        />
        <StatCard
          label="Removed photos"
          value={data?.removedPhotos ?? 0}
          icon={ShieldAlert}
          loading={isLoading}
        />
      </div>
    </div>
  );
}