import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { createPhoto, getUploadQuota } from "@/lib/photos.functions";
import { compressImage, getImageDims } from "@/lib/image-compress";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload a photo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {remaining !== null ? `${remaining}/${quota!.limit} uploads left this month` : "Loading quota…"}
        </p>
      </div>
      {remaining === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          You've used all 3 uploads this month. Come back next month!
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-muted-foreground">Photo (JPG/PNG/WEBP, max 10MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>
          {preview && (
            <img src={preview} alt="" className="max-h-72 w-full rounded-lg object-contain border border-border" />
          )}
          <input
            required
            maxLength={120}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            maxLength={1000}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Tags, comma-separated (max 8)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !file}
            className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Publish"}
          </button>
        </form>
      )}
    </div>
  );
}