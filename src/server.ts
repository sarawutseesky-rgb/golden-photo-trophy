import "./lib/error-capture";

import {
  clearSsrErrorBuffer,
  consumeLastCapturedError,
  getSsrErrorBuffer,
  recordSsrError,
} from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isDebugEnabled(request: Request): boolean {
  if (process.env.SSR_DEBUG === "1") return true;
  const cookie = request.headers.get("cookie") ?? "";
  if (/(?:^|;\s*)ssr_debug=1(?:;|$)/.test(cookie)) return true;
  const url = new URL(request.url);
  return url.searchParams.get("__ssrdebug") === "1";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function renderDebugErrorPage(url: string, raw: string, error: unknown): string {
  const e = error as { name?: string; message?: string; stack?: string } | undefined;
  const name = e?.name ?? "Unknown";
  const message = e?.message ?? String(error ?? "Unknown error");
  const stack = e?.stack ?? "(no stack)";
  return `<!doctype html><html><head><meta charset="utf-8"><title>SSR debug — ${escapeHtml(name)}</title>
<style>body{font:13px ui-monospace,Menlo,monospace;background:#0f172a;color:#f1f5f9;margin:0;padding:24px}
h1{font:600 16px system-ui;color:#fca5a5;margin:0 0 8px}.meta{color:#94a3b8;margin-bottom:16px}
pre{background:#1e293b;border:1px solid #334155;padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap;word-break:break-word}
a{color:#fbbf24}</style></head><body>
<h1>SSR render failed: ${escapeHtml(name)}: ${escapeHtml(message)}</h1>
<div class="meta">URL: ${escapeHtml(url)} · <a href="/__ssr-debug">view buffer</a> · <a href="${escapeHtml(url)}">retry</a></div>
<h2 style="font:600 13px system-ui;margin:16px 0 6px">Stack</h2><pre>${escapeHtml(stack)}</pre>
<h2 style="font:600 13px system-ui;margin:16px 0 6px">Raw h3 body</h2><pre>${escapeHtml(raw)}</pre>
</body></html>`;
}

function renderDebugBufferPage(): string {
  const entries = getSsrErrorBuffer();
  const rows = entries.length === 0
    ? "<p>No errors recorded yet.</p>"
    : entries.map((e) => `
      <details ${entries.indexOf(e) === 0 ? "open" : ""}>
        <summary><b>${escapeHtml(e.name ?? "Error")}</b>: ${escapeHtml(e.message)}
        <span style="color:#94a3b8">— ${new Date(e.at).toISOString()} · ${escapeHtml(e.source)}${e.url ? " · " + escapeHtml(e.url) : ""}</span></summary>
        <pre>${escapeHtml(e.stack ?? "(no stack)")}</pre>
        ${e.raw ? `<details><summary>raw</summary><pre>${escapeHtml(e.raw)}</pre></details>` : ""}
      </details>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>SSR debug buffer</title>
<style>body{font:13px ui-monospace,Menlo,monospace;background:#0f172a;color:#f1f5f9;margin:0;padding:24px;max-width:1100px}
h1{font:600 16px system-ui;margin:0 0 4px}.bar{color:#94a3b8;margin:0 0 16px}
pre{background:#1e293b;border:1px solid #334155;padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0}
details{background:#1e293b;border:1px solid #334155;padding:8px 12px;border-radius:6px;margin-bottom:8px}
summary{cursor:pointer}a{color:#fbbf24}</style></head><body>
<h1>SSR error buffer (${entries.length})</h1>
<div class="bar">
  <a href="?clear=1">clear</a> ·
  <a href="?off=1">disable debug</a> ·
  <a href="/">home</a>
</div>${rows}</body></html>`;
}

function handleDebugRoute(request: Request): Response {
  const url = new URL(request.url);
  if (url.searchParams.get("on") === "1") {
    const h = new Headers({ location: "/__ssr-debug" });
    h.append("set-cookie", "ssr_debug=1; Path=/; Max-Age=86400; SameSite=Lax");
    return new Response(null, { status: 302, headers: h });
  }
  if (url.searchParams.get("off") === "1") {
    const h = new Headers({ location: "/" });
    h.append("set-cookie", "ssr_debug=; Path=/; Max-Age=0; SameSite=Lax");
    return new Response(null, { status: 302, headers: h });
  }
  if (url.searchParams.get("clear") === "1") {
    clearSsrErrorBuffer();
    return new Response(null, { status: 302, headers: { location: "/__ssr-debug" } });
  }
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(getSsrErrorBuffer(), null, 2), {
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(renderDebugBufferPage(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  const captured = consumeLastCapturedError();
  const err = captured ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(err);
  recordSsrError("ssr-h3-swallow", err, request.url, body);

  if (isDebugEnabled(request)) {
    return new Response(renderDebugErrorPage(request.url, body, err), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/__ssr-debug") {
      return handleDebugRoute(request);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      console.error(error);
      recordSsrError("ssr-throw", error, request.url);
      if (isDebugEnabled(request)) {
        return new Response(renderDebugErrorPage(request.url, "", error), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return brandedErrorResponse();
    }
  },
};
