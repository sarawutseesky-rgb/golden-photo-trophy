import { createFileRoute, notFound } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";
import { Star, Link2, Check, Info, Clock, Trophy, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { FeedFilterBar } from "@/components/app/FeedFilterBar";
import { THRESHOLDS_HOURS } from "@/lib/milestone-rules";

const TIER_LABEL = ["24 ชั่วโมง", "7 วัน", "30 วัน", "90 วัน", "180 วัน"] as const;

function formatHours(h: number) {
  if (h < 48) return `${h} ชั่วโมง`;
  if (h < 168) return `${Math.round(h / 24)} วัน`;
  if (h < 720) return `${Math.round(h / 24)} วัน`;
  if (h < 8760) return `${Math.round(h / 24)} วัน`;
  return `${Math.round(h / 24)} วัน`;
}

const VALID = ["1", "2", "3", "4", "5"] as const;
type StarLevel = (typeof VALID)[number];

export const Route = createFileRoute("/stars/$n")({
  parseParams: (params) => {
    if (!(VALID as readonly string[]).includes(params.n)) throw notFound();
    return { n: params.n as StarLevel };
  },
  head: ({ params }) => {
    const n = params.n;
    const title = `${n}★ Photos — SEESTAR`;
    const description = `Browse all photos that earned exactly ${n} milestone star${n === "1" ? "" : "s"} on SEESTAR.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: StarsPage,
});

function StarsPage() {
  const { n } = Route.useParams();
  const level = Number(n);
  const [copied, setCopied] = useState(false);
  const nextTier = level < 5 ? level + 1 : null;
  const nextThresholdH = nextTier ? THRESHOLDS_HOURS[nextTier - 1] : null;

  const handleCopy = async () => {
    const url = `${window.location.origin}/stars/${n}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("คัดลอกลิงก์แล้ว");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <span>{level}</span>
            <span className="flex">
              {Array.from({ length: level }).map((_, i) => (
                <Star key={i} className="h-6 w-6 fill-amber-400 text-amber-400" />
              ))}
            </span>
            <span className="text-muted-foreground font-normal">photos</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Photos that earned exactly {level} milestone star{level === 1 ? "" : "s"}.
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            copied
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-border hover:bg-muted",
          )}
          aria-label={copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์แชร์"}
        >
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>
      </div>

      <FeedFilterBar showSort={false} showTags={false} />

      {/* Explanation panel — why these photos earned N★ */}
      <section
        aria-labelledby="stars-why-heading"
        className="rounded-xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 id="stars-why-heading" className="text-sm font-semibold">
                ทำไมรูปในหน้านี้ได้ {level}★
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ดาวให้อัตโนมัติตาม <strong>อายุของรูป</strong> นับจากเวลาอัปโหลด
                ไม่ใช่จากอันดับ #1 และจะถาวร — ได้แล้วไม่หาย
              </p>
            </div>

            {/* Tier checklist */}
            <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
              {THRESHOLDS_HOURS.map((h, i) => {
                const tier = i + 1;
                const passed = tier <= level;
                const current = tier === level;
                return (
                  <li
                    key={tier}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                      passed
                        ? "border-[var(--gold)]/40 bg-[var(--gold)]/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground",
                      current && "ring-1 ring-[var(--gold)]",
                    )}
                  >
                    {passed ? (
                      <Check className="h-3.5 w-3.5 text-[var(--gold)]" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    <span className="font-semibold">{tier}★</span>
                    <span className="opacity-80">· {TIER_LABEL[i]}</span>
                  </li>
                );
              })}
            </ol>

            {/* Conditions */}
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
                <span>
                  <strong className="text-foreground">เงื่อนไขผ่านด่าน:</strong>{" "}
                  ตอนเช็คด่าน รูปต้องมีคะแนนรวม (avg × จำนวนโหวต)
                  <em> มากกว่าหรือเท่ากับ </em>
                  รูปทุกใบที่อัปโหลด <em>หลัง</em> มัน
                  ถ้ามีรูปใหม่กว่าแซงคะแนนรวม จะถูกบล็อกด่านนั้น
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>
                  รูปในหน้านี้ <strong className="text-foreground">ผ่านด่าน {level}★ แล้ว</strong>
                  {level > 1 && <> (และผ่านทุกด่านก่อนหน้า)</>}
                </span>
              </li>
              {nextTier && nextThresholdH && (
                <li className="flex gap-2">
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                  <span>
                    <strong className="text-foreground">ด่านถัดไป {nextTier}★</strong>{" "}
                    เมื่อรูปอายุครบ {formatHours(nextThresholdH)} และยังไม่โดนรูปใหม่กว่าแซงคะแนนรวม
                  </span>
                </li>
              )}
              {!nextTier && (
                <li className="flex gap-2">
                  <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
                  <span>
                    <strong className="text-foreground">สูงสุดแล้ว</strong> — รูปเหล่านี้ได้ดาวครบทั้ง 5 ด่าน
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <div id="feed-panel" role="tabpanel" aria-labelledby={`tab-stars-${n}`}>
        <InfinitePhotoFeed
          queryKey={["stars", n]}
          params={{ sort: "new", stars: level }}
          showMilestoneTimeline
        />
      </div>
    </div>
  );
}