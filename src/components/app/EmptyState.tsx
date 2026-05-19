import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Star, Users, ImageOff } from "lucide-react";

type Variant = "upload" | "vote" | "follow" | "generic";

const ICONS: Record<Variant, typeof Camera> = {
  upload: Camera,
  vote: Star,
  follow: Users,
  generic: ImageOff,
};

export type EmptyStateAction =
  | { kind: "link"; to: string; label: string; primary?: boolean; params?: Record<string, string> }
  | { kind: "button"; onClick: () => void; label: string; primary?: boolean };

export function EmptyState({
  variant = "generic",
  title,
  description,
  actions,
  children,
}: {
  variant?: Variant;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  children?: ReactNode;
}) {
  const Icon = ICONS[variant];
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center animate-fade-in">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-[var(--gold,theme(colors.amber.400))]/15 blur-2xl"
        />
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-muted to-background ring-1 ring-border">
          <Icon className="h-9 w-9 text-[var(--gold,theme(colors.amber.400))]" strokeWidth={1.5} />
        </div>
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && actions.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) => {
            const cls = a.primary
              ? "rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              : "rounded-full border border-input bg-background px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent";
            if (a.kind === "link") {
              return (
                <Link key={i} to={a.to as any} params={a.params as any} className={cls}>
                  {a.label}
                </Link>
              );
            }
            return (
              <button key={i} type="button" onClick={a.onClick} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}