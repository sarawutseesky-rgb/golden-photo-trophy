/**
 * Client-side guard against stale bundles referencing serverFn IDs that no
 * longer exist after a dev/server restart. When we detect a failed
 * `/_serverFn/...` response, we force a one-time hard reload with a
 * cache-busting query param so the browser pulls the fresh client bundle
 * (and the new serverFn IDs that match it).
 */
const RELOAD_FLAG = "__seestar_stale_bundle_reloaded";
const RELOAD_TS_KEY = "__seestar_stale_bundle_reload_ts";
const COOLDOWN_MS = 30_000;

function shouldReload(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return false;
    const last = Number(localStorage.getItem(RELOAD_TS_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function triggerReload() {
  try {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    localStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  url.searchParams.set("__v", Date.now().toString(36));
  window.location.replace(url.toString());
}

async function looksLikeStaleServerFn(res: Response): Promise<boolean> {
  // Unknown serverFn IDs typically yield 404 or 500 with a body that mentions
  // the missing fn. Be conservative: only act on error statuses.
  if (res.ok) return false;
  if (res.status !== 404 && res.status !== 500) return false;
  try {
    const text = await res.clone().text();
    return /serverFn|server function|not found|Unknown|schema cache/i.test(text);
  } catch {
    return res.status === 404;
  }
}

export function installStaleBundleGuard() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __seestarGuardInstalled?: boolean };
  if (w.__seestarGuardInstalled) return;
  w.__seestarGuardInstalled = true;

  // Clear the reload flag after a successful load — but keep cooldown.
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignore
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await origFetch(input as RequestInfo, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes("/_serverFn/") && (await looksLikeStaleServerFn(res))) {
        if (shouldReload()) {
          console.warn("[seestar] stale serverFn detected, hard-reloading…", url);
          triggerReload();
        }
      }
    } catch {
      // never let the guard break a real request
    }
    return res;
  };
}