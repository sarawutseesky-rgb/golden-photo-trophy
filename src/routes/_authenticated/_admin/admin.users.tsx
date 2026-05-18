import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRecentUsers } from "@/lib/admin.functions";
import { RefreshCw, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_admin/admin/users")({
  head: () => ({
    meta: [
      { title: "ผู้ใช้ล่าสุด — Admin" },
      { name: "description", content: "ตรวจสอบรายชื่อผู้ใช้ล่าสุดและข้อมูล profile" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const fetchUsers = useServerFn(listRecentUsers);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["admin-recent-users"],
    queryFn: () => fetchUsers({ data: { limit: 50 } }),
  });

  const users = data?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="h-6 w-6" />
            ผู้ใช้ล่าสุด
          </h1>
          <p className="text-sm text-muted-foreground">
            ตรวจสอบ profile ของผู้ใช้ที่สมัครล่าสุด พร้อมข้อมูลจาก OAuth provider
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-busy={isFetching}
            data-testid="refresh-users"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {isFetching ? "กำลังโหลด..." : "รีเฟรช"}
          </button>
          <Link
            to="/admin/dashboard"
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            กลับ Dashboard
          </Link>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          โหลดข้อมูลไม่สำเร็จ
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">ผู้ใช้</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Meta (จาก OAuth)</th>
                <th className="px-4 py-3 text-left">สมัครเมื่อ</th>
                <th className="px-4 py-3 text-left">Sign-in ล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลด...</td></tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">ยังไม่มีผู้ใช้</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.display_name}
                          className="h-9 w-9 rounded-full object-cover border border-border"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                          {u.display_name?.slice(0, 2).toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{u.display_name || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.email ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.providers as string[])?.length ? (
                        (u.providers as string[]).map((p) => (
                          <span key={p} className="inline-flex rounded bg-secondary px-2 py-0.5 text-xs">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>full_name: <span className="font-mono">{u.meta_full_name ?? "—"}</span></div>
                    <div className="truncate max-w-[280px]">avatar: <span className="font-mono">{u.meta_avatar_url ?? "—"}</span></div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
