import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInstallStats } from "@/lib/admin.functions";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_admin/install-stats")({
  head: () => ({
    meta: [
      { title: "Install Stats — SEESTAR" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InstallStatsPage,
});

const EVENT_LABELS: Record<string, string> = {
  prompt_shown: "แสดง prompt (Android/Desktop)",
  prompt_shown_ios: "แสดง prompt (iOS)",
  install_clicked: "กดปุ่ม ติดตั้ง",
  install_accepted: "ยืนยันติดตั้ง (browser)",
  install_dismissed: "ปิด/ปฏิเสธ",
  later_clicked: "กด ไว้ก่อน / เข้าใจแล้ว",
  pill_hidden: "ซ่อน pill",
  app_installed: "ติดตั้งสำเร็จ (appinstalled)",
};

function InstallStatsPage() {
  const fetchStats = useServerFn(getInstallStats);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "install-stats"],
    queryFn: () => fetchStats({}),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>;

  const { totals, byPlatform, uniqueSessions, shownSessions, clickedSessions, installedSessions, recent } = data;
  const clickRate = shownSessions ? Math.round((clickedSessions / shownSessions) * 100) : 0;
  const installRate = shownSessions ? Math.round((installedSessions / shownSessions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Download className="h-6 w-6 text-primary" /> Install Prompt Stats
        </h1>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sessions ทั้งหมด" value={uniqueSessions} />
        <StatCard label="เห็น prompt" value={shownSessions} />
        <StatCard label="กดติดตั้ง" value={clickedSessions} hint={`${clickRate}% ของที่เห็น`} />
        <StatCard label="ติดตั้งสำเร็จ" value={installedSessions} hint={`${installRate}% ของที่เห็น`} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">นับตาม event (รวมทุก platform)</h2>
        <div className="rounded-lg border border-border bg-card">
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-medium">{totals[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">แยกตาม platform</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Platform</th>
                {Object.keys(EVENT_LABELS).map((k) => (
                  <th key={k} className="px-3 py-2 text-right">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byPlatform).map(([platform, counts]) => (
                <tr key={platform} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{platform}</td>
                  {Object.keys(EVENT_LABELS).map((k) => (
                    <td key={k} className="px-3 py-2 text-right font-mono">{counts[k] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Event ล่าสุด (50 รายการ)</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">เวลา</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Platform</th>
                <th className="px-3 py-2 text-left">Standalone</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.event}</td>
                  <td className="px-3 py-2">{r.platform ?? "—"}</td>
                  <td className="px-3 py-2">{r.standalone ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}