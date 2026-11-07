// Server-side TronClass session for the portal's rebuilt TronClass pages.
//
// The server asks ePortal for a fresh TronClass SSO handoff (the same one the
// /go/tronclass launch hands to the browser), follows it itself, and keeps the
// resulting TronClass cookies. The rebuilt pages under /tronclass then call
// TronClass's JSON API through this relay, including the exam-taking calls
// that save and submit answers.
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { createModuleHandoff } from "./portal-session.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SESSION_FILE = path.join(ROOT, "data", "tronclass-session.json");

export const TRONCLASS_ORIGIN = "https://tc.nutc.edu.tw";
const MEDIA_HOST = "tcmedia.nutc.edu.tw";
const MAX_REQUEST_BODY = 256 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

function tronclassError(message, code, status = 502) {
  return Object.assign(new Error(message), { code, statusCode: status });
}

// The handoff and TronClass's own sign-in redirects stay on the school's
// HTTPS hosts; anything else is refused rather than followed.
function allowedHost(url) {
  return (
    url.protocol === "https:" &&
    (url.hostname === "nutc.edu.tw" || url.hostname.endsWith(".nutc.edu.tw"))
  );
}

// ---------------------------------------------------------------------------
// Cookie jar

let jar = [];
let loaded = false;

function parseSetCookie(line, url) {
  const [pair, ...attributes] = String(line).split(";").map((part) => part.trim());
  const index = pair.indexOf("=");
  if (index <= 0) return null;
  const cookie = {
    name: pair.slice(0, index),
    value: pair.slice(index + 1),
    domain: url.hostname,
    hostOnly: true,
    path: "/",
    expires: null,
  };
  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split("=");
    const key = rawKey.toLowerCase();
    const value = rest.join("=");
    if (key === "domain" && value) {
      const domain = value.replace(/^\./, "").toLowerCase();
      if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) {
        cookie.domain = domain;
        cookie.hostOnly = false;
      }
    } else if (key === "path" && value.startsWith("/")) {
      cookie.path = value;
    } else if (key === "max-age") {
      cookie.expires = Date.now() + Number(value) * 1000;
    } else if (key === "expires" && cookie.expires === null) {
      const at = Date.parse(value);
      if (!Number.isNaN(at)) cookie.expires = at;
    }
  }
  return cookie;
}

function storeCookies(response, url) {
  const lines =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  let changed = false;
  for (const line of lines) {
    const cookie = parseSetCookie(line, url);
    if (!cookie) continue;
    jar = jar.filter(
      (c) => !(c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path),
    );
    if (cookie.expires === null || cookie.expires > Date.now()) jar.push(cookie);
    changed = true;
  }
  return changed;
}

function cookieHeader(url) {
  const now = Date.now();
  return jar
    .filter((c) => c.expires === null || c.expires > now)
    .filter((c) =>
      c.hostOnly
        ? url.hostname === c.domain
        : url.hostname === c.domain || url.hostname.endsWith(`.${c.domain}`),
    )
    .filter((c) => url.pathname.startsWith(c.path))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function loadJar() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(await fs.readFile(SESSION_FILE, "utf8"));
    if (Array.isArray(saved.cookies)) jar = saved.cookies;
  } catch {
    jar = [];
  }
}

async function saveJar() {
  await fs.mkdir(path.dirname(SESSION_FILE), { recursive: true });
  const temp = `${SESSION_FILE}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ savedAt: new Date().toISOString(), cookies: jar }), {
    mode: 0o600,
  });
  await fs.rename(temp, SESSION_FILE);
}

export async function clearTronclassSession() {
  jar = [];
  loaded = true;
  user = null;
  await fs.rm(SESSION_FILE, { force: true });
}

// ---------------------------------------------------------------------------
// Upstream requests

async function upstream(url, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    redirect: "manual",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "zh-TW,zh;q=0.9",
      ...headers,
      ...(cookieHeader(url) ? { Cookie: cookieHeader(url) } : {}),
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (storeCookies(response, url)) await saveJar().catch(() => {});
  return response;
}

// Follow the ePortal handoff into TronClass, collecting its cookies.
async function followHandoff(handoff) {
  if (!handoff || !["get", "post"].includes(handoff.type)) {
    throw tronclassError("ePortal returned an unsupported TronClass handoff.", "TRONCLASS_HANDOFF_UNAVAILABLE");
  }
  let current = new URL(handoff.url);
  let method = handoff.type === "post" ? "POST" : "GET";
  let body =
    method === "POST" ? new URLSearchParams(handoff.fields || []).toString() : undefined;

  for (let step = 0; step < 15; step += 1) {
    if (!allowedHost(current)) {
      throw tronclassError(
        `TronClass sign-in tried to leave the school's sites (${current.hostname}).`,
        "TRONCLASS_HANDOFF_UNAVAILABLE",
      );
    }
    const response = await upstream(current, {
      method,
      body,
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
    });
    const location = response.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
      await response.body?.cancel();
      return;
    }
    await response.body?.cancel();
    if (response.status !== 307 && response.status !== 308) {
      method = "GET";
      body = undefined;
    }
    current = new URL(location, current);
  }
  throw tronclassError("TronClass sign-in redirected too many times.", "TRONCLASS_HANDOFF_UNAVAILABLE");
}

// The signed-in user is only published inside TronClass's HTML.
let user = null;

async function readUser() {
  const response = await upstream(new URL("/user/index", TRONCLASS_ORIGIN), {
    headers: { Accept: "text/html" },
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    return null;
  }
  const html = await response.text();
  const start = html.indexOf("globalData");
  if (start === -1) return null;
  const block = html.slice(start, start + 1500);
  const id = block.match(/\bid:\s*(\d+)/);
  const name = block.match(/\bname:\s*["']([^"']*)["']/);
  return id ? { id: Number(id[1]), name: name ? name[1] : "" } : null;
}

let signingIn = null;

// Sign in to TronClass through ePortal. Concurrent callers share one attempt.
function signIn() {
  if (signingIn) return signingIn;
  signingIn = (async () => {
    jar = [];
    user = null;
    const handoff = await createModuleHandoff("tronclass");
    await followHandoff(handoff);
    user = await readUser();
    if (!user) {
      throw tronclassError(
        "TronClass did not accept the ePortal sign-in.",
        "TRONCLASS_LOGIN_FAILED",
      );
    }
    await saveJar();
    return user;
  })().finally(() => {
    signingIn = null;
  });
  return signingIn;
}

export async function tronclassUser({ refresh = false } = {}) {
  await loadJar();
  if (!refresh && user) return user;
  if (!refresh && jar.length) {
    user = await readUser();
    if (user) return user;
  }
  return signIn();
}

function signedOut(response) {
  if (response.status === 401) return true;
  const location = response.headers.get("location") || "";
  return [301, 302, 303].includes(response.status) && /login|cas|sso/i.test(location);
}

// One upstream call that signs in again once if TronClass has dropped the
// session.
async function withSession(url, options) {
  await loadJar();
  if (!jar.length) await signIn();
  let response = await upstream(url, options);
  if (signedOut(response)) {
    await response.body?.cancel();
    await signIn();
    response = await upstream(url, options);
  }
  return response;
}

// Read one TronClass JSON API endpoint with the server-held session. Used by
// server-side features (such as the AI tutor's practice-mode check).
export async function fetchTronclassJson(pathname) {
  const response = await withSession(new URL(pathname, TRONCLASS_ORIGIN), {
    headers: {
      Accept: "application/json",
      Referer: `${TRONCLASS_ORIGIN}/user/index`,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw tronclassError(
      `TronClass request failed (HTTP ${response.status}).`,
      "TRONCLASS_REQUEST_FAILED",
    );
  }
  return response.json();
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BODY) throw tronclassError("Request body too large.", "TRONCLASS_BODY_TOO_LARGE", 413);
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

// GET and POST were already relayed; taking an exam adds PUT for saving the
// answers of a temporary submission.
export function isTronclassRelayMethod(req) {
  return ["GET", "POST", "PUT"].includes(req.method);
}

// PUT carries its answer payload exactly like POST, so it reads the body
// through the same size limit and content-type pass-through.
export function tronclassRelayReadsBody(method) {
  return ["POST", "PUT"].includes(method);
}

function pipe(response, res, headers) {
  res.writeHead(response.status, headers);
  if (!response.body) return res.end();
  Readable.fromWeb(response.body).pipe(res);
}

// ---------------------------------------------------------------------------
// Routes: /tronclass/api/*, /tronclass/me, /tronclass/preview/:reference

const FORWARD_RESPONSE_HEADERS = ["content-type", "content-length", "content-disposition", "last-modified"];

export async function handleTronclassRequest(req, res, url, { sendJson, sendError }) {
  try {
    if (url.pathname === "/tronclass/me" && req.method === "GET") {
      const me = await tronclassUser({ refresh: url.searchParams.has("refresh") });
      sendJson(res, 200, { user: me });
      return true;
    }

    const preview = url.pathname.match(/^\/tronclass\/preview\/(\d+)$/);
    if (preview && (req.method === "GET" || req.method === "HEAD")) {
      await relayPreview(preview[1], res, sendError, { headOnly: req.method === "HEAD" });
      return true;
    }

    if (url.pathname.startsWith("/tronclass/api/")) {
      if (!isTronclassRelayMethod(req)) {
        sendError(res, 405, "Only GET, POST and PUT are relayed to TronClass.");
        return true;
      }
      await relayApi(req, res, url);
      return true;
    }
  } catch (error) {
    console.error("[tronclass]", error?.code || "UNCLASSIFIED", error?.message || error);
    if (res.headersSent) {
      res.end();
      return true;
    }
    const login = error?.code === "EPORTAL_LOGIN_REQUIRED";
    const busy = error?.code === "EPORTAL_PROFILE_BUSY";
    sendError(
      res,
      login ? 401 : busy ? 409 : error?.statusCode || 502,
      login
        ? "需要先登入 Server ePortal。"
        : busy
          ? "Portal 正在使用 ePortal（可能是登入頁開著），請稍後再試。"
          : error?.message || "TronClass relay failed.",
      error?.code || "TRONCLASS_UNAVAILABLE",
    );
    return true;
  }
  return false;
}

async function relayApi(req, res, url) {
  const target = new URL(url.pathname.slice("/tronclass".length) + url.search, TRONCLASS_ORIGIN);
  const body = tronclassRelayReadsBody(req.method) ? await readBody(req) : undefined;
  const response = await withSession(target, {
    method: req.method,
    body,
    headers: {
      Accept: req.headers.accept || "application/json",
      ...(body ? { "Content-Type": req.headers["content-type"] || "application/json" } : {}),
      Referer: `${TRONCLASS_ORIGIN}/user/index`,
    },
  });

  // File downloads redirect to signed media URLs; let the browser fetch those
  // directly rather than streaming them through the server.
  const location = response.headers.get("location");
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    await response.body?.cancel();
    const next = new URL(location, target);
    if (!allowedHost(next)) throw tronclassError("TronClass redirected off the school's sites.", "TRONCLASS_UNAVAILABLE");
    res.writeHead(302, { Location: next.href, "Cache-Control": "no-store" });
    res.end();
    return;
  }

  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  pipe(response, res, headers);
}

// A material's preview is a PDF on TronClass's media host. Stream it inline so
// the page can show it in a frame with the browser's own PDF viewer.
async function relayPreview(reference, res, sendError, { headOnly = false } = {}) {
  const info = await withSession(
    new URL(`/api/uploads/reference/document/${reference}/url?preview=true`, TRONCLASS_ORIGIN),
    { headers: { Accept: "application/json" } },
  );
  const data = info.ok ? await info.json().catch(() => null) : null;
  if (!data?.url) {
    await info.body?.cancel();
    sendError(res, 404, "這個檔案沒有預覽。", "TRONCLASS_NO_PREVIEW");
    return;
  }
  const media = new URL(data.url, TRONCLASS_ORIGIN);
  if (!allowedHost(media) || (media.hostname !== MEDIA_HOST && media.origin !== TRONCLASS_ORIGIN)) {
    sendError(res, 502, "預覽檔案的位置不正確。", "TRONCLASS_NO_PREVIEW");
    return;
  }
  if (headOnly) {
    res.writeHead(200, { "Content-Type": "application/pdf", "Cache-Control": "no-store" });
    res.end();
    return;
  }
  const file = await upstream(media, { headers: { Accept: "application/pdf,*/*" } });
  if (!file.ok) {
    await file.body?.cancel();
    sendError(res, 502, "預覽檔案載入失敗。", "TRONCLASS_NO_PREVIEW");
    return;
  }
  pipe(file, res, {
    "Content-Type": file.headers.get("content-type") || "application/pdf",
    ...(file.headers.get("content-length") ? { "Content-Length": file.headers.get("content-length") } : {}),
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "frame-ancestors 'self'",
  });
}
