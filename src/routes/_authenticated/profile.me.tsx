import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile } from "@/lib/profile.functions";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/profile/me")({
  head: () => ({ meta: [{ title: "Edit Profile — SEESTAR" }] }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const updateFn = useServerFn(updateProfile);
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, bio, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setBio(data.bio ?? "");
          setAvatarUrl(data.avatar_url ?? null);
        }
      });
  }, [user]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 400, 0.85);
      const path = `${user.id}/avatar.jpg`;
      const { error: upError } = await supabase.storage
        .from("photos")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (upError) throw upError;
      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
      setPreviewUrl(urlData.publicUrl + "?t=" + Date.now());
      toast.success("Avatar uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doRemoveAvatar = async () => {
    setRemovingAvatar(true);
    try {
      if (user) {
        await supabase.storage
          .from("photos")
          .remove([`${user.id}/avatar.jpg`]);
      }
      setPreviewUrl(null);
      setAvatarUrl(null);
      setShowRemoveDialog(false);
      toast.success("Avatar removed", {
        description: "Your profile picture has been reset to the default avatar.",
      });
    } catch (err: any) {
      const reason = err.message || "An unknown error occurred";
      toast.error("Failed to remove avatar", {
        description: `Reason: ${reason}. Please try again in a moment. If the problem persists, check your connection or contact support.`,
      });
    } finally {
      setRemovingAvatar(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_url: previewUrl ?? avatarUrl,
        },
      });
      if (previewUrl) setAvatarUrl(previewUrl);
      setPreviewUrl(null);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  const currentAvatar = previewUrl ?? avatarUrl;
  const formDisabled = saving || removingAvatar;

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-7 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <h1 className="text-2xl font-bold tracking-tight">Edit Profile</h1>
          <Link
            to="/profile/$id"
            params={{ id: user.id }}
            className="text-sm font-medium text-[var(--gold)] transition-colors hover:opacity-80"
          >
            View public profile
          </Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-10 px-6 pb-8 sm:px-8">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="group relative">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="avatar"
                  className="h-24 w-24 rounded-full object-cover shadow-lg ring-2 ring-border"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold shadow-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--gold) 0%, color-mix(in oklab, var(--gold) 55%, white) 100%)",
                    color: "hsl(var(--background))",
                  }}
                >
                  {displayName.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || formDisabled}
                aria-label="Change avatar"
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
              >
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 text-xs">
                  Uploading…
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <div className="flex flex-col gap-3 text-center sm:text-left">
              <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || formDisabled}
                  className="rounded-lg border border-border bg-accent/40 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
                >
                  Change avatar
                </button>
                {(avatarUrl || previewUrl) && (
                  <button
                    type="button"
                    onClick={() => setShowRemoveDialog(true)}
                    disabled={formDisabled}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG or PNG, max 2 MB</p>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="ml-1 block text-sm font-semibold text-muted-foreground">Display name</label>
              <input
                required
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-xl border border-border bg-accent/30 px-4 py-3 text-sm transition-all placeholder:text-muted-foreground focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <div className="ml-1 flex items-center justify-between">
                <label className="text-sm font-semibold text-muted-foreground">Bio</label>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                  {bio.length} / 500
                </span>
              </div>
              <textarea
                maxLength={500}
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={formDisabled}
                placeholder="Tell others about yourself…"
                className="w-full resize-none rounded-xl border border-border bg-accent/30 px-4 py-3 text-sm transition-all placeholder:text-muted-foreground focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-4">
            <div className="ml-1">
              <h3 className="text-sm font-semibold text-muted-foreground">Appearance</h3>
              <p className="mt-0.5 text-xs text-muted-foreground/80">Choose your preferred interface style</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Light */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "rounded-xl border-2 bg-accent/30 p-3 text-left transition-all hover:bg-accent/50",
                  theme === "light" ? "border-[var(--gold)]" : "border-border"
                )}
              >
                <div className="mb-3 flex aspect-video flex-col space-y-1.5 overflow-hidden rounded-md bg-[#f8fafc] p-2">
                  <div className="h-2 w-1/2 rounded-full bg-slate-200" />
                  <div className="h-2 w-3/4 rounded-full bg-slate-100" />
                  <div className="mt-auto flex gap-1.5">
                    <div className="h-4 w-4 rounded-sm bg-slate-200" />
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-slate-100" />
                      <div className="h-1.5 w-2/3 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    theme === "light" ? "border-[var(--gold)] bg-[var(--gold)]" : "border-muted-foreground"
                  )}>
                    {theme === "light" && <Check className="h-2.5 w-2.5 text-background" />}
                  </div>
                  <span className="text-xs font-medium">Light</span>
                </div>
              </button>

              {/* Dark */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "rounded-xl border-2 bg-accent/30 p-3 text-left transition-all hover:bg-accent/50",
                  theme === "dark" ? "border-[var(--gold)]" : "border-border"
                )}
              >
                <div className="mb-3 flex aspect-video flex-col space-y-1.5 overflow-hidden rounded-md bg-[#0a0b1e] p-2 ring-1 ring-white/10">
                  <div className="h-2 w-1/2 rounded-full bg-white/10" />
                  <div className="h-2 w-3/4 rounded-full bg-white/5" />
                  <div className="mt-auto flex gap-1.5">
                    <div className="h-4 w-4 rounded-sm bg-white/10" />
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-white/5" />
                      <div className="h-1.5 w-2/3 rounded-full bg-white/5" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    theme === "dark" ? "border-[var(--gold)] bg-[var(--gold)]" : "border-muted-foreground"
                  )}>
                    {theme === "dark" && <Check className="h-2.5 w-2.5 text-background" />}
                  </div>
                  <span className="text-xs font-medium">Dark</span>
                </div>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                disabled={formDisabled}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              >
                Cancel new avatar
              </button>
            ) : <span />}
            <button
              type="submit"
              disabled={formDisabled}
              className="rounded-xl bg-[var(--gold)] px-8 py-3 text-sm font-bold text-background shadow-[0_0_20px_color-mix(in_oklab,var(--gold)_25%,transparent)] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Saving…" : removingAvatar ? "Removing…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Remove avatar confirmation */}
      <AlertDialog open={showRemoveDialog} onOpenChange={(open) => { if (!removingAvatar) setShowRemoveDialog(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove avatar?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile picture will be removed and replaced with the default avatar. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingAvatar} onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removingAvatar}
              onClick={doRemoveAvatar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            >
              {removingAvatar ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
