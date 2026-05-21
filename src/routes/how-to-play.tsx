import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  Star,
  Upload,
  Trophy,
  Sparkles,
  Camera,
  Heart,
  Ban,
  Clock,
  Crown,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { THRESHOLDS_HOURS } from "@/lib/milestone-rules";

const TIER_LABEL = ["24 ชั่วโมง", "7 วัน", "30 วัน", "90 วัน", "180 วัน"] as const;

function formatTierLabel(h: number) {
  if (h < 48) return `${h} ชั่วโมง`;
  return `${Math.round(h / 24)} วัน`;
}

const STEPS = [
  {
    icon: <Upload className="h-6 w-6" />,
    title: "อัปโหลดรูปของคุณ",
    body: "อัปโหลดได้วันละ 3 รูป เลือกรูปที่ภูมิใจที่สุด ใส่ชื่อ คำอธิบาย และแท็ก เพื่อให้คนค้นเจอง่ายขึ้น",
    color: "from-sky-500/20 to-sky-500/5",
    ring: "ring-sky-500/30",
    text: "text-sky-400",
  },
  {
    icon: <Heart className="h-6 w-6" />,
    title: "ให้คะแนนรูปคนอื่น",
    body: "โหวตรูปที่คุณชอบ 1–5 ดาว ยิ่งให้คะแนนสูง รูปนั้นยิ่งมีโอกาสขึ้นอันดับ #1",
    color: "from-rose-500/20 to-rose-500/5",
    ring: "ring-rose-500/30",
    text: "text-rose-400",
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    title: "ไต่อันดับสูงสุด",
    body: "รูปที่ได้คะแนนเฉลี่ยสูงสุดจะขึ้นอันดับ #1 ทุกคนเห็นรูปคุณบนหน้าแรกทันที",
    color: "from-amber-500/20 to-amber-500/5",
    ring: "ring-amber-500/30",
    text: "text-amber-400",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "เก็บดาว Milestone",
    body: "รูปที่ครองอันดับ #1 นานพอจะได้รับดาว Milestone สูงสุด 5 ดวง ติดตัวถาวร",
    color: "from-emerald-500/20 to-emerald-500/5",
    ring: "ring-emerald-500/30",
    text: "text-emerald-400",
  },
];

const RULES = [
  {
    good: true,
    text: "ให้คะแนนตามความชอบจริง ๆ ของคุณ",
  },
  {
    good: true,
    text: "อัปโหลดรูปที่คุณถ่ายเองหรือมีสิทธิ์แชร์",
  },
  {
    good: true,
    text: "กดติดตามช่างภาพที่คุณชอบเพื่อไม่พลาดรูปใหม่",
  },
  {
    good: false,
    text: "ห้ามโหวตรูปตัวเอง (ระบบจะบล็อกอัตโนมัติ)",
  },
  {
    good: false,
    text: "ห้ามสร้างบัญชีหลายบัญชีเพื่อโหวตซ้ำ",
  },
  {
    good: false,
    text: "ห้ามอัปโหลดรูปล่อแหลม หรือละเมิดลิขสิทธิ์",
  },
];

const FAQS = [
  {
    q: "ทำไมฉันโหวตรูปตัวเองไม่ได้?",
    a: "เพื่อความยุติธรรม ระบบจะบล็อกไม่ให้คุณโหวตรูปที่ตัวเองอัปโหลดอยู่แล้ว ให้โหวตรูปคนอื่นแทนนะ",
  },
  {
    q: "อัปโหลดได้วันละกี่รูป?",
    a: "สมาชิกทุกคนอัปโหลดได้วันละ 3 รูป เลือกชุดที่ดีที่สุดของวันนั้นให้ดี ๆ",
  },
  {
    q: "ดาว Milestone คืออะไร?",
    a: "ดาวที่รูปจะได้รับเมื่อครองอันดับ #1 เป็นเวลาต่อเนื่อง มี 5 ด่าน (24 ชม. ถึง 180 วัน) ดาวนี้ติดตัวรูปถาวร แม้จะหลุดจาก #1 แล้วก็ตาม",
  },
  {
    q: "ใครเป็นคนนับคะแนน?",
    a: "ระบบจะคำนวณคะแนนเฉลี่ยจากโหวตของสมาชิกทั้งหมดอัตโนมัติทุก 5 นาที ไม่มีมนุษย์แทรกแซง",
  },
  {
    q: "รูปที่ถูกรายงานจะเกิดอะไรขึ้น?",
    a: "แอดมินจะตรวจสอบรูปที่ถูกรายงาน หากพบว่าละเมิดกติกา รูปนั้นจะถูกซ่อนและผู้ใช้อาจถูกระงับบัญชี",
  },
];

export const Route = createFileRoute("/how-to-play")({
  head: () => ({
    meta: [
      { title: "วิธีเล่น & กติกา — SEESTAR" },
      { name: "description", content: "เรียนรู้วิธีเล่น SEESTAR กติกา ระบบดาว Milestone และเคล็ดลับการโหวตและอัปโหลดรูป" },
      { property: "og:title", content: "วิธีเล่น & กติกา — SEESTAR" },
      { property: "og:description", content: "เรียนรู้วิธีเล่น SEESTAR กติกา ระบบดาว Milestone และเคล็ดลับการโหวตและอัปโหลดรูป" },
    ],
  }),
  component: HowToPlayPage,
});

function HowToPlayPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-12 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-8 sm:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--gold)]/5 blur-3xl" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/10 px-3 py-1 text-xs font-medium text-[var(--gold)]">
            <Star className="h-3.5 w-3.5 fill-[var(--gold)]" />
            คู่มือสมาชิก
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ยินดีต้อนรับสู่ <span className="text-[var(--gold)]">SEESTAR</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            ชุมชนแชร์รูปถ่ายที่ทุกคนช่วยกันให้คะแนน 1–5 ดาว
            รูปที่ดีที่สุดจะได้ขึ้นอันดับ #1 และเก็บดาว Milestone ถาวร
            อ่านกติกาด้านล่างแล้วเริ่มเล่นได้เลย
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-[var(--gold)]/20 transition hover:opacity-90"
              >
                <Upload className="h-4 w-4" />
                อัปโหลดรูปแรก
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-[var(--gold)]/20 transition hover:opacity-90"
                >
                  <Star className="h-4 w-4" />
                  สมัครสมาชิก
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium transition hover:bg-muted"
                >
                  เข้าสู่ระบบ
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4 Steps */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/15">
            <Camera className="h-4 w-4 text-[var(--gold)]" />
          </div>
          <h2 className="text-xl font-bold">4 ขั้นตอนสู่การเป็น Star</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg",
                "bg-gradient-to-br",
                step.color
              )}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-background/80 ring-1 ring-border shadow-sm">
                <span className={step.text}>{step.icon}</span>
              </div>
              <div className="absolute right-3 top-3 text-5xl font-bold text-foreground/5">
                {i + 1}
              </div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Milestone Stars */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/15">
            <Crown className="h-4 w-4 text-[var(--gold)]" />
          </div>
          <h2 className="text-xl font-bold">ระบบดาว Milestone</h2>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8">
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            รูปที่ครองอันดับ <strong className="text-foreground">#1</strong> เป็นเวลาต่อเนื่องจะได้รับดาว Milestone
            ตามระยะเวลาดังนี้ ดาวทุกดวง <strong className="text-foreground">ถาวร</strong> — ได้แล้วไม่หาย
            แม้จะหลุดจาก #1 แล้วก็ตาม
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {THRESHOLDS_HOURS.map((h, i) => {
              const tier = i + 1;
              return (
                <div
                  key={tier}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition hover:border-[var(--gold)]/30"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: tier }).map((_, j) => (
                      <Star
                        key={j}
                        className="h-5 w-5 fill-[var(--gold)] text-[var(--gold)]"
                      />
                    ))}
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    {tier}★
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {formatTierLabel(h)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {TIER_LABEL[i]}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-xl bg-[var(--gold)]/5 border border-[var(--gold)]/10 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">เงื่อนไขเพิ่มเติม:</strong>{" "}
              ตอนเช็คด่าน รูปต้องมีคะแนนรวม (คะแนนเฉลี่ย × จำนวนโหวต){" "}
              <em>มากกว่าหรือเท่ากับ</em> รูปทุกใบที่อัปโหลด <em>หลัง</em> มัน
              ถ้ามีรูปใหม่กว่าแซงคะแนนรวม จะถูกบล็อกด่านนั้น
            </p>
          </div>
        </div>
      </section>

      {/* Rules Do/Don't */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/15">
            <Ban className="h-4 w-4 text-[var(--gold)]" />
          </div>
          <h2 className="text-xl font-bold">กติกาสำคัญ</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              สิ่งที่ควรทำ
            </h3>
            <ul className="space-y-3">
              {RULES.filter((r) => r.good).map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-rose-400">
              <XCircle className="h-4 w-4" />
              สิ่งที่ห้ามทำ
            </h3>
            <ul className="space-y-3">
              {RULES.filter((r) => !r.good).map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/15">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" />
          </div>
          <h2 className="text-xl font-bold">คำถามที่พบบ่อย</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-border bg-card/60 transition open:bg-card"
            >
              <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-foreground select-none">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  {faq.q}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
              </summary>
              <div className="px-4 pb-4 pl-12 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="rounded-3xl border border-border bg-gradient-to-br from-[var(--gold)]/10 via-card to-muted/30 p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight">
          พร้อมเป็น <span className="text-[var(--gold)]">Star</span> แล้วหรือยัง?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          เริ่มต้นง่าย ๆ — สมัครสมาชิก อัปโหลดรูปแรก และรับคะแนนจากชุมชน
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {user ? (
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-[var(--gold)]/20 transition hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              อัปโหลดรูปตอนนี้
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-[var(--gold)]/20 transition hover:opacity-90"
              >
                <Star className="h-4 w-4" />
                สมัครเลย
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium transition hover:bg-muted"
              >
                ดูรูปในชุมชนก่อน
                <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
