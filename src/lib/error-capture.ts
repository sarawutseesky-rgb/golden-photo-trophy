// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also keeps a small ring buffer of recent SSR errors for the debug page.

const TTL_MS = 5_000;
const RING_SIZE = 25;

export type SsrErrorEntry = {
  at: number;
  url?: string;
  source: "global" | "ssr-throw" | "ssr-h3-swallow";
  name?: string;
  message: string;
  stack?: string;
  raw?: string;
};

let lastCapturedError: { error: unknown; at: number } | undefined;
const ringBuffer: SsrErrorEntry[] = [];

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

export function recordSsrError(
  source: SsrErrorEntry["source"],
  error: unknown,
  url?: string,
  raw?: string,
) {
  const e = error as { name?: string; message?: string; stack?: string } | undefined;
  const entry: SsrErrorEntry = {
    at: Date.now(),
    url,
    source,
    name: e?.name,
    message: e?.message ?? (typeof error === "string" ? error : String(error ?? "Unknown error")),
    stack: e?.stack,
    raw,
  };
  ringBuffer.push(entry);
  if (ringBuffer.length > RING_SIZE) ringBuffer.shift();
}

export function getSsrErrorBuffer(): SsrErrorEntry[] {
  return ringBuffer.slice().reverse();
}

export function clearSsrErrorBuffer() {
  ringBuffer.length = 0;
}
