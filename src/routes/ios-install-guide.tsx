import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Share,
  Plus,
  Home,
  ArrowLeft,
  Smartphone,
  Zap,
  Maximize,
  CheckCircle2,
} from "lucide-react";

const BENEFITS = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: "เปิดเร็วขึ้น",
    desc: "ไม่ต้องพิมพ์ URL ใหม่ทุกครั้ง แตะไอคอนบนหน้าโฮมแล้วเข้าใช้งานได้เลย",
  },
  {
    icon: <Maximize className="h-5 w-5" />,
    title: "เต็มจอ",
    desc: "ซ่อนแถบที่อยู่และแถบเครื่องมือของ Safari ใช้พื้นที่หน้าจอเต็ม 100%",
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: "เหมือนแอปจริง",
    desc: "มีไอคอนบนหน้าโฮม สลับแอปได้ปกติ ราวกับเป็นแอปที่ติดตั้งจาก App Store",
  },
];

const STEPS = [
  {
    num: 1,
    title: "แตะปุ่มแชร์",
    desc: "ใน Safari แตะปุ่ม",
    highlight: "แชร์",
    after: "ที่อยู่ด้านล่างของแถบเครื่องมือ",
    icon: <Share className="h-5 w-5 text-primary" />,
  },
  {
    num: 2,
    title: "เลื่อนหา 'Add to Home Screen'",
    desc: "ในแผ่นเมนูที่ขึ้นมา ให้เลื่อนลงมาหาตัวเลือก",
    highlight: "Add to Home Screen",
    after: "อาจอยู่ใกล้ล่างสุดของรายการ",
    icon: <Plus className="h-5 w-5 text-primary" />,
  },
  {
    num: 3,
    title: "แตะ 'Add'",
    desc: "หน้าต่างยืนยันจะปรากฏขึ้น ให้แตะปุ่ม",
    highlight: "Add",
    after: "อีกครั้ง",
    icon: <Home className="h-5 w-5 text-primary" />,
  },
];

export const Route = createFileRoute("/ios-install-guide")({
  head: () => ({
    meta: [
      { title: "ติดตั้ง SEESTAR บน iPhone / iPad" },
      { name: "description", content: "คู่มือติดตั้ง SEESTAR บนหน้าโฮมสกรีนของ iPhone และ iPad ผ่าน Safari" },
      { property: "og:title", content: "ติดตั้ง SEESTAR บน iPhone / iPad" },
      { property: "og:description", content: "คู่มือติดตั้ง SEESTAR บนหน้าโฮมสกรีนของ iPhone และ iPad ผ่าน Safari" },
    ],
  }),
  component: IosInstallGuidePage,
});

function IosInstallGuidePage() {
  return (
    <div className="mx-auto max-w-xl space-y-10 pb-12 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-6 sm:p-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <img src="/icon-192.png" alt="SEESTAR" className="h-16 w-16" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ติดตั้ง <span className="text-primary">SEESTAR</span> บน iPhone
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            3 ขั้นตอนง่าย ๆ ผ่าน Safari ไม่ต้องดาวน์โหลดจาก App Store
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section>
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          ทำไมต้องติดตั้ง?
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-border bg-card/60 p-4 text-center transition hover:border-primary/20"
            >
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {b.icon}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section>
        <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          ขั้นตอนการติดตั้ง
        </h2>
        <div className="relative space-y-4">
          {/* Connecting line */}
          <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />

          {STEPS.map((step) => (
            <div
              key={step.num}
              className="relative flex items-start gap-4 rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/20"
            >
              {/* Number circle */}
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-4 ring-background">
                {step.num}
              </div>
              <div className="min-w-5 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {step.title}
                  </span>
                  <span className="text-primary">{step.icon}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}{" "}
                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {step.highlight}
                  </span>{" "}
                  {step.after}
                </p>
              </div>
            </div>
          ))}
        </h2>
      </section>

      {/* Done check */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 text-base font-semibold text-foreground">
          เสร็จแล้ว!
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          ตอนนี้คุณจะเห็นไอคอน SEESTAR บนหน้าโฮมของ iPhone แล้ว
          แตะไอคอนเพื่อเปิดแอปได้ทันที
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
        >
          <Home className="h-4 w-4" />
          กลับไปหน้าแรก
        </Link>
      </section>

      {/* Troubleshooting */}
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground">ไม่เจอ "Add to Home Screen"?</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            ตรวจสอบว่าคุณเปิดผ่าน <strong className="text-foreground">Safari</strong> จริง ๆ (ไม่ใช่ Chrome, Facebook, หรือแอปอื่นที่ฝังเว็บไว้)
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            หากเปิดผ่านแอปอื่น ให้แตะ <strong className="text-foreground">เปิดใน Safari</strong> ก่อน
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            บางครั้งตัวเลือกอยู่ในเมนูย่อย <strong className="text-foreground">Options</strong> ของปุ่มแชร์
          </li>
        </ul>
      </section>
    </div>
  );
}
