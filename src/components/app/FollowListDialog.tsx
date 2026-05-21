import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFollows } from "@/lib/follows.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  kind: "followers" | "following";
};

export function FollowListDialog({ open, onOpenChange, userId, kind }: Props) {
  const fn = useServerFn(listFollows);
  const { data, isLoading } = useQuery({
    queryKey: ["follow-list", userId, kind],
    queryFn: () => fn({ data: { id: userId, kind } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "followers" ? "Followers" : "Following"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !data?.users.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {kind === "followers" ? "ยังไม่มีผู้ติดตาม" : "ยังไม่ได้ติดตามใคร"}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.users.map((u) => (
                <li key={u.id}>
                  <Link
                    to="/profile/$id"
                    params={{ id: u.id }}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 py-2.5 hover:bg-accent/40 rounded-md px-2"
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.display_name}
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground ring-1 ring-border">
                        {u.display_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{u.display_name}</div>
                      {u.bio && (
                        <div className="truncate text-xs text-muted-foreground">{u.bio}</div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}