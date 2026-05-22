import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "seestar-install-dismissed-at";
const DISMISS_DAYS = 7;
const PILL_HIDE_KEY = "seestar-install-pill-hidden"; // sessionStorage
const SESSION_ID_KEY = "seestar-install-session-id";
const SHOWN_THIS_SESSION_KEY = "seestar-install-shown"; // sessionStorage
const LATER_KEY = "seestar-install-later-at"; // localStorage
const LATER_HOURS = 24; // after "ไว้ก่อน" wait this long before showing again

type InstallEvent =
  | "prompt_shown"
  | "prompt_shown_ios"
  | "install_clicked"
  | "install_accepted"
  | "install_dismissed"
  | "later_clicked"
  | "pill_hidden"
  | "app_installed";

function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function detectPlatform(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

async function logEvent(event: InstallEvent) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("install_events").insert({
      event,
      platform: detectPlatform(),
      standalone: isStandalone(),
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch {
    /* ignore tracking failures */
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const days = (Date.now() - Number(v)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function recentlyLater() {
  try {
    const v = localStorage.getItem(LATER_KEY);
    if (!v) return false;
    const hours = (Date.now() - Number(v)) / (1000 * 60 * 60);
    return hours < LATER_HOURS;
  } catch {
    return false;
  }
}

function shownThisSession() {
  try {
    return sessionStorage.getItem(SHOWN_THIS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

function supportsPwaInstall() {
  if (typeof window === "undefined") return false;
  // Real Android/desktop support is signalled by beforeinstallprompt (handled live).
  // iOS Safari (not in-app browsers, not Chrome iOS) supports Add to Home Screen.
  if (isIos()) {
    const ua = window.navigator.userAgent;
    // Exclude in-app browsers (FB, Line, IG, etc.) and non-Safari iOS browsers.
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios|fbav|fban|line|instagram|micromessenger/i.test(ua);
    return isSafari;
  }
  return true; // wait for beforeinstallprompt to confirm
}

function inPreviewOrIframe() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  if (host.includes("id-preview--") || host.includes("lovableproject.com")) return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [pillHidden, setPillHidden] = useState(false);
  const [iosReady, setIosReady] = useState(false);

  useEffect(() => {
    if (inPreviewOrIframe()) return;
    if (isStandalone()) return;
    if (!supportsPwaInstall()) return;

    try {
      if (sessionStorage.getItem(PILL_HIDE_KEY) === "1") setPillHidden(true);
    } catch {
      /* ignore */
    }

    const blocked = recentlyDismissed() || recentlyLater() || shownThisSession();

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setAvailable(true);
      if (!blocked) {
        setOpen(true);
        markShownThisSession();
        void logEvent("prompt_shown");
      }
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const onInstalled = () => {
      setOpen(false);
      setAvailable(false);
      setDeferred(null);
      void logEvent("app_installed");
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari has no beforeinstallprompt — show manual instructions after a delay.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      iosTimer = setTimeout(() => {
        setShowIos(true);
        setIosReady(true);
        setAvailable(true);
        if (!blocked) {
          setOpen(true);
          markShownThisSession();
          void logEvent("prompt_shown_ios");
        }
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    void logEvent("install_dismissed");
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const later = () => {
    setOpen(false);
    void logEvent("later_clicked");
    try {
      localStorage.setItem(LATER_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const hidePill = () => {
    setPillHidden(true);
    void logEvent("pill_hidden");
    try {
      sessionStorage.setItem(PILL_HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const reopen = () => {
    if (isIos()) setShowIos(true);
    setOpen(true);
  };

  const install = async () => {
    if (!deferred) return;
    void logEvent("install_clicked");
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "dismissed") {
        dismiss();
      } else {
        void logEvent("install_accepted");
        setOpen(false);
        setAvailable(false);
      }
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
    }
  };

  if (!open) {
    // Show persistent floating pill if install is available and user hasn't hidden it this session.
    if (!available || pillHidden) return null;
    if (isIos() && !iosReady) return null;
    return (
      <div className="fixed bottom-3 right-3 z-[80] sm:bottom-4 sm:right-4">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 pl-3 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={reopen}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
            aria-label="ติดตั้งแอป SEESTAR"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            ติดตั้งแอป
          </button>
          <button
            type="button"
            onClick={hidePill}
            aria-label="ซ่อนชั่วคราว"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="ติดตั้งแอป SEESTAR"
      className="fixed inset-x-0 bottom-0 z-[80] mx-auto w-full max-w-md p-3 sm:bottom-4"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิด"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
            <img src="/icon-192.png" alt="" className="h-12 w-12" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              ติดตั้ง SEESTAR บนเครื่อง
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              เปิดเร็วขึ้น เต็มจอ และเข้าถึงจากหน้าโฮมได้เลย
            </p>

            {showIos ? (
              <div className="mt-3 space-y-2 rounded-lg bg-muted/60 p-3 text-xs text-foreground">
                <p className="flex items-center gap-1.5">
                  <span>1.</span> แตะปุ่มแชร์
                  <Share className="h-3.5 w-3.5 text-primary" />
                  ด้านล่างของ Safari
                </p>
                <p className="flex items-center gap-1.5">
                  <span>2.</span> เลือก <span className="font-medium">Add to Home Screen</span>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <Link
                    to="/ios-install-guide"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                  >
                    <Info className="h-3.5 w-3.5" />
                    รายละเอียด
                  </Link>
                  <Button size="sm" variant="ghost" onClick={later}>
                    ไว้ก่อน
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} className="flex-1">
                  <Download className="mr-1.5 h-4 w-4" />
                  ติดตั้ง
                </Button>
                <Button size="sm" variant="ghost" onClick={later}>
                  ไว้ก่อน
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
