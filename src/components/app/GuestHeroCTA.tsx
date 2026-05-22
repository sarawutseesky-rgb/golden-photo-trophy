import { Link } from "@tanstack/react-router";
import { Camera, ArrowRight, Trophy } from "lucide-react";

export function GuestHeroCTA() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--gold)_25%,transparent)] bg-gradient-to-r from-[color-mix(in_oklab,var(--gold)_10%,transparent)] to-[color-mix(in_oklab,var(--primary)_8%,transparent)] p-4 sm:p-5">
      {/* Subtle shimmer overlay */}
      <div className="shimmer absolute inset-1 rounded-lg opacity-30" />

      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--gold)_20%,transparent)]">
            <Camera className="h-5 w-5 text-[var(--gold)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              สมัครฟรี อัปโหลดรูปแรก ลุ้น{" "}
              <span className="inline-flex items-center gap-0.5 text-[var(--gold)]">
                <Trophy className="h-3.5 w-3.5" />
                #1
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              โหวตรูปคนอื่น อัปรูปตัวเอง ไต่อันดับช่างภาพยอดนิยม
            </p>
          </div>
        </div>

        <Link
          to="/signup"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-background transition-all hover:opacity-90 hover:shadow-[0_0_20px_color-mix(in_oklab,var(--gold)_40%,transparent)]"
        >
          สมัครฟรี
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
