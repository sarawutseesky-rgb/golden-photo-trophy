import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listReports,
  removePhoto,
  resolveReport,
  getAdminStats,
  listRecentUsers,
  listAdminPhotos,
  setPhotoStatus,
  deletePhotoHard,
  listAdminComments,
  deleteComment,
  setUserAdmin,
} from "@/lib/admin.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Image as ImageIcon,
  Users as UsersIcon,
  Flag,
  ShieldAlert,
  MessageSquare,
  LayoutDashboard,
  Shield,
  RefreshCw,
  Trash2,
  EyeOff,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({
    meta: [
      { title: "Admin — SEESTAR" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab:
      typeof s.tab === "string" &&
      ["dashboard", "reports", "photos", "users", "comments"].includes(s.tab)
        ? (s.tab as "dashboard" | "reports" | "photos" | "users" | "comments")
        : ("dashboard" as const),
  }),
  component: AdminPage,
});

function AdminPage() {
  const { tab } = Route.useSearch();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-primary" /> Admin Console
        </h1>
        <p className="text-sm text-muted-foreground">
          จัดการแพลตฟอร์ม SEESTAR Ranking ทั้งหมดในที่เดียว
        </p>
      </div>

      <Tabs value={tab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:w-auto sm:inline-grid sm:grid-cols-5">
          <TabsTrigger value="dashboard" asChild>
            <Link to="/admin" search={{ tab: "dashboard" }} className="flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          </TabsTrigger>
          <TabsTrigger value="reports" asChild>
            <Link to="/admin" search={{ tab: "reports" }} className="flex items-center gap-1.5">
              <Flag className="h-4 w-4" /> Reports
            </Link>
          </TabsTrigger>
          <TabsTrigger value="photos" asChild>
            <Link to="/admin" search={{ tab: "photos" }} className="flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" /> Photos
            </Link>
          </TabsTrigger>
          <TabsTrigger value="users" asChild>
            <Link to="/admin" search={{ tab: "users" }} className="flex items-center gap-1.5">
              <UsersIcon className="h-4 w-4" /> Users
            </Link>
          </TabsTrigger>
          <TabsTrigger value="comments" asChild>
            <Link to="/admin" search={{ tab: "comments" }} className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> Comments
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="photos" className="mt-6">
          <PhotosTab />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersTab />
        </TabsContent>
        <TabsContent value="comments" className="mt-6">
          <CommentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
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

function DashboardTab() {
  const stats = useServerFn(getAdminStats);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => stats(),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          รีเฟรช
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Photos" value={data?.photos ?? 0} icon={ImageIcon} loading={isLoading} />
        <StatCard label="Users" value={data?.users ?? 0} icon={UsersIcon} loading={isLoading} />
        <StatCard label="Pending reports" value={data?.pendingReports ?? 0} icon={Flag} loading={isLoading} />
        <StatCard label="Removed photos" value={data?.removedPhotos ?? 0} icon={ShieldAlert} loading={isLoading} />
      </div>
    </div>
  );
}

/* ---------------- Reports ---------------- */
function ReportsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listReports);
  const remove = useServerFn(removePhoto);
  const resolve = useServerFn(resolveReport);
  const { data, isLoading } = useQuery({ queryKey: ["admin-reports"], queryFn: () => list() });
  const reports = (data?.reports ?? []) as any[];

  return (
    <ul className="space-y-3">
      {isLoading && <li className="text-sm text-muted-foreground">กำลังโหลด...</li>}
      {!isLoading && reports.length === 0 && (
        <li className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          ยังไม่มีรายงาน
        </li>
      )}
      {reports.map((r) => (
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
                  toast.success("ลบรูปแล้ว");
                  qc.invalidateQueries({ queryKey: ["admin-reports"] });
                  qc.invalidateQueries({ queryKey: ["admin-stats"] });
                }}
                className="rounded bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
              >
                ลบรูป
              </button>
              <button
                onClick={async () => {
                  await resolve({ data: { report_id: r.id, status: "dismissed" } });
                  qc.invalidateQueries({ queryKey: ["admin-reports"] });
                }}
                className="rounded border border-border px-3 py-1 text-xs"
              >
                ปฏิเสธรายงาน
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Photos ---------------- */
function PhotosTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "removed">("all");
  const list = useServerFn(listAdminPhotos);
  const setStatus = useServerFn(setPhotoStatus);
  const hardDelete = useServerFn(deletePhotoHard);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-photos", filter],
    queryFn: () => list({ data: { status: filter } }),
  });
  const photos = (data?.photos ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "removed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize",
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "ทั้งหมด" : f === "active" ? "ใช้งาน" : "ซ่อนแล้ว"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : photos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          ไม่มีรูปในหมวดนี้
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                <span
                  className={cn(
                    "absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold",
                    p.status === "removed"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary/90 text-primary-foreground",
                  )}
                >
                  {p.status}
                </span>
              </div>
              <div className="space-y-2 p-3 text-xs">
                <div className="line-clamp-1 font-semibold">{p.title}</div>
                <div className="text-muted-foreground">
                  ★ {Number(p.avg_score).toFixed(2)} · {p.vote_count} โหวต · {p.view_count} วิว
                </div>
                <div className="flex gap-1">
                  {p.status === "active" ? (
                    <button
                      onClick={async () => {
                        await setStatus({ data: { photo_id: p.id, status: "removed" } });
                        toast.success("ซ่อนรูปแล้ว");
                        qc.invalidateQueries({ queryKey: ["admin-photos"] });
                        qc.invalidateQueries({ queryKey: ["admin-stats"] });
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent"
                    >
                      <EyeOff className="h-3 w-3" /> ซ่อน
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await setStatus({ data: { photo_id: p.id, status: "active" } });
                        toast.success("คืนค่าแล้ว");
                        qc.invalidateQueries({ queryKey: ["admin-photos"] });
                        qc.invalidateQueries({ queryKey: ["admin-stats"] });
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent"
                    >
                      <Eye className="h-3 w-3" /> คืนค่า
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm("ลบรูปนี้ถาวร?")) return;
                      await hardDelete({ data: { photo_id: p.id } });
                      toast.success("ลบถาวรแล้ว");
                      qc.invalidateQueries({ queryKey: ["admin-photos"] });
                      qc.invalidateQueries({ queryKey: ["admin-stats"] });
                    }}
                    className="inline-flex items-center justify-center rounded border border-destructive/50 px-2 py-1 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listRecentUsers);
  const toggleAdmin = useServerFn(setUserAdmin);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-recent-users"],
    queryFn: () => fetchUsers({ data: { limit: 100 } }),
  });
  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          รีเฟรช
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">ผู้ใช้</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">บทบาท</th>
                <th className="px-4 py-3 text-left">สมัครเมื่อ</th>
                <th className="px-4 py-3 text-left">Sign-in ล่าสุด</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลด...</td></tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">ยังไม่มีผู้ใช้</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.display_name} className="h-9 w-9 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {u.display_name?.slice(0, 2).toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{u.display_name || "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.email ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.providers as string[])?.length
                        ? (u.providers as string[]).map((p) => (
                            <span key={p} className="inline-flex rounded bg-secondary px-2 py-0.5 text-xs">{p}</span>
                          ))
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_admin ? (
                      <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        <Shield className="h-3 w-3" /> admin
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => {
                        try {
                          await toggleAdmin({ data: { user_id: u.id, make_admin: !u.is_admin } });
                          toast.success(u.is_admin ? "ถอดสิทธิ์ admin แล้ว" : "ตั้งเป็น admin แล้ว");
                          qc.invalidateQueries({ queryKey: ["admin-recent-users"] });
                        } catch (err: any) {
                          toast.error(err?.message ?? "ผิดพลาด");
                        }
                      }}
                      className={cn(
                        "rounded border px-2 py-1 text-xs",
                        u.is_admin
                          ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {u.is_admin ? "ถอดสิทธิ์" : "ตั้งเป็น admin"}
                    </button>
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

/* ---------------- Comments ---------------- */
function CommentsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminComments);
  const del = useServerFn(deleteComment);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: () => list({ data: { limit: 100 } }),
  });
  const comments = (data?.comments ?? []) as any[];

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
      {!isLoading && comments.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          ยังไม่มีคอมเมนต์
        </div>
      )}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
          {c.photos?.image_url && (
            <Link to="/photo/$id" params={{ id: c.photo_id }}>
              <img src={c.photos.image_url} alt="" className="h-16 w-16 rounded object-cover" />
            </Link>
          )}
          <div className="flex-1 text-sm">
            <div className="flex items-center gap-2">
              {c.profiles?.avatar_url && (
                <img src={c.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="font-semibold">{c.profiles?.display_name ?? c.user_id.slice(0, 8)}</span>
              <span className="text-xs text-muted-foreground">
                · {new Date(c.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words">{c.content}</p>
          </div>
          <button
            onClick={async () => {
              if (!confirm("ลบคอมเมนต์นี้?")) return;
              await del({ data: { comment_id: c.id } });
              toast.success("ลบแล้ว");
              qc.invalidateQueries({ queryKey: ["admin-comments"] });
            }}
            className="self-start rounded border border-destructive/50 p-2 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}