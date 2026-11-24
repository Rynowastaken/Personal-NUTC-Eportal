import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const EPORTAL_SESSION_COOKIES_FILE = path.join(
  ROOT,
  "data",
  "eportal-session-cookies.json",
);

const PORTAL_SESSION_DOMAIN_PATTERN = /(^|\.)(?:nutc\.edu\.tw|oaklouds\.com)$/i;
const EPHEMERAL_LOGIN_COOKIE_NAMES = new Set([
  "oaksloginWebCsrfSid",
  "loginbulletinWebCsrfSid",
]);
const ALLOWED_SAME_SITE = new Set(["Strict", "Lax", "None"]);

function sessionCookieKey(cookie) {
  const pathValue =
    typeof cookie.path === "string" && cookie.path ? cookie.path : "/";
  return `${cookie.domain}|${pathValue}|${cookie.name}`;
}

/**
 * Filter Playwright cookies down to non-persistent ePortal/AIS/OAKlouds
 * session cookies (e.g. OAKS_SESS1, ASP.NET_SessionId) that Chromium drops
 * whenever a persistent browser context closes.
 */
export function extractPersistableSessionCookies(cookies) {
  if (!Array.isArray(cookies)) return [];
  const byKey = new Map();

  for (const cookie of cookies) {
    const name = typeof cookie?.name === "string" ? cookie.name : "";
    const value = typeof cookie?.value === "string" ? cookie.value : "";
    const domain = typeof cookie?.domain === "string" ? cookie.domain : "";
    if (!name || !value || !PORTAL_SESSION_DOMAIN_PATTERN.test(domain)) {
      continue;
    }
    if (EPHEMERAL_LOGIN_COOKIE_NAMES.has(name)) {
      continue;
    }
    // Persistent cookies (expires > 0) are already stored by Chromium's profile.
    if (Number.isFinite(cookie?.expires) && cookie.expires > 0) {
      continue;
    }

    const pathValue =
      typeof cookie?.path === "string" && cookie.path ? cookie.path : "/";
    const sameSite = ALLOWED_SAME_SITE.has(cookie?.sameSite)
      ? cookie.sameSite
      : "Lax";

    const normalized = {
      name,
      value,
      domain,
      path: pathValue,
      expires: -1,
      httpOnly: Boolean(cookie?.httpOnly),
      secure: Boolean(cookie?.secure),
      sameSite,
    };
    byKey.set(sessionCookieKey(normalized), normalized);
  }

  return [...byKey.values()];
}

/**
 * Persist current NUTC/OAKlouds session cookies from a Playwright context to
 * an owner-only JSON file so the next headless launch restores the session.
 */
export async function savePortalSessionCookies(
  context,
  { filePath = EPORTAL_SESSION_COOKIES_FILE } = {},
) {
  if (typeof context?.cookies !== "function") return 0;

  const cookies = extractPersistableSessionCookies(await context.cookies());
  if (!cookies.length) return 0;

  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify({
    savedAt: new Date().toISOString(),
    cookies,
  });

  await fs.writeFile(tempPath, payload, { mode: 0o600 });
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }

  return cookies.length;
}

/**
 * Re-inject previously saved session cookies into a newly opened Playwright
 * context without overwriting any fresher cookies already loaded from disk.
 */
export async function restorePortalSessionCookies(
  context,
  { filePath = EPORTAL_SESSION_COOKIES_FILE } = {},
) {
  if (typeof context?.addCookies !== "function") return 0;

  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 0;
  }

  const savedCookies = extractPersistableSessionCookies(parsed?.cookies);
  if (!savedCookies.length) return 0;

  const existingKeys = new Set();
  if (typeof context.cookies === "function") {
    const existing = await context.cookies();
    if (Array.isArray(existing)) {
      for (const cookie of existing) {
        if (cookie?.name && cookie?.domain) {
          existingKeys.add(sessionCookieKey(cookie));
        }
      }
    }
  }

  const toRestore = savedCookies.filter(
    (cookie) => !existingKeys.has(sessionCookieKey(cookie)),
  );
  if (!toRestore.length) return 0;

  await context.addCookies(toRestore);
  return toRestore.length;
}

/**
 * Remove any persisted session cookies (on explicit logout or forced re-login).
 */
export async function clearSavedPortalSessionCookies({
  filePath = EPORTAL_SESSION_COOKIES_FILE,
} = {}) {
  await fs.rm(filePath, { force: true });
}
