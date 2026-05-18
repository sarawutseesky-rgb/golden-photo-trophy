import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile } from "@/lib/profile.functions";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";
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
  head: () => ({ meta: [{ title: "Edit Profile — StarShot" }] }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const updateFn = useServerFn(updateProfile);

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
      toast.error(err.message || "Failed to remove avatar");
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
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <Link
          to="/profile/$id"
          params={{ id: user.id }}
          className="text-sm text-[var(--gold)] hover:underline"
        >
          View public profile
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt="avatar"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground ring-2 ring-border">
                {displayName.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <span className="text-xs">Uploading…</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || formDisabled}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
              >
                Change avatar
              </button>
              {(avatarUrl || previewUrl) && (
                <button
                  type="button"
                  onClick={() => setShowRemoveDialog(true)}
                  disabled={formDisabled}
                  className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-60"
                >
                  Remove avatar
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG or PNG, max 2 MB</p>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="mb-1 block text-sm font-medium">Display name</label>
          <input
            required
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={formDisabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea
            maxLength={500}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={formDisabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
            placeholder="Tell others about yourself…"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/500</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={formDisabled}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : removingAvatar ? "Removing…" : "Save changes"}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              disabled={formDisabled}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Cancel new avatar
            </button>
          )}
        </div>
      </form>

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
