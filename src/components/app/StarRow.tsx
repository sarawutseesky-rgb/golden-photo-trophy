import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRow({ count, max = 5, size = 16 }: { count: number; max?: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={cn(
            "transition-all",
            i < count
              ? "fill-[var(--gold)] text-[var(--gold)] drop-shadow-[0_0_6px_var(--gold-glow)]"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}