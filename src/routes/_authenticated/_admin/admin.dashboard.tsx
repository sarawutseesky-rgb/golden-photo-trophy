import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats } from "@/lib/admin.functions";
import { Image, Users, Flag, ShieldAlert, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const AUTO_REFRESH_MS = 60_000;
const AUTO_REFRESH_STORAGE_KEY = "admin-dashboard:auto-refresh";

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
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Hydrate from localStorage on mount (SSR-safe: runs in browser only)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
      if (saved === "true") setAutoRefresh(true);
    } catch {
      // ignore (private mode, disabled storage, etc.)
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      if (autoRefresh) {
        window.localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, "true");
      } else {
        window.localStorage.removeItem(AUTO_REFRESH_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [autoRefresh]);

  // Setting autoRefresh=false will clear the localStorage key via the effect above.
  const resetAutoRefresh = () => setAutoRefresh(false);

  const { data, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => stats(),
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
    refetchIntervalInBackground: false,
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
          <label
            className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-sm cursor-pointer select-none hover:bg-accent"
            data-testid="auto-refresh-toggle-label"
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              data-testid="auto-refresh-toggle"
              className="h-3.5 w-3.5 cursor-pointer accent-primary"
            />
            <span>รีเฟรชอัตโนมัติทุก 60 วินาที</span>
          </label>
          <button
            type="button"
            onClick={resetAutoRefresh}
            disabled={!autoRefresh}
            data-testid="reset-auto-refresh"
            title="ปิดการรีเฟรชอัตโนมัติและล้างค่าที่บันทึกไว้"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            รีเซ็ต
          </button>
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