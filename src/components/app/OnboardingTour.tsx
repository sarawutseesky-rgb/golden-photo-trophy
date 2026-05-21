import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Star, Upload, Trophy, Sparkles } from "lucide-react";

const STORAGE_KEY = "seestar_onboarded_v1";

type Step = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: <Star className="h-6 w-6 text-[var(--gold)]" />,
    title: "ยินดีต้อนรับสู่ SEESTAR ⭐",
    body:
      "ชุมชนแชร์รูปถ่ายที่ทุกคนช่วยกันให้คะแนน 1–5 ดาว รูปที่ดีที่สุดจะได้ขึ้นอันดับ #1 และเก็บดาว Milestone ถาวร",
  },
  {
    icon: <Upload className="h-6 w-6 text-[var(--gold)]" />,
    title: "อัปโหลดรูปของคุณ",
    body:
      "อัปได้วันละ 1 รูป เลือกรูปที่ภูมิใจที่สุด ใส่ชื่อ คำอธิบาย และแท็ก เพื่อให้คนค้นเจอง่ายขึ้น",
  },
  {
    icon: <Trophy className="h-6 w-6 text-[var(--gold)]" />,
    title: "โหวต & ไต่อันดับ",
    body:
      "ให้คะแนนรูปคนอื่น 1–5 ดาว (โหวตรูปตัวเองไม่ได้นะ) รูปไหนได้คะแนนเฉลี่ยสูงสุดจะขึ้น #1",
  },
  {
    icon: <Sparkles className="h-6 w-6 text-[var(--gold)]" />,
    title: "ดาว Milestone ถาวร",
    body:
      "ทุก ๆ ระยะเวลาที่รูปคุณครองอันดับ #1 จะได้รับดาว Milestone (สูงสุด 5 ดวง) ติดตัวรูปนั้นตลอดไป แม้จะหลุดจาก #1 แล้วก็ตาม",
  },
];

export function OnboardingTour() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      // Small delay so it doesn't appear at the same instant as the page paints
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    } catch {
      // localStorage unavailable — silently skip
    }
  }, [user, loading]);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    setStep(0);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : finish())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--gold)_15%,transparent)]">
            {current.icon}
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === step ? "w-6 bg-[var(--gold)]" : "w-1.5 bg-muted")
              }
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <button
            type="button"
            onClick={finish}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ข้าม
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                ย้อนกลับ
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="rounded-md bg-[var(--gold)] px-4 py-1.5 text-sm font-semibold text-background hover:opacity-90"
              >
                ถัดไป
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="rounded-md bg-[var(--gold)] px-4 py-1.5 text-sm font-semibold text-background hover:opacity-90"
              >
                เริ่มเลย
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}