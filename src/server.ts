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
summary{cursor:pointer}a,button.linkish{color:#fbbf24;background:none;border:0;padding:0;font:inherit;cursor:pointer;text-decoration:underline}
#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);background:#1e293b;border:1px solid #334155;color:#f1f5f9;padding:10px 16px;border-radius:6px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:9999}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#toast.err{border-color:#7f1d1d;color:#fecaca}</style></head><body>
<h1>SSR error buffer (${entries.length})</h1>
<div class="bar">
  <a href="?clear=1">clear</a> ·
  <button type="button" class="linkish" onclick="copySsrJson()">copy JSON</button> ·
  <a href="?format=json">view JSON</a> ·
  <a href="?format=json&download=1">download JSON</a> ·
  <a href="?off=1">disable debug</a> ·
  <a href="/">home</a>
</div>${rows}
<div id="toast" role="status" aria-live="polite"></div>
<script>
(function(){
  function showToast(msg, isErr){
    var t=document.getElementById('toast');
    t.textContent=msg;t.className=isErr?'show err':'show';
    clearTimeout(window.__ssrToastTimer);
    window.__ssrToastTimer=setTimeout(function(){t.className=isErr?'err':''},2200);
  }
  async function fallbackCopy(text){
    var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');
    ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);
    ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(_){}
    document.body.removeChild(ta);return ok;
  }
  window.copySsrJson=async function(){
    try{
      var res=await fetch('/__ssr-debug?format=json',{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      var text=await res.text();
      var count=0;try{count=JSON.parse(text).length}catch(_){}
      if(navigator.clipboard&&window.isSecureContext){
        await navigator.clipboard.writeText(text);
      }else{
        var ok=await fallbackCopy(text);
        if(!ok)throw new Error('clipboard unavailable');
      }
      showToast('คัดลอกแล้ว · '+count+' รายการ · '+text.length.toLocaleString()+' ตัวอักษร',false);
    }catch(e){showToast('คัดลอกไม่สำเร็จ: '+(e&&e.message||e),true)}
  };
})();
</script>
</body></html>`;
}

function handleDebugRoute(request: Request): Response {
  const url = new URL(request.url);
  // Self-service enable is gated behind a server-only secret. Without
  // SSR_DEBUG_SECRET configured, the ?on=1 toggle is disabled in production.
  const debugSecret = process.env.SSR_DEBUG_SECRET;
  const providedSecret =
    url.searchParams.get("secret") ?? request.headers.get("x-ssr-debug-secret");
  const secretOk = !!debugSecret && providedSecret === debugSecret;
  if (url.searchParams.get("on") === "1") {
    if (!secretOk) {
      return new Response("Not found", { status: 404 });
    }
    const h = new Headers({ location: "/__ssr-debug" });
    h.append("set-cookie", "ssr_debug=1; Path=/; Max-Age=86400; SameSite=Lax");
    return new Response(null, { status: 302, headers: h });
  }
  if (url.searchParams.get("off") === "1") {
    const h = new Headers({ location: "/" });
    h.append("set-cookie", "ssr_debug=; Path=/; Max-Age=0; SameSite=Lax");
    return new Response(null, { status: 302, headers: h });
  }
  // All read endpoints (buffer view, JSON, clear) require either the cookie
  // (already proven via secret) OR the secret on this request, OR explicit
  // SSR_DEBUG=1 env. In production without the secret env, this returns 404.
  if (!isDebugEnabled(request) && !secretOk) {
    return new Response("Not found", { status: 404 });
  }
  if (url.searchParams.get("clear") === "1") {
    clearSsrErrorBuffer();
    return new Response(null, { status: 302, headers: { location: "/__ssr-debug" } });
  }
  if (url.searchParams.get("format") === "json") {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (url.searchParams.get("download") === "1") {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      headers["content-disposition"] = `attachment; filename="ssr-errors-${stamp}.json"`;
    }
    return new Response(JSON.stringify(getSsrErrorBuffer(), null, 2), { headers });
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
