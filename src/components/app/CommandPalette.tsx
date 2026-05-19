import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, Image as ImageIcon, User as UserIcon, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchAll } from "@/lib/search.functions";

type Ctx = { open: boolean; setOpen: (v: boolean) => void };

export function useCommandPalette(): Ctx {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" focuses search when not typing.
      if (k === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, setOpen }: Ctx) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const fn = useServerFn(searchAll);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setDebounced(q.trim()), 180);
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [q]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setDebounced("");
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => fn({ data: { q: debounced } }),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  });

  const go = (to: string) => {
    setOpen(false);
    // Use a microtask so cmdk has time to close, avoids focus jank.
    queueMicrotask(() => navigate({ to }));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search photos, tags, people…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {debounced.length === 0 ? (
          <CommandEmpty>Type to search photos, tags, or people.</CommandEmpty>
        ) : isFetching && !data ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : (data?.photos.length ?? 0) === 0 && (data?.profiles.length ?? 0) === 0 ? (
          <CommandEmpty>No results for “{debounced}”.</CommandEmpty>
        ) : (
          <>
            {data?.photos?.length ? (
              <CommandGroup heading="Photos & tags">
                {data.photos.map((p: any) => (
                  <CommandItem
                    key={`photo-${p.id}`}
                    value={`photo-${p.id}-${p.title}`}
                    onSelect={() => go(`/photo/${p.id}`)}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className="mr-2 h-8 w-8 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{p.title}</span>
                      <span className="text-xs text-muted-foreground">
                        ★ {Number(p.avg_score ?? 0).toFixed(2)} · {p.vote_count ?? 0} votes
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data?.profiles?.length ? (
              <CommandGroup heading="People">
                {data.profiles.map((u: any) => (
                  <CommandItem
                    key={`user-${u.id}`}
                    value={`user-${u.id}-${u.display_name}`}
                    onSelect={() => go(`/profile/${u.id}`)}
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="mr-2 h-7 w-7 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate">{u.display_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open search (Cmd+K)"
      className="hidden items-center gap-2 rounded-md border border-input bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:inline-flex"
    >
      <Search className="h-4 w-4" />
      <span>Search…</span>
      <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
