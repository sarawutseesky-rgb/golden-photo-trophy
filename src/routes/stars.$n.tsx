import { createFileRoute, notFound } from "@tanstack/react-router";
import { InfinitePhotoFeed } from "@/components/app/InfinitePhotoFeed";
import { Star, Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { FeedFilterBar } from "@/components/app/FeedFilterBar";

const VALID = ["1", "2", "3", "4", "5"] as const;
type StarLevel = (typeof VALID)[number];

export const Route = createFileRoute("/stars/$n")({
  parseParams: (params) => {
    if (!(VALID as readonly string[]).includes(params.n)) throw notFound();
    return { n: params.n as StarLevel };
  },
  head: ({ params }) => {
    const n = params.n;
    const title = `${n}★ Photos — StarShot`;
    const description = `Browse all photos that earned exactly ${n} milestone star${n === "1" ? "" : "s"} on StarShot.`;
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

      <InfinitePhotoFeed
        queryKey={["stars", n]}
        params={{ sort: "new", stars: level }}
      />
    </div>
  );
}