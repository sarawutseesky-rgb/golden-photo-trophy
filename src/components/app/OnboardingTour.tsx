import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Star, Upload, Trophy, Sparkles } from "lucide-react";

const STORAGE_KEY_USER = "seestar_onboarded_v1";
const STORAGE_KEY_GUEST = "seestar_guest_tour_v1";

type Step = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

const USER_STEPS: Step[] = [
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

const GUEST_STEPS: Step[] = [
  {
    icon: <Star className="h-6 w-6 text-[var(--gold)]" />,
    title: "1. โหวต 1–5 ดาว",
    body:
      "แตะดาวบนรูปที่ชอบเพื่อให้คะแนน ทุกโหวตช่วยดันให้ช่างภาพคนโปรดขึ้น #1 ได้",
  },
  {
    icon: <Upload className="h-6 w-6 text-[var(--gold)]" />,
    title: "2. อัปโหลดรูปของคุณ",
    body:
      "สมัครฟรีแล้วอัปได้วันละ 1 รูป ใส่ชื่อ + แท็ก เพื่อให้คนค้นเจอและโหวตให้ง่ายขึ้น",
  },
  {
    icon: <Sparkles className="h-6 w-6 text-[var(--gold)]" />,
    title: "3. เก็บดาว Milestone ถาวร",
    body:
      "รูปที่ทนทาน ไม่ถูกแซงตามช่วงเวลา (24ชม. / 7วัน / 30วัน / 90วัน / 180วัน) จะได้ดาวถาวรติดรูปไปตลอด",
  },
];

export function OnboardingTour() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const isGuest = !loading && !user;
  const STEPS = useMemo(() => (isGuest ? GUEST_STEPS : USER_STEPS), [isGuest]);
  const storageKey = isGuest ? STORAGE_KEY_GUEST : STORAGE_KEY_USER;

  useEffect(() => {
    if (loading) return;
    try {
      if (localStorage.getItem(storageKey)) return;
      // Small delay so it doesn't appear at the same instant as the page paints
      const t = setTimeout(() => setOpen(true), isGuest ? 1200 : 600);
      return () => clearTimeout(t);
    } catch {
      // localStorage unavailable — silently skip
    }
  }, [loading, isGuest, storageKey]);

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "1");
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
            ) : isGuest ? (
              <Link
                to="/signup"
                onClick={finish}
                className="rounded-md bg-[var(--gold)] px-4 py-1.5 text-sm font-semibold text-background hover:opacity-90"
              >
                สมัครฟรี
              </Link>
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