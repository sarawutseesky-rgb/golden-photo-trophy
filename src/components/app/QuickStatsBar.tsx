import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Sparkles, Star, Users } from "lucide-react";
import { getCommunityStatsToday } from "@/lib/photos.functions";

function formatNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function QuickStatsBar() {
  const fn = useServerFn(getCommunityStatsToday);
  const { data, isLoading } = useQuery({
    queryKey: ["community-stats-today"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mb-4 h-10 animate-pulse rounded-full border border-border bg-card/60" />
    );
  }
  if (!data) return null;

  const total = data.newPhotos + data.newVotes + data.activeUploaders;
  if (total === 0) return null;

  return (
    <div
      role="status"
      aria-label={`สรุปกิจกรรมชุมชนวันนี้: รูปใหม่ ${data.newPhotos} รูป โหวต ${data.newVotes} ครั้ง จากช่างภาพ ${data.activeUploaders} คน`}
      className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm backdrop-blur sm:justify-start"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--gold)]">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-xs uppercase tracking-wider">วันนี้</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <Camera className="h-4 w-4 text-emerald-400" />
        <span className="tabular-nums font-semibold">{formatNum(data.newPhotos)}</span>
        <span className="text-muted-foreground">รูปใหม่</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <Star className="h-4 w-4 text-[var(--gold)]" />
        <span className="tabular-nums font-semibold">{formatNum(data.newVotes)}</span>
        <span className="text-muted-foreground">โหวต</span>
      </span>

      <span className="inline-flex items-center gap-1.5">
        <Users className="h-4 w-4 text-sky-400" />
        <span className="tabular-nums font-semibold">{formatNum(data.activeUploaders)}</span>
        <span className="text-muted-foreground">ช่างภาพ</span>
      </span>
    </div>
  );
}