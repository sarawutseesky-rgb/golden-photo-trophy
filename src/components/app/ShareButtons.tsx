import { useState } from "react";
import { Facebook, Twitter, Link2, Check, Share2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  url: string;
  title: string;
};

export function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const tw = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const line = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedTitle}`;

  const openShare = (href: string, name: string) => {
    if (typeof window === "undefined") return;
    // Open in a new tab (not a sized popup) — Facebook's share_channel sets
    // COOP headers that trigger ERR_BLOCKED_BY_RESPONSE when loaded inside a
    // popup window opened with specific dimensions.
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w) w.opener = null;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("คัดลอกลิงก์แล้ว");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("คัดลอกลิงก์ไม่สำเร็จ");
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, url });
      } catch {
        // user cancelled
      }
    } else {
      copyLink();
    }
  };

  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">แชร์:</span>
      <button
        type="button"
        onClick={() => openShare(fb, "fb")}
        aria-label="Share on Facebook"
        title="Facebook"
        className={btn}
      >
        <Facebook className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => openShare(tw, "tw")}
        aria-label="Share on X / Twitter"
        title="X (Twitter)"
        className={btn}
      >
        <Twitter className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => openShare(line, "line")}
        aria-label="Share on LINE"
        title="LINE"
        className={btn + " hover:!bg-[#06C755] hover:!text-white"}
      >
        <span className="text-xs font-bold">LINE</span>
      </button>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link"
        title={copied ? "Copied!" : "Copy link"}
        className={btn}
      >
        {copied ? <Check className="h-4 w-4 text-[var(--gold)]" /> : <Link2 className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={nativeShare}
        aria-label="More share options"
        title="More"
        className={btn + " sm:hidden"}
      >
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}