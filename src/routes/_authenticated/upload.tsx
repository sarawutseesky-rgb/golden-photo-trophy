import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { createPhoto, getUploadQuota } from "@/lib/photos.functions";
import { compressImage, getImageDims } from "@/lib/image-compress";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, UploadCloud, X, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — SEESTAR" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const create = useServerFn(createPhoto);
  const fetchQuota = useServerFn(getUploadQuota);

  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchQuota().then(setQuota).catch(() => {});
  }, [fetchQuota]);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type))
      return toast.error("JPG, PNG, or WEBP only");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const dims = await getImageDims(blob);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const tagsArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);
      const { id } = await create({
        data: {
          title,
          description,
          tags: tagsArr,
          storage_path: path,
          image_url: pub.publicUrl,
          width: dims.width,
          height: dims.height,
        },
      });
      toast.success("Photo uploaded!");
      nav({ to: "/photo/$id", params: { id } });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;
  const tagsArr = useMemo(
    () => tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
    [tags],
  );
  const canSubmit = !!file && !!title.trim() && !busy;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-background p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--gold-glow), transparent 60%)" }}
        />
        <div className="flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--gold)_40%,transparent)] bg-[color-mix(in_oklab,var(--gold)_12%,transparent)] sm:flex">
            <Sparkles className="h-6 w-6 text-[var(--gold)]" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">อัปโหลดรูปของคุณ</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              แชร์ผลงานเพื่อรับโหวตและไต่อันดับลีดเดอร์บอร์ด
            </p>
            {quota && (
              <div className="mt-4 max-w-xs">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>โควต้าเดือนนี้</span>
                  <span className="font-medium text-foreground">{quota.used}/{quota.limit}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-glow)] transition-all"
                    style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {remaining === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-base font-medium">โควต้าครบแล้ว</p>
          <p className="mt-1 text-sm text-muted-foreground">คุณใช้สิทธิ์อัปโหลดครบ {quota!.limit} รูปในเดือนนี้แล้ว แล้วพบกันใหม่เดือนหน้า</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-5">
          {/* Dropzone */}
          <div className="lg:col-span-3">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            {!preview ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`group flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card/40 p-8 text-center transition-all ${
                  dragOver
                    ? "border-[var(--gold)] bg-[color-mix(in_oklab,var(--gold)_8%,transparent)] scale-[1.01]"
                    : "border-border hover:border-[var(--gold)]/60 hover:bg-card/70"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--gold)_15%,transparent)] text-[var(--gold)] transition-transform group-hover:scale-110">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-base font-medium">ลากรูปมาวาง หรือคลิกเพื่อเลือก</p>
                  <p className="mt-1 text-xs text-muted-foreground">JPG · PNG · WEBP — ไม่เกิน 10MB</p>
                </div>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-border bg-black/40">
                <img src={preview} alt="" className="aspect-[4/3] w-full object-contain" />
                <div className="absolute right-3 top-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-background"
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> เปลี่ยน
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> ลบ
                  </button>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--gold)]" />
                  พร้อมอัปโหลด · {(file!.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-5 lg:col-span-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="title" className="text-sm font-medium">ชื่อรูป</label>
                <span className="text-[10px] text-muted-foreground">{title.length}/120</span>
              </div>
              <input
                id="title"
                required
                maxLength={120}
                placeholder="เช่น พระอาทิตย์ตกที่ภูเก็ต"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm transition focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="desc" className="text-sm font-medium">คำอธิบาย <span className="text-muted-foreground font-normal">(ไม่บังคับ)</span></label>
                <span className="text-[10px] text-muted-foreground">{description.length}/1000</span>
              </div>
              <textarea
                id="desc"
                maxLength={1000}
                placeholder="เล่าเรื่องราวเบื้องหลังภาพนี้…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm transition focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="tags" className="text-sm font-medium">แท็ก</label>
                <span className="text-[10px] text-muted-foreground">{tagsArr.length}/8</span>
              </div>
              <input
                id="tags"
                placeholder="ทะเล, พระอาทิตย์, ภูเก็ต"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm transition focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
              />
              {tagsArr.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagsArr.map((t) => (
                    <span key={t} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-glow)] py-3 text-sm font-semibold text-background shadow-lg shadow-[var(--gold)]/20 transition disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:shadow-xl enabled:hover:shadow-[var(--gold)]/30 enabled:active:scale-[0.99]"
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> กำลังอัปโหลด…</>
              ) : (
                <><UploadCloud className="h-4 w-4" /> เผยแพร่</>
              )}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              เมื่อเผยแพร่แล้วถือว่าคุณยอมรับข้อตกลงในการแชร์ภาพ
            </p>
          </div>
        </form>
      )}
    </div>
  );
}