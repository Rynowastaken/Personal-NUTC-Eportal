import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createModuleHandoff } from "./portal-session.js";
import {
  buildOpacAvailabilityUrl,
  cleanBookDescription,
  decodeHtmlEntities,
  htmlToCleanParagraphs,
  mergeOpacItemLookup,
  normalizeIsbn,
  parseCarrelCalendar,
  parseCarrelForm,
  parseCarrelReservations,
  parseDatabasesList,
  parseEndnoteDownloads,
  parseLibraryPortalLinks,
  parseOpacAccount,
  parseOpacItemDetail,
  parseOpacLookupTitleInfoUrl,
  parseOpacMyLists,
  parseOpacSearchResults,
  parseSanminProductDetail,
  sanminCoverUrlFromIsbn,
  stripBookstorePromo,
  stripHtml,
} from "./library-parsers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const LIBRARY_ORIGIN = "https://library.nutc.edu.tw";
export const OPAC_ORIGIN = "https://ntit.ent.sirsidynix.net";
export const OPAC_BASE = `${OPAC_ORIGIN}/client/zh_TW/NUTC`;
const SESSION_FILE = path.join(ROOT, "data", "library-session.json");
const CATALOG_CACHE_FILE = path.join(ROOT, "data", "library-catalog-cache.json");
const COVER_CACHE_DIR = path.join(ROOT, "data", "library-covers");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const OVERVIEW_TTL_MS = 5 * 60_000;
const CATALOG_FRESH_TTL_MS = 10 * 60_000;
const CATALOG_STALE_TTL_MS = 6 * 60 * 60_000;
const FACET_TTL_MS = 30 * 60_000;
const AVAILABILITY_TTL_MS = 2 * 60_000;
const DATABASES_TTL_MS = 5 * 60_000;
const CALENDAR_TTL_MS = 2 * 60_000;
const COVER_HIT_TTL_MS = 24 * 60 * 60_000;
const COVER_MISS_TTL_MS = 6 * 60 * 60_000;
const COVER_TRANSIENT_MISS_TTL_MS = 30_000;
const COVER_DISK_TTL_MS = 7 * 24 * 60 * 60_000;
const MAX_COVER_DISK_FILES = 500;
const MAX_COVER_CACHE_ENTRIES = 400;
const MAX_COVER_CACHE_BYTES = 32 * 1024 * 1024;
const MIN_COVER_BYTES = 400;
const MAX_COVER_BYTES = 2 * 1024 * 1024;
const COVER_DISK_ENABLED =
  !process.env.NODE_TEST_CONTEXT && !process.execArgv.includes("--test");

export const ALLOWED_LIBRARY_HOSTS = new Set([
  "library.nutc.edu.tw",
  "lib1.nutc.edu.tw",
  "ntit.ent.sirsidynix.net",
  "brs.nutc.edu.tw",
]);

export const COVER_ALLOWED_HOSTS = new Set([
  "cdnec.sanmin.com.tw",
  "ntit.ent.sirsidynix.net",
  "books.google.com",
  "covers.openlibrary.org",
  "cover.openbd.jp",
  "static.findbook.com.tw",
]);

const GOOGLE_PLACEHOLDER_HASHES = new Set([
  "e3f8c414b288cbdf4e6d1e00eb6d3826157d10a5b5628b9318f726ea490eca12",
  "a9af512c1e52ed9cafd06b8f212bf13940976703ee3a38573df558e28ce31a21",
]);

const SCOPE_TO_QF = {
  ALL: "",
  SM: "LIBRARY\t圖書館\t1:NTIT\t臺中科技大學 - 三民總館",
  MS: "LIBRARY\t圖書館\t1:MSNUTC\t臺中科技大學 - 民生分館",
  BOOK: "ITYPE\t資料類型\t1:BOOK\t圖書",
  EBOOK: "ITYPE\t資料類型\t1:ELECRES\t電子資源",
  AV: "ITYPE\t資料類型\t1:AV\t視聽",
  LANG: "LOCATION\t永久館藏位置\t1:A-LC\t語言中心",
};

const VALID_SORTS = new Set(["RE", "PD", "PA", "TL", "AT"]);
const VALID_CATALOG_PAGE_SIZES = new Set([12, 24, 36, 48]);
const DEFAULT_CATALOG_PAGE_SIZE = 24;
const AVAILABILITY_BATCH_SIZE = 24;
const MAX_AVAILABILITY_IDS = 48;

const VALID_TAG_QF =
  /^(SUBJECT|LANGUAGE|PUBDATE|ITYPE|LIBRARY|LOCATION|LOCAL_NOTE_590)\t[^\r\n\t]{1,40}\t[^\r\n\t]{1,180}\t[^\r\n\t]{1,180}$/;

const FIELD_TO_RT = {
  ALL: "",
  TITLE: "false|||TITLE|||題名",
  AUTHOR: "false|||AUTHOR|||著者",
  JOURNAL: "false|||SERIAL_TITLE|||期刊名",
  SUBJECT: "false|||SUBJECT|||主題",
  ISBN: "false|||ISBN|||ISBN（國際標準書號）",
  ISSN: "false|||ISSN|||ISSN (國際標準刊號)",
  BARCODE: "false|||BARCODE|||館藏條碼",
};

const PRESET_TO_LIMIT = {
  "": "",
  SMNEW: "SMNEW",
  MSNEW: "MSNEW",
};

const VALID_DETAIL_PATH =
  /^\/client\/zh_TW\/NUTC\/search\/detailnonmodal\/ent:\$002f\$002fSD_ILS\$002f0\$002fSD_ILS:\d+\/one$/;

export const STATIC_OPEN_TARGETS = {
  ejournals:
    "https://gl6na8mj5h.search.serialssolutions.com/ejp/?libHash=GL6NA8MJ5H#/?language=zh-TW&titleType=ALL",
  summon: "https://nutc.summon.serialssolutions.com/",
  carrel: `${LIBRARY_ORIGIN}/library/OrderRoom/OrderRoom2.aspx`,
  "carrel-cancel": `${LIBRARY_ORIGIN}/library/OrderRoom/CancelRoom2.aspx`,
  databases: `${LIBRARY_ORIGIN}/database/search/indexDB.asp`,
};

export const SSO_OPEN_KEY_MAP = {
  opac: "opac",
  carrel: "carrel",
  "carrel-cancel": "carrelCancel",
  "group-discuss": "groupDiscuss",
  "group-screening": "groupScreening",
  orientation: "orientation",
  recommend: "recommend",
  "patron-rights": "patronRights",
  "reset-pin": "resetPin",
};

function libraryError(message, code, statusCode = 502) {
  return Object.assign(new Error(message), { code, statusCode });
}

function isAllowedLibraryUrl(url, { allowHttpLib1 = false } = {}) {
  if (!(url instanceof URL)) return false;
  if (url.protocol === "https:") {
    return ALLOWED_LIBRARY_HOSTS.has(url.hostname);
  }
  if (allowHttpLib1 && url.protocol === "http:") {
    return url.hostname === "lib1.nutc.edu.tw";
  }
  return false;
}

/**
 * Validate external cover thumbnail URLs against vetted HTTPS cover hosts.
 */
export function isAllowedCoverUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    return parsed.protocol === "https:" && COVER_ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedCoverRedirectHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    COVER_ALLOWED_HOSTS.has(host) ||
    host === "archive.org" ||
    host.endsWith(".archive.org") ||
    host.endsWith(".googleusercontent.com")
  );
}

function toCoverProxyUrl(rawUrl, rawIsbn = "") {
  const safeUrl = isAllowedCoverUrl(rawUrl) ? String(rawUrl).trim() : "";
  const isbn = normalizeIsbn(rawIsbn);
  if (!safeUrl && !isbn) return "";
  const qs = new URLSearchParams();
  if (safeUrl) qs.set("url", safeUrl);
  if (isbn) qs.set("isbn", isbn);
  return `/api/library/cover?${qs.toString()}`;
}

// ---------------------------------------------------------------------------
// Bounded TTL caches + Cookie jar & catalog disk persistence

let jar = [];
let jarLoaded = false;
let sessionLinks = {};
let sessionInFlight = null;

let overviewCache = null;
let overviewInFlight = null;
let downloadsCache = null;
const catalogCache = new Map();
const catalogInFlight = new Map();
const facetCache = new Map();
const availabilityCache = new Map();
const availabilityInFlight = new Map();
const googleCoverUrlCache = new Map();
const googleCoverInFlight = new Map();
const coverImageCache = new Map();
let coverImageCacheBytes = 0;
const coverInFlight = new Map();
const coverHostCookies = new Map();
const coverHostWarmed = new Set();
const coverHostStates = new Map();
let coverDiskWriteCount = 0;
const bookEnrichmentCache = new Map();
const bookEnrichmentInFlight = new Map();
let catalogDiskLoaded = false;
let catalogDiskLoadPromise = null;
let catalogPersistTimer = null;
const itemDetailCache = new Map();
const myListsCache = new Map();
const databasesCache = new Map();
const calendarCache = new Map();

function getCachedMap(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedMap(map, key, value, ttlMs, maxEntries) {
  if (map.has(key)) map.delete(key);
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }
}

function setCatalogCacheEntry(key, value, freshUntil, staleUntil) {
  if (catalogCache.has(key)) catalogCache.delete(key);
  catalogCache.set(key, { value, freshUntil, staleUntil });
  while (catalogCache.size > 80) {
    const oldestKey = catalogCache.keys().next().value;
    catalogCache.delete(oldestKey);
  }
}

const CATALOG_CACHE_SCHEMA_VERSION = 2;

async function loadCatalogCacheFromDisk() {
  if (catalogDiskLoaded) return;
  if (catalogDiskLoadPromise) return catalogDiskLoadPromise;
  catalogDiskLoadPromise = (async () => {
    try {
      const parsed = JSON.parse(await fs.readFile(CATALOG_CACHE_FILE, "utf8"));
      if (parsed?.version !== CATALOG_CACHE_SCHEMA_VERSION) {
        return;
      }
      const now = Date.now();
      const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
      for (const entry of entries) {
        if (
          !entry?.key ||
          !entry?.value ||
          !Number.isFinite(entry.staleUntil) ||
          entry.staleUntil <= now
        ) {
          continue;
        }
        const freshUntil = Number.isFinite(entry.freshUntil)
          ? entry.freshUntil
          : now + CATALOG_FRESH_TTL_MS;
        setCatalogCacheEntry(entry.key, entry.value, freshUntil, entry.staleUntil);
        if (Array.isArray(entry.value.facets) && entry.value.facets.length > 0) {
          const filterKey = String(entry.key).replace(/\|p\d+$/, "");
          setCachedMap(facetCache, filterKey, entry.value.facets, FACET_TTL_MS, 80);
        }
      }
    } catch {
      // Missing or invalid disk cache is non-fatal; cold requests populate it.
    } finally {
      catalogDiskLoaded = true;
      catalogDiskLoadPromise = null;
    }
  })();
  return catalogDiskLoadPromise;
}

function schedulePersistCatalogCache() {
  if (catalogPersistTimer) clearTimeout(catalogPersistTimer);
  catalogPersistTimer = setTimeout(() => {
    catalogPersistTimer = null;
    const now = Date.now();
    const entries = [...catalogCache.entries()]
      .filter(([, entry]) => entry.staleUntil > now)
      .slice(-24)
      .map(([key, entry]) => ({
        key,
        freshUntil: entry.freshUntil,
        staleUntil: entry.staleUntil,
        value: entry.value,
      }));
    void (async () => {
      try {
        await fs.mkdir(path.dirname(CATALOG_CACHE_FILE), { recursive: true, mode: 0o700 });
        const temp = `${CATALOG_CACHE_FILE}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(
          temp,
          JSON.stringify({
            version: CATALOG_CACHE_SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            entries,
          }),
          { mode: 0o600 },
        );
        await fs.rename(temp, CATALOG_CACHE_FILE);
      } catch {
        // Ignore non-critical disk cache persistence errors.
      }
    })();
  }, 1500);
  catalogPersistTimer.unref?.();
}

function parseSetCookie(line, url) {
  const [pair, ...attributes] = String(line || "")
    .split(";")
    .map((p) => p.trim());
  const idx = pair.indexOf("=");
  if (idx <= 0) return null;

  const cookie = {
    name: pair.slice(0, idx),
    value: pair.slice(idx + 1),
    domain: url.hostname.toLowerCase(),
    hostOnly: true,
    path: "/",
    expires: null,
  };

  for (const attr of attributes) {
    const [rawKey, ...rest] = attr.split("=");
    const key = rawKey.toLowerCase();
    const val = rest.join("=");
    if (key === "domain" && val) {
      const d = val.replace(/^\./, "").toLowerCase();
      if (url.hostname === d || url.hostname.endsWith(`.${d}`)) {
        cookie.domain = d;
        cookie.hostOnly = false;
      }
    } else if (key === "path" && val.startsWith("/")) {
      cookie.path = val;
    } else if (key === "max-age") {
      const secs = Number(val);
      if (Number.isFinite(secs)) cookie.expires = Date.now() + secs * 1000;
    } else if (key === "expires" && cookie.expires === null) {
      const parsed = Date.parse(val);
      if (!Number.isNaN(parsed)) cookie.expires = parsed;
    }
  }

  return cookie;
}

function storeResponseCookies(response, url) {
  const lines =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  let changed = false;
  const now = Date.now();
  for (const line of lines) {
    const cookie = parseSetCookie(line, url);
    if (!cookie) continue;
    jar = jar.filter(
      (c) =>
        !(
          c.name === cookie.name &&
          c.domain === cookie.domain &&
          c.path === cookie.path
        ),
    );
    if (cookie.expires === null || cookie.expires > now) {
      jar.push(cookie);
    }
    changed = true;
  }
  return changed;
}

function cookieHeaderForUrl(url) {
  const now = Date.now();
  return jar
    .filter((c) => c.expires === null || c.expires > now)
    .filter((c) =>
      c.hostOnly
        ? url.hostname === c.domain
        : url.hostname === c.domain || url.hostname.endsWith(`.${c.domain}`),
    )
    .filter((c) => url.pathname.startsWith(c.path || "/"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

function hasHostCookies(hostname) {
  const now = Date.now();
  return jar.some(
    (c) =>
      (c.expires === null || c.expires > now) &&
      (urlHostMatches(hostname, c.domain)),
  );
}

function urlHostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

async function loadLibrarySessionFromDisk() {
  if (jarLoaded) return;
  jarLoaded = true;
  try {
    const parsed = JSON.parse(await fs.readFile(SESSION_FILE, "utf8"));
    if (Array.isArray(parsed?.cookies)) jar = parsed.cookies;
    if (parsed?.links && typeof parsed.links === "object") {
      sessionLinks = parsed.links;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      jar = [];
      sessionLinks = {};
    }
  }
}

async function persistLibrarySessionToDisk() {
  await fs.mkdir(path.dirname(SESSION_FILE), { recursive: true, mode: 0o700 });
  const temp = `${SESSION_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(
    temp,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      cookies: jar,
      links: sessionLinks,
    }),
    { mode: 0o600 },
  );
  await fs.rename(temp, SESSION_FILE);
}

function invalidateLibraryDataCaches() {
  overviewCache = null;
  overviewInFlight = null;
  downloadsCache = null;
  myListsCache.clear();
  calendarCache.clear();
}

/**
 * Clear stored Library cookies, SSO links, and all in-memory caches.
 */
export async function clearLibrarySession() {
  jar = [];
  jarLoaded = true;
  sessionLinks = {};
  overviewCache = null;
  overviewInFlight = null;
  downloadsCache = null;
  catalogCache.clear();
  facetCache.clear();
  availabilityCache.clear();
  googleCoverUrlCache.clear();
  coverImageCache.clear();
  coverImageCacheBytes = 0;
  coverHostCookies.clear();
  coverHostWarmed.clear();
  coverHostStates.clear();
  bookEnrichmentCache.clear();
  itemDetailCache.clear();
  myListsCache.clear();
  databasesCache.clear();
  calendarCache.clear();
  await fs.rm(SESSION_FILE, { force: true }).catch(() => {});
}

async function httpRequestWithCookies(
  rawUrl,
  {
    method = "GET",
    headers = {},
    body = undefined,
    maxRedirects = 6,
    allowHttpLib1 = false,
    timeoutMs = 15_000,
    useCookies = true,
  } = {},
) {
  let current = new URL(rawUrl);
  if (!isAllowedLibraryUrl(current, { allowHttpLib1 })) {
    throw libraryError(
      `Disallowed library URL host: ${current.hostname}`,
      "LIBRARY_HOST_DISALLOWED",
      400,
    );
  }

  let currentMethod = method;
  let currentBody = body;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const reqHeaders = {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      ...headers,
    };
    if (useCookies) {
      const cookieHdr = cookieHeaderForUrl(current);
      if (cookieHdr) reqHeaders.Cookie = cookieHdr;
    }

    const res = await fetch(current, {
      method: currentMethod,
      headers: reqHeaders,
      body: currentBody,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (useCookies) storeResponseCookies(res, current);

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) return { response: res, finalUrl: current };
      const next = new URL(location, current);
      if (!isAllowedLibraryUrl(next, { allowHttpLib1 })) {
        return { response: res, finalUrl: current, externalRedirect: next };
      }
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod === "POST")) {
        currentMethod = "GET";
        currentBody = undefined;
      }
      current = next;
      continue;
    }

    return { response: res, finalUrl: current };
  }

  throw libraryError("Too many redirects from library server.", "LIBRARY_REDIRECT_LIMIT", 502);
}

// ---------------------------------------------------------------------------
// Authenticated SSO initialization (Library IIS + SirsiDynix OPAC)

function needsLibraryRelogin(finalUrl, html = "") {
  const pathLower = String(finalUrl?.pathname || "").toLowerCase();
  if (
    pathLower.includes("/sso/errorpage.aspx") ||
    pathLower.includes("/login") ||
    pathLower.includes("sess_exceed")
  ) {
    return true;
  }
  if (/Server Error in|Object reference not set|尚未登入|請先由eportal登入/i.test(html)) {
    return true;
  }
  return false;
}

async function captureOpacCookiesViaPlaywright(opacSsoUrl) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: USER_AGENT,
    });
    const page = await ctx.newPage();
    await page.goto(opacSsoUrl, { waitUntil: "networkidle", timeout: 25_000 }).catch(() => {});
    await page.goto(`${OPAC_BASE}/search/account?`, {
      waitUntil: "networkidle",
      timeout: 25_000,
    }).catch(() => {});
    await page.waitForTimeout(800);

    const cookies = await ctx.cookies(OPAC_ORIGIN);
    const filtered = cookies.filter(
      (c) =>
        c.domain &&
        (c.domain.includes("sirsidynix.net") || c.domain.includes("nutc.edu.tw")),
    );
    const now = Date.now();
    jar = jar.filter((c) => !c.domain.includes("sirsidynix.net"));
    for (const c of filtered) {
      const domain = c.domain.replace(/^\./, "").toLowerCase();
      jar.push({
        name: c.name,
        value: c.value,
        domain,
        hostOnly: !c.domain.startsWith("."),
        path: c.path || "/",
        expires: Number.isFinite(c.expires) && c.expires > 0 ? c.expires * 1000 : null,
      });
    }
    const acctHtml = await page.content().catch(() => "");
    return { ok: /您的狀態|借閱\s*總計|checkoutsTab/i.test(acctHtml), html: acctHtml };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function establishLibrarySession({ needOpac = false } = {}) {
  await loadLibrarySessionFromDisk();
  const handoff = await createModuleHandoff("library");
  if (!handoff || handoff.type !== "get" || !handoff.url) {
    throw libraryError(
      "Unable to establish Library SSO handoff from ePortal.",
      "EPORTAL_HANDOFF_UNAVAILABLE",
      502,
    );
  }

  const { response: landingRes, finalUrl: landingUrl } =
    await httpRequestWithCookies(handoff.url, { maxRedirects: 8, timeoutMs: 20_000 });
  const landingHtml = await landingRes.text();

  if (needsLibraryRelogin(landingUrl, landingHtml)) {
    throw libraryError(
      "Library SSO handoff was rejected. Sign in to Server ePortal again.",
      "EPORTAL_LOGIN_REQUIRED",
      401,
    );
  }

  const parsedLinks = parseLibraryPortalLinks(landingHtml, landingUrl.toString());
  sessionLinks = { ...sessionLinks, ...parsedLinks };

  // Activate OrderRoom session if available
  if (parsedLinks.carrel) {
    try {
      await httpRequestWithCookies(parsedLinks.carrel, {
        maxRedirects: 6,
        timeoutMs: 15_000,
      });
    } catch {
      // OrderRoom activation failure is handled explicitly when reading rooms.
    }
  }

  if (needOpac && parsedLinks.opac) {
    await captureOpacCookiesViaPlaywright(parsedLinks.opac);
  }

  await persistLibrarySessionToDisk().catch(() => {});
}

async function ensureLibrarySession({ needOpac = false, forceRefresh = false } = {}) {
  await loadLibrarySessionFromDisk();
  const hasLib = hasHostCookies("library.nutc.edu.tw");
  const hasOpac = !needOpac || hasHostCookies("ntit.ent.sirsidynix.net");

  if (!forceRefresh && hasLib && hasOpac && Object.keys(sessionLinks).length > 0) {
    return;
  }

  if (!sessionInFlight) {
    sessionInFlight = (async () => {
      await establishLibrarySession({ needOpac: needOpac || forceRefresh });
    })().finally(() => {
      sessionInFlight = null;
    });
  }
  await sessionInFlight;
}

async function fetchAuthenticatedLibraryPage(
  url,
  { method = "GET", headers = {}, body = undefined, needOpac = false } = {},
) {
  await ensureLibrarySession({ needOpac });
  let first = await httpRequestWithCookies(url, {
    method,
    headers,
    body,
    maxRedirects: 8,
    timeoutMs: 18_000,
  });
  let html = await first.response.text();

  if (needsLibraryRelogin(first.finalUrl, html)) {
    // Only auto-retry safely on GET requests; never replay state-mutating POSTs after expiry.
    await ensureLibrarySession({ needOpac, forceRefresh: true });
    if (method !== "GET") {
      throw libraryError(
        "圖書館連線剛已重新建立，請再送出一次操作。",
        "LIBRARY_SESSION_REFRESHED",
        409,
      );
    }
    first = await httpRequestWithCookies(url, {
      method,
      headers,
      body,
      maxRedirects: 8,
      timeoutMs: 18_000,
    });
    html = await first.response.text();
  }

  await persistLibrarySessionToDisk().catch(() => {});
  return { html, response: first.response, finalUrl: first.finalUrl };
}

// ---------------------------------------------------------------------------
// Public fast HTTP catalog & databases endpoints

function normalizeCatalogItemForPublic(item) {
  const coverProxyUrl = toCoverProxyUrl(item.rawCoverUrl, item.isbn);
  const { rawCoverUrl, ...rest } = item;
  return { ...rest, coverProxyUrl };
}

function normalizeGoogleThumbUrl(raw = "") {
  const clean = String(raw || "").trim().replace(/^http:\/\//i, "https://");
  if (!clean) return "";
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "https:" || parsed.hostname !== "books.google.com") {
      return "";
    }
    parsed.searchParams.set("zoom", "1");
    parsed.searchParams.delete("edge");
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Batch-resolve Google Books `viewapi` thumbnail URLs for ISBNs and share in-flight lookups.
 */
function warmGoogleBooksCovers(rawIsbns = []) {
  const normalized = [
    ...new Set(rawIsbns.map((x) => normalizeIsbn(x)).filter(Boolean)),
  ];
  const pending = normalized.filter(
    (isbn) =>
      getCachedMap(googleCoverUrlCache, isbn) === null &&
      !googleCoverInFlight.has(isbn),
  );
  if (!pending.length) return Promise.resolve();

  const batches = [];
  for (let i = 0; i < pending.length; i += 15) {
    const chunk = pending.slice(i, i + 15);
    const idPromises = new Map();
    const batchPromise = (async () => {
      const bibkeys = chunk.map((isbn) => `ISBN:${isbn}`).join(",");
      const url = `https://books.google.com/books?bibkeys=${encodeURIComponent(bibkeys)}&jscmd=viewapi`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          for (const isbn of chunk) {
            setCachedMap(googleCoverUrlCache, isbn, "", 60_000, 1000);
          }
          return {};
        }
        const text = await res.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        const out = {};
        for (const isbn of chunk) {
          const thumbRaw = parsed?.[`ISBN:${isbn}`]?.thumbnail_url || "";
          const normalizedUrl = normalizeGoogleThumbUrl(thumbRaw);
          out[isbn] = normalizedUrl;
          setCachedMap(
            googleCoverUrlCache,
            isbn,
            normalizedUrl,
            COVER_MISS_TTL_MS,
            1000,
          );
        }
        return out;
      } catch {
        for (const isbn of chunk) {
          setCachedMap(googleCoverUrlCache, isbn, "", 60_000, 1000);
        }
        return {};
      }
    })();

    for (const isbn of chunk) {
      const p = batchPromise
        .then((map) => map[isbn] || "")
        .finally(() => {
          if (googleCoverInFlight.get(isbn) === idPromises.get(isbn)) {
            googleCoverInFlight.delete(isbn);
          }
        });
      idPromises.set(isbn, p);
      googleCoverInFlight.set(isbn, p);
    }
    batches.push(batchPromise);
  }
  return Promise.all(batches).then(() => {});
}

async function lookupGoogleBooksCover(isbn) {
  const cached = getCachedMap(googleCoverUrlCache, isbn);
  if (cached !== null) return cached;
  const existing = googleCoverInFlight.get(isbn);
  if (existing) return existing;
  await warmGoogleBooksCovers([isbn]);
  const after = getCachedMap(googleCoverUrlCache, isbn);
  if (after !== null) return after;
  const inflight = googleCoverInFlight.get(isbn);
  return inflight ? inflight : "";
}

function parseAvailabilityIds(rawIds = "") {
  const rawList = Array.isArray(rawIds)
    ? rawIds
    : String(rawIds || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  if (!rawList.length || rawList.length > MAX_AVAILABILITY_IDS) {
    throw libraryError(
      "Invalid catalog availability title ids.",
      "LIBRARY_INVALID_PARAM",
      400,
    );
  }
  const ids = [];
  const seen = new Set();
  for (const raw of rawList) {
    const id = String(raw || "").trim();
    if (!/^\d{1,12}$/.test(id)) {
      throw libraryError(
        "Invalid catalog availability title ids.",
        "LIBRARY_INVALID_PARAM",
        400,
      );
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

async function fetchAvailabilityMap(ids = []) {
  const cleanIds = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || "").trim();
    if (/^\d{1,12}$/.test(id) && !seen.has(id)) {
      seen.add(id);
      cleanIds.push(id);
    }
  }
  if (!cleanIds.length) return {};

  const items = {};
  const waitEntries = [];
  const toFetch = [];

  for (const id of cleanIds) {
    const cached = getCachedMap(availabilityCache, id);
    if (cached) {
      items[id] = cached;
      continue;
    }
    const existing = availabilityInFlight.get(id);
    if (existing) {
      waitEntries.push([id, existing]);
    } else {
      toFetch.push(id);
    }
  }

  if (toFetch.length > 0) {
    for (let offset = 0; offset < toFetch.length; offset += AVAILABILITY_BATCH_SIZE) {
      const batch = toFetch.slice(offset, offset + AVAILABILITY_BATCH_SIZE);
      const availUrl = buildOpacAvailabilityUrl(batch);
      if (!availUrl) continue;
      const idPromises = new Map();
      const batchPromise = (async () => {
        const { response } = await httpRequestWithCookies(availUrl, {
          useCookies: false,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json, text/javascript, */*",
          },
          timeoutMs: 10_000,
        });
        if (!response.ok) return {};
        const json = await response.json();
        const fetched = {};
        if (Array.isArray(json)) {
          for (const entry of json) {
            const id = String(entry?.titleId || "").trim();
            if (!id) continue;
            const normalized = {
              availableCount: Number.parseInt(entry.availableCount, 10) || 0,
              totalCount: Number.parseInt(entry.copyCount, 10) || 0,
              holdsCount: Number.parseInt(entry.holdCount, 10) || 0,
              holdable: Boolean(entry.holdable),
            };
            fetched[id] = normalized;
            setCachedMap(availabilityCache, id, normalized, AVAILABILITY_TTL_MS, 600);
          }
        }
        return fetched;
      })()
        .catch(() => ({}))
        .finally(() => {
          for (const id of batch) {
            if (availabilityInFlight.get(id) === idPromises.get(id)) {
              availabilityInFlight.delete(id);
            }
          }
        });

      for (const id of batch) {
        const p = batchPromise.then((map) => map[id] || null);
        idPromises.set(id, p);
        availabilityInFlight.set(id, p);
        waitEntries.push([id, p]);
      }
    }
  }

  if (waitEntries.length > 0) {
    const settled = await Promise.all(
      waitEntries.map(async ([id, p]) => [id, await p]),
    );
    for (const [id, data] of settled) {
      if (data) items[id] = data;
    }
  }

  return items;
}

/**
 * Resolve copy availability counts for up to 48 OPAC title IDs via cache or parallel `:loadavailability` batches.
 */
export async function getLibraryCatalogAvailability(rawIds = "") {
  const ids = parseAvailabilityIds(rawIds);
  const items = await fetchAvailabilityMap(ids);
  return { items };
}

function prefetchCatalogAvailability(ids = []) {
  if (!ids.length) return Promise.resolve({});
  return fetchAvailabilityMap(ids).catch(() => ({}));
}

function mergeCachedAvailabilityIntoItems(items = []) {
  return items.map((item) => {
    const avail = getCachedMap(availabilityCache, item.id);
    return avail ? { ...item, ...avail } : item;
  });
}

async function fetchOpacResultsStream(
  rawUrl,
  { cachedFacets = null, searchMeta = {}, timeoutMs = 25_000 } = {},
) {
  let current = new URL(rawUrl);
  if (!isAllowedLibraryUrl(current)) {
    throw libraryError(
      `Disallowed library URL host: ${current.hostname}`,
      "LIBRARY_HOST_DISALLOWED",
      400,
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  let abortedEarly = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();

  try {
    let response = null;
    for (let hop = 0; hop <= 6; hop += 1) {
      response = await fetch(current, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) break;
        const next = new URL(location, current);
        if (!isAllowedLibraryUrl(next)) break;
        current = next;
        continue;
      }
      break;
    }

    if (!response) {
      throw libraryError("Empty response from OPAC.", "LIBRARY_OPAC_UNAVAILABLE", 502);
    }
    if (!response.ok) {
      throw libraryError(
        `Catalog search failed with HTTP ${response.status}.`,
        "LIBRARY_OPAC_UNAVAILABLE",
        502,
      );
    }

    let html = "";
    let availPromise = null;
    let resultsParsedEarly = false;

    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (value) html += decoder.decode(value, { stream: true });
        if (done) {
          html += decoder.decode();
          break;
        }
        if (!resultsParsedEarly && /<form\b[^>]*id="facetForm/i.test(html)) {
          resultsParsedEarly = true;
          const earlyParsed = parseOpacSearchResults(html, searchMeta);
          const ids = earlyParsed.items.map((item) => item.id);
          if (ids.length > 0) {
            availPromise = prefetchCatalogAvailability(ids);
          }
          prefetchCatalogCovers(earlyParsed.items);
          if (cachedFacets) {
            abortedEarly = true;
            await reader.cancel().catch(() => {});
            controller.abort();
            break;
          }
        }
      }
    } else {
      html = await response.text();
    }

    return { html, availPromise, finalUrl: current.toString() };
  } catch (error) {
    if (timedOut || (!abortedEarly && (error?.name === "TimeoutError" || error?.name === "AbortError"))) {
      throw libraryError("館藏系統回應逾時，請稍後再試。", "LIBRARY_OPAC_TIMEOUT", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function fetchCatalogPage({
  urlStr,
  searchMeta,
  filterKey,
  cacheKey,
  cachedFacets,
}) {
  const existing = catalogInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const { html, availPromise: earlyAvailPromise, finalUrl } = await fetchOpacResultsStream(
      urlStr,
      { cachedFacets, searchMeta, timeoutMs: 25_000 },
    );

    let parsed = parseOpacSearchResults(html, searchMeta);
    if (parsed.items.length === 0) {
      let singleTitleId = "";
      let singleDetailPath = "";
      try {
        const finalParsedUrl = new URL(finalUrl || urlStr);
        const match = finalParsedUrl.pathname.match(
          /^(\/client\/zh_TW\/NUTC\/search\/detailnonmodal\/.*SD_ILS:(\d+)\/one)$/i,
        );
        if (match) {
          singleDetailPath = match[1];
          singleTitleId = match[2];
        }
      } catch {}
      if (singleTitleId && /displayElementText[^"]*INITIAL_TITLE_SRCH/i.test(html)) {
        const detail = parseOpacItemDetail(html, singleDetailPath);
        if (detail.title) {
          const firstHolding = detail.holdings?.[0] || null;
          parsed = {
            ...parsed,
            totalResults: 1,
            totalPages: 1,
            items: [
              {
                id: singleTitleId,
                title: detail.title,
                author: detail.author,
                publisherYear: detail.publisherYear,
                isbn: detail.isbn,
                callNumber: firstHolding?.callNumber || "",
                campus: firstHolding?.branch || "",
                availableCount: null,
                totalCount: null,
                holdsCount: null,
                holdable: false,
                rawCoverUrl: detail.rawCoverUrl || "",
                detailPath: singleDetailPath,
                officialUrl: `${OPAC_ORIGIN}${singleDetailPath}`,
              },
            ],
          };
        }
      }
    }
    const facets = parsed.facets.length > 0 ? parsed.facets : cachedFacets || [];
    if (parsed.facets.length > 0) {
      setCachedMap(facetCache, filterKey, parsed.facets, FACET_TTL_MS, 80);
    }

    let availPromise = earlyAvailPromise;
    if (!availPromise && parsed.items.length > 0) {
      availPromise = prefetchCatalogAvailability(parsed.items.map((i) => i.id));
    }
    if (!earlyAvailPromise && parsed.items.length > 0) {
      prefetchCatalogCovers(parsed.items);
    }

    const publicItems = mergeCachedAvailabilityIntoItems(
      parsed.items.map(normalizeCatalogItemForPublic),
    );
    const availabilityPending = publicItems.some(
      (item) => item.availableCount == null,
    );

    const result = {
      query: parsed.query,
      field: parsed.field,
      scope: parsed.scope,
      preset: parsed.preset,
      sort: parsed.sort,
      tags: parsed.tags,
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalResults: parsed.totalResults,
      totalPages: parsed.totalPages,
      facets,
      availabilityPending,
      items: publicItems,
    };

    const now = Date.now();
    setCatalogCacheEntry(
      cacheKey,
      result,
      now + CATALOG_FRESH_TTL_MS,
      now + CATALOG_STALE_TTL_MS,
    );
    schedulePersistCatalogCache();

    if (availPromise && availabilityPending) {
      void availPromise
        .then((availMap) => {
          if (!availMap || !Object.keys(availMap).length) return;
          result.items = result.items.map((item) =>
            availMap[item.id] ? { ...item, ...availMap[item.id] } : item,
          );
          result.availabilityPending = result.items.some(
            (item) => item.availableCount == null,
          );
          schedulePersistCatalogCache();
        })
        .catch(() => {});
    }

    return result;
  })().finally(() => {
    catalogInFlight.delete(cacheKey);
  });

  catalogInFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Search or browse NUTC SirsiDynix OPAC directly over HTTPS with scope/facet tags and sorting.
 */
export async function searchLibraryCatalog({
  q = "",
  field = "ALL",
  scope = "ALL",
  preset = "",
  sort = "RE",
  tags = [],
  page = 1,
  pageSize = DEFAULT_CATALOG_PAGE_SIZE,
} = {}) {
  const cleanQ = String(q || "").trim().slice(0, 160);
  const upperField = String(field || "ALL").trim().toUpperCase();
  const upperScope = String(scope || "ALL").trim().toUpperCase();
  const upperPreset = String(preset || "").trim().toUpperCase();
  const upperSort = String(sort || "RE").trim().toUpperCase() || "RE";
  const pageNum = Math.max(1, Math.min(100_000, Number.parseInt(page, 10) || 1));

  let cleanPageSize = DEFAULT_CATALOG_PAGE_SIZE;
  if (pageSize !== undefined && pageSize !== null && String(pageSize).trim() !== "") {
    const rawSize = String(pageSize).trim();
    const parsedSize = /^\d+$/.test(rawSize) ? Number.parseInt(rawSize, 10) : Number.NaN;
    if (!VALID_CATALOG_PAGE_SIZES.has(parsedSize)) {
      throw libraryError("Unsupported catalog page size.", "LIBRARY_INVALID_PARAM", 400);
    }
    cleanPageSize = parsedSize;
  }

  if (!Object.hasOwn(FIELD_TO_RT, upperField)) {
    throw libraryError("Unsupported catalog search field.", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!Object.hasOwn(SCOPE_TO_QF, upperScope)) {
    throw libraryError("Unsupported catalog search scope.", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!Object.hasOwn(PRESET_TO_LIMIT, upperPreset)) {
    throw libraryError("Unsupported catalog preset.", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!VALID_SORTS.has(upperSort)) {
    throw libraryError("Unsupported catalog sort order.", "LIBRARY_INVALID_PARAM", 400);
  }

  const rawTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const cleanTags = [];
  const seenTags = new Set();
  for (const raw of rawTags) {
    const t = String(raw || "").trim();
    if (!t) continue;
    if (!VALID_TAG_QF.test(t)) {
      throw libraryError("Invalid catalog facet tag.", "LIBRARY_INVALID_PARAM", 400);
    }
    if (!seenTags.has(t)) {
      seenTags.add(t);
      cleanTags.push(t);
      if (cleanTags.length >= 6) break;
    }
  }

  await loadCatalogCacheFromDisk();

  const filterKey = `${upperPreset}|${upperScope}|${upperField}|${upperSort}|${cleanTags.join("||")}|${cleanQ}`;
  const cacheKey = `${filterKey}|s${cleanPageSize}|p${pageNum}`;

  const url = new URL(`${OPAC_BASE}/search/results`);
  const qfList = [];
  if (upperPreset) {
    url.searchParams.set("lm", PRESET_TO_LIMIT[upperPreset]);
  } else {
    url.searchParams.set("qu", cleanQ);
    if (cleanQ && FIELD_TO_RT[upperField]) {
      url.searchParams.set("rt", FIELD_TO_RT[upperField]);
    }
    if (SCOPE_TO_QF[upperScope]) {
      qfList.push(SCOPE_TO_QF[upperScope]);
    }
  }
  for (const t of cleanTags) {
    if (!qfList.includes(t)) qfList.push(t);
  }
  for (const qf of qfList) {
    url.searchParams.append("qf", qf);
  }
  if (upperSort !== "RE") {
    url.searchParams.set("st", upperSort);
  }
  if (cleanPageSize !== 12) {
    url.searchParams.set("ps", String(cleanPageSize));
  }
  if (pageNum > 1) {
    url.searchParams.set("rw", String((pageNum - 1) * cleanPageSize));
  }

  const searchMeta = {
    query: cleanQ,
    field: upperField,
    scope: upperScope,
    preset: upperPreset,
    sort: upperSort,
    tags: cleanTags,
    page: pageNum,
    pageSize: cleanPageSize,
  };
  const cachedFacets = getCachedMap(facetCache, filterKey);

  const entry = catalogCache.get(cacheKey);
  const now = Date.now();
  if (entry && now < entry.staleUntil) {
    const items = mergeCachedAvailabilityIntoItems(entry.value.items);
    const availabilityPending = items.some((it) => it.availableCount == null);
    const hydrated = { ...entry.value, items, availabilityPending };
    prefetchCatalogCovers(hydrated.items);
    if (now >= entry.freshUntil && !catalogInFlight.has(cacheKey)) {
      void fetchCatalogPage({
        urlStr: url.toString(),
        searchMeta,
        filterKey,
        cacheKey,
        cachedFacets,
      }).catch(() => {});
    }
    return hydrated;
  }

  return fetchCatalogPage({
    urlStr: url.toString(),
    searchMeta,
    filterKey,
    cacheKey,
    cachedFacets,
  });
}

/**
 * Hydrate catalog disk cache and pre-warm the default browse-all view in background.
 */
export async function warmLibraryCatalog() {
  try {
    await loadCatalogCacheFromDisk();
    const defaultKey = `|ALL|ALL|RE||s${DEFAULT_CATALOG_PAGE_SIZE}|p1`;
    const entry = catalogCache.get(defaultKey);
    if (!entry || Date.now() >= entry.freshUntil) {
      await searchLibraryCatalog({
        q: "",
        field: "ALL",
        scope: "ALL",
        preset: "",
        sort: "RE",
        tags: [],
        page: 1,
        pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      });
    } else {
      prefetchCatalogCovers(entry.value?.items);
    }
  } catch {
    // Warmup is best-effort and must never fail server startup.
  }
}

async function fetchSanminEnrichment(isbn) {
  try {
    const searchRes = await fetch(
      `https://www.sanmin.com.tw/search/index/?ct=ISBN&qu=${encodeURIComponent(isbn)}`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(4_500),
      },
    );
    if (!searchRes.ok) return null;
    const searchHtml = decodeHtmlEntities(await searchRes.text());
    const linkMatch = searchHtml.match(
      /<div\s+class="Title[^"]*"[^>]*>\s*<a\s+href="(\/product\/index\/\d{6,12})"/i,
    );
    if (!linkMatch) return null;

    const prodRes = await fetch(`https://www.sanmin.com.tw${linkMatch[1]}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(4_500),
    });
    if (!prodRes.ok) return null;
    return parseSanminProductDetail(await prodRes.text(), isbn);
  } catch {
    return null;
  }
}

async function fetchEsliteEnrichment(isbn) {
  try {
    const searchRes = await fetch(
      `https://athena.eslite.com/api/v2/search?q=${encodeURIComponent(isbn)}&size=3`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!searchRes.ok) return null;
    const text = await searchRes.text();
    if (!text.startsWith("{")) return null;
    const json = JSON.parse(text);
    const candidates = [
      ...(Array.isArray(json?.hits?.hit) ? json.hits.hit.map((h) => h?.fields) : []),
      ...(Array.isArray(json?.products) ? json.products : []),
    ].filter(Boolean);

    const matched = candidates.find(
      (c) =>
        normalizeIsbn(c.isbn13 || c.isbn || c.ean || c.isbn10 || "") === isbn,
    );
    const esliteSn = String(matched?.eslite_sn || "").trim();
    if (!/^\d{6,20}$/.test(esliteSn)) return null;

    const detailRes = await fetch(
      `https://athena.eslite.com/api/v1/products/${esliteSn}`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!detailRes.ok) return null;
    const detailText = await detailRes.text();
    if (!detailText.startsWith("{")) return null;
    const prod = JSON.parse(detailText);

    const verifiedIsbn = normalizeIsbn(
      prod?.isbn13 || prod?.ean || prod?.isbn || prod?.isbn10 || "",
    );
    if (verifiedIsbn && verifiedIsbn !== isbn) return null;

    const list = Array.isArray(prod?.descriptions) ? prod.descriptions : [];
    const descEntry = list.find(
      (d) =>
        d?.product_description_type_id === 2 ||
        d?.type === 2 ||
        d?.name === "內容簡介",
    );
    const bioEntry = list.find(
      (d) =>
        d?.product_description_type_id === 6 ||
        d?.type === 6 ||
        d?.name === "作者介紹",
    );

    const rawDesc =
      descEntry?.description || prod?.short_description || matched?.description || "";
    const description = rawDesc
      ? cleanBookDescription(stripBookstorePromo(htmlToCleanParagraphs(rawDesc)))
      : "";
    const authorBio = bioEntry?.description
      ? cleanBookDescription(htmlToCleanParagraphs(bioEntry.description, { maxLength: 1400 }))
      : "";

    if (!description && !authorBio) return null;
    return { description, authorBio, pages: "", source: "誠品線上" };
  } catch {
    return null;
  }
}

async function fetchOpenBdEnrichment(isbn) {
  if (!isbn.startsWith("9784")) return null;
  try {
    const res = await fetch(
      `https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(isbn)}`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(3_500),
      },
    );
    if (!res.ok) return null;
    const arr = await res.json();
    const record = Array.isArray(arr) ? arr[0] : null;
    if (!record) return null;

    const textContents = Array.isArray(record?.onix?.CollateralDetail?.TextContent)
      ? record.onix.CollateralDetail.TextContent
      : [];
    const type03 = textContents.find((t) => String(t?.TextType) === "03" && t?.Text);
    const type02 = textContents.find((t) => String(t?.TextType) === "02" && t?.Text);
    const longest = textContents
      .filter((t) => t?.Text)
      .sort((a, b) => String(b.Text).length - String(a.Text).length)[0];
    const picked = type03?.Text || type02?.Text || longest?.Text || "";
    const description = picked ? htmlToCleanParagraphs(picked) : "";

    const contributors = Array.isArray(
      record?.onix?.DescriptiveDetail?.Contributor,
    )
      ? record.onix.DescriptiveDetail.Contributor
      : [];
    const bioRaw = contributors
      .map((c) => c?.BiographicalNote)
      .filter(Boolean)
      .join("\n\n");
    const authorBio = bioRaw
      ? htmlToCleanParagraphs(bioRaw, { maxLength: 1400 })
      : "";

    if (!description && !authorBio) return null;
    return { description, authorBio, pages: "", source: "OpenBD" };
  } catch {
    return null;
  }
}

async function fetchGoogleBooksEnrichment(isbn) {
  try {
    const viewRes = await fetch(
      `https://books.google.com/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&jscmd=viewapi`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!viewRes.ok) return null;
    const viewText = await viewRes.text();
    const jsonMatch = viewText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const viewJson = JSON.parse(jsonMatch[0]);
    const entry = viewJson?.[`ISBN:${isbn}`];
    const infoUrl = entry?.info_url || entry?.preview_url || "";
    const idMatch = infoUrl.match(/[?&]id=([A-Za-z0-9_-]{4,32})/);
    if (!idMatch) return null;

    const bookId = idMatch[1];
    const pageRes = await fetch(
      `https://books.google.com/books?id=${encodeURIComponent(bookId)}&hl=zh-TW`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(4_500),
      },
    );
    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();

    let rawSyn = "";
    const synMatch = pageHtml.match(/<div\b[^>]*id=["']synopsistext["'][^>]*>/i);
    if (synMatch) {
      const start = synMatch.index;
      let cursor = start;
      let depth = 0;
      const tagRegex = /<\/?div\b[^>]*>/gi;
      tagRegex.lastIndex = start;
      let tagMatch;
      while ((tagMatch = tagRegex.exec(pageHtml)) !== null) {
        if (tagMatch[0].startsWith("</")) {
          depth -= 1;
          if (depth === 0) {
            cursor = tagRegex.lastIndex;
            break;
          }
        } else {
          depth += 1;
        }
      }
      if (cursor > start) rawSyn = pageHtml.slice(start, cursor);
    }

    if (!rawSyn) {
      rawSyn =
        pageHtml.match(
          /<meta\b[^>]*name=["']description["'][^>]*content=(["'])([\s\S]*?)\1/i,
        )?.[2] ||
        pageHtml.match(
          /<meta\b[^>]*content=(["'])([\s\S]*?)\1[^>]*name=["']description["']/i,
        )?.[2] ||
        "";
    }

    const description = rawSyn ? cleanBookDescription(htmlToCleanParagraphs(rawSyn)) : "";
    if (!description || /^Preview this book/i.test(description)) return null;
    if (
      /^978(957|986|626|7)/.test(isbn) &&
      !/[\u4e00-\u9fff]/.test(description) &&
      /\b(?:ben shu|zhong guo|jin xing|xue xi|yan jiu|ji shu|xi tong|chan shu)\b/i.test(
        description,
      )
    ) {
      return null;
    }
    return { description, authorBio: "", pages: "", source: "Google Books" };
  } catch {
    return null;
  }
}

async function fetchOpenLibraryEnrichment(isbn) {
  try {
    const editionRes = await fetch(
      `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!editionRes.ok) return null;
    const edition = await editionRes.json();
    let rawDesc =
      typeof edition?.description === "string"
        ? edition.description
        : edition?.description?.value || "";

    if (!rawDesc) {
      const workKey = String(edition?.works?.[0]?.key || "").trim();
      if (/^\/works\/OL\d+W$/i.test(workKey)) {
        const workRes = await fetch(`https://openlibrary.org${workKey}.json`, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(3_500),
        });
        if (workRes.ok) {
          const work = await workRes.json();
          rawDesc =
            typeof work?.description === "string"
              ? work.description
              : work?.description?.value || "";
        }
      }
    }

    const description = rawDesc ? htmlToCleanParagraphs(rawDesc) : "";
    if (!description) return null;
    return { description, authorBio: "", pages: "", source: "Open Library" };
  } catch {
    return null;
  }
}

/**
 * Resolve book descriptions and author bios from vetted public book sources by ISBN.
 */
export async function fetchBookEnrichment(rawIsbn = "") {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;

  const cached = getCachedMap(bookEnrichmentCache, isbn);
  if (cached) return cached.hit ? cached.data : null;

  const existing = bookEnrichmentInFlight.get(isbn);
  if (existing) return existing;

  const promise = (async () => {
    let order;
    if (/^978(957|986|626|7)/.test(isbn)) {
      order = ["sanmin", "eslite", "gbooks", "openlibrary"];
    } else if (/^9784/.test(isbn)) {
      order = ["openbd", "eslite", "gbooks", "sanmin"];
    } else {
      order = ["gbooks", "openlibrary", "eslite", "sanmin"];
    }

    const runners = {
      sanmin: fetchSanminEnrichment,
      eslite: fetchEsliteEnrichment,
      openbd: fetchOpenBdEnrichment,
      gbooks: fetchGoogleBooksEnrichment,
      openlibrary: fetchOpenLibraryEnrichment,
    };

    let bestBio = null;
    for (const provider of order) {
      const hit = await runners[provider](isbn);
      if (!hit) continue;
      if (hit.description) {
        const merged = {
          description: hit.description,
          authorBio: hit.authorBio || bestBio?.authorBio || "",
          pages: hit.pages || bestBio?.pages || "",
          source: hit.source,
        };
        setCachedMap(
          bookEnrichmentCache,
          isbn,
          { hit: true, data: merged },
          COVER_HIT_TTL_MS,
          200,
        );
        return merged;
      }
      if (hit.authorBio && !bestBio) bestBio = hit;
    }

    if (bestBio) {
      setCachedMap(
        bookEnrichmentCache,
        isbn,
        { hit: true, data: bestBio },
        COVER_HIT_TTL_MS,
        200,
      );
      return bestBio;
    }

    setCachedMap(
      bookEnrichmentCache,
      isbn,
      { hit: false, data: null },
      COVER_MISS_TTL_MS,
      200,
    );
    return null;
  })().finally(() => {
    bookEnrichmentInFlight.delete(isbn);
  });

  bookEnrichmentInFlight.set(isbn, promise);
  return promise;
}

function buildOpacLookupTitleInfoUrl(titleId = "") {
  const id = String(titleId || "").trim();
  if (!/^\d{1,12}$/.test(id)) return "";
  const entEncoded = encodeURIComponent(`ent://SD_ILS/0/SD_ILS:${id}~~0`).replace(
    /~/g,
    "%7E",
  );
  return `${OPAC_BASE}/search/detailnonmodal.detail.detailavailabilityaccordions:lookuptitleinfo/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:${id}/ILS/0/true/true?d=${entEncoded}`;
}

async function fetchOpacItemLookup(lookupUrl = "") {
  if (!lookupUrl) return null;
  try {
    const { response } = await httpRequestWithCookies(lookupUrl, {
      method: "POST",
      useCookies: false,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
      timeoutMs: 8_000,
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json && Array.isArray(json.childRecords) ? json : null;
  } catch {
    return null;
  }
}

/**
 * Fetch detailed bibliographic info, live availability, ISBN enrichment, and holdings for one OPAC record.
 */
export async function getLibraryCatalogItem(detailPath) {
  const cleanPath = String(detailPath || "").trim();
  if (!VALID_DETAIL_PATH.test(cleanPath)) {
    throw libraryError("Invalid catalog item path.", "LIBRARY_INVALID_PARAM", 400);
  }

  const cached = getCachedMap(itemDetailCache, cleanPath);
  if (cached) return cached;

  const titleId = cleanPath.match(/SD_ILS:(\d+)\/one$/i)?.[1] || "";
  const targetUrl = `${OPAC_ORIGIN}${cleanPath}`;
  const defaultLookupUrl = buildOpacLookupTitleInfoUrl(titleId);

  const [{ response }, availMap, initialLookup] = await Promise.all([
    httpRequestWithCookies(targetUrl, {
      useCookies: false,
      timeoutMs: 12_000,
    }),
    titleId ? fetchAvailabilityMap([titleId]).catch(() => ({})) : Promise.resolve({}),
    defaultLookupUrl ? fetchOpacItemLookup(defaultLookupUrl) : Promise.resolve(null),
  ]);
  if (!response.ok) {
    throw libraryError(
      `Catalog item lookup failed with HTTP ${response.status}.`,
      "LIBRARY_OPAC_UNAVAILABLE",
      502,
    );
  }

  const html = await response.text();
  const detail = parseOpacItemDetail(html, cleanPath);
  const embeddedLookupUrl = parseOpacLookupTitleInfoUrl(html);

  const [itemLookup, enrichment] = await Promise.all([
    initialLookup?.childRecords?.length
      ? Promise.resolve(initialLookup)
      : embeddedLookupUrl && embeddedLookupUrl !== defaultLookupUrl
        ? fetchOpacItemLookup(embeddedLookupUrl)
        : Promise.resolve(initialLookup),
    detail.isbn ? fetchBookEnrichment(detail.isbn).catch(() => null) : Promise.resolve(null),
  ]);

  const mergedHoldings = mergeOpacItemLookup(detail.holdings || [], itemLookup);
  const availability = (titleId && availMap[titleId]) || null;
  const holdings = mergedHoldings.map((copy) => {
    const rawStatus = String(copy.status || "").trim();
    if (rawStatus && rawStatus !== "未知") return copy;
    let resolvedStatus = "";
    if (availability && availability.totalCount > 0) {
      if (availability.availableCount >= availability.totalCount) {
        resolvedStatus = "在架上";
      } else if (availability.availableCount === 0) {
        resolvedStatus = "已借出";
      }
    }
    return { ...copy, status: resolvedStatus };
  });

  const summary = detail.summary || enrichment?.description || "";
  const summarySource = detail.summary
    ? "館藏目錄"
    : enrichment?.description
      ? enrichment.source
      : "";
  const authorBio = enrichment?.authorBio || "";
  const physicalDesc =
    detail.physicalDesc || (enrichment?.pages ? `${enrichment.pages} 頁` : "");

  const publicDetail = {
    ...detail,
    summary,
    summarySource,
    authorBio,
    physicalDesc,
    availability,
    holdings,
    coverProxyUrl: toCoverProxyUrl(detail.rawCoverUrl, detail.isbn),
  };
  delete publicDetail.rawCoverUrl;

  setCachedMap(itemDetailCache, cleanPath, publicDetail, CATALOG_FRESH_TTL_MS, 60);
  return publicDetail;
}

/**
 * Search/filter NUTC electronic databases (`DatabasesList.asp`) over fast HTTPS.
 */
export async function searchLibraryDatabases({
  q = "",
  language = "",
  college = "",
  subject = "",
  type = "",
} = {}) {
  const cleanQ = String(q || "").trim().slice(0, 120);
  const cleanLang = String(language || "").trim().slice(0, 40);
  const cleanCollege = String(college || "").trim().slice(0, 60);
  const cleanSubject = String(subject || "").trim().slice(0, 60);
  const cleanType = String(type || "").trim().slice(0, 60);

  const form = new URLSearchParams();
  if (cleanQ) form.set("Keyword", cleanQ);
  if (cleanLang) form.set("Language", cleanLang);
  if (cleanCollege) form.set("College", cleanCollege);
  if (cleanSubject) form.set("Subject", cleanSubject);
  if (cleanType) form.set("Type", cleanType);
  if (![...form.keys()].length) {
    form.set("College", "全校");
  }

  const cacheKey = form.toString();
  const cached = getCachedMap(databasesCache, cacheKey);
  if (cached) return cached;

  const { response } = await httpRequestWithCookies(
    `${LIBRARY_ORIGIN}/database/search/DatabasesList.asp`,
    {
      method: "POST",
      useCookies: false,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${LIBRARY_ORIGIN}/database/search/indexDB.asp`,
      },
      body: form.toString(),
      timeoutMs: 15_000,
    },
  );
  if (!response.ok) {
    throw libraryError(
      `Database directory returned HTTP ${response.status}.`,
      "LIBRARY_DB_UNAVAILABLE",
      502,
    );
  }

  const html = await response.text();
  const items = parseDatabasesList(html);
  const result = {
    filter: {
      q: cleanQ,
      language: cleanLang,
      college: cleanCollege || (!cleanQ && !cleanLang && !cleanSubject && !cleanType ? "全校" : ""),
      subject: cleanSubject,
      type: cleanType,
    },
    count: items.length,
    items,
  };

  setCachedMap(databasesCache, cacheKey, result, DATABASES_TTL_MS, 40);
  return result;
}

function getCoverImageCache(key) {
  const entry = coverImageCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    coverImageCacheBytes = Math.max(0, coverImageCacheBytes - (entry.bytes || 0));
    coverImageCache.delete(key);
    return null;
  }
  return entry;
}

function setCoverImageCache(key, entry, ttlMs = COVER_HIT_TTL_MS) {
  const existing = coverImageCache.get(key);
  if (existing) {
    coverImageCacheBytes = Math.max(0, coverImageCacheBytes - (existing.bytes || 0));
    coverImageCache.delete(key);
  }
  const bytes = entry.bytes || 0;
  coverImageCache.set(key, { ...entry, expiresAt: Date.now() + ttlMs });
  coverImageCacheBytes += bytes;
  while (
    coverImageCache.size > MAX_COVER_CACHE_ENTRIES ||
    coverImageCacheBytes > MAX_COVER_CACHE_BYTES
  ) {
    const oldestKey = coverImageCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = coverImageCache.get(oldestKey);
    coverImageCacheBytes = Math.max(0, coverImageCacheBytes - (oldest?.bytes || 0));
    coverImageCache.delete(oldestKey);
  }
}

function getCoverHostLimit(host) {
  if (host === "cdnec.sanmin.com.tw") {
    return coverHostWarmed.has(host) ? 2 : 1;
  }
  return 4;
}

function drainCoverHostQueue(host, st) {
  while (st.queue.length > 0 && st.active < getCoverHostLimit(host)) {
    const next = st.queue.shift();
    st.active += 1;
    next();
  }
  if (st.active === 0 && st.queue.length === 0) {
    coverHostStates.delete(host);
  }
}

async function withCoverHostSlot(hostname, fn) {
  const host = String(hostname || "").toLowerCase();
  let st = coverHostStates.get(host);
  if (!st) {
    st = { active: 0, queue: [] };
    coverHostStates.set(host, st);
  }
  if (st.active < getCoverHostLimit(host)) {
    st.active += 1;
  } else {
    await new Promise((resolve) => st.queue.push(resolve));
  }
  try {
    return await fn();
  } finally {
    st.active = Math.max(0, st.active - 1);
    drainCoverHostQueue(host, st);
  }
}

function readSetCookieHeaders(res) {
  if (!res?.headers) return [];
  if (typeof res.headers.getSetCookie === "function") {
    try {
      return res.headers.getSetCookie();
    } catch {}
  }
  const single = res.headers.get?.("set-cookie");
  return single ? [single] : [];
}

function updateCoverHostCookies(host, res) {
  const lines = readSetCookieHeaders(res);
  if (!lines.length) return;
  let map = coverHostCookies.get(host);
  if (!map) {
    map = new Map();
    coverHostCookies.set(host, map);
  }
  for (const line of lines) {
    const pair = String(line || "").split(";")[0].trim();
    const eq = pair.indexOf("=");
    if (eq > 0) {
      map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  coverHostWarmed.add(host);
}

function coverCookieHeader(host) {
  const map = coverHostCookies.get(host);
  if (!map || !map.size) return "";
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function buildCoverRequestSignal(timeoutMs, externalSignal) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, externalSignal]);
  }
  return timeoutSignal;
}

function coverDiskPath(cacheKey) {
  const hash = crypto.createHash("sha256").update(cacheKey).digest("hex");
  return path.join(COVER_CACHE_DIR, `${hash}.cache`);
}

async function readCoverDiskCache(cacheKey) {
  if (!COVER_DISK_ENABLED) return null;
  const filePath = coverDiskPath(cacheKey);
  try {
    const stat = await fs.stat(filePath);
    if (Date.now() - stat.mtimeMs >= COVER_DISK_TTL_MS) {
      await fs.rm(filePath, { force: true }).catch(() => {});
      return null;
    }
    const raw = await fs.readFile(filePath);
    const nl = raw.indexOf(0x0a);
    if (nl <= 0 || nl > 120) return null;
    const contentType = raw.subarray(0, nl).toString("utf8").trim().toLowerCase();
    const buffer = raw.subarray(nl + 1);
    if (
      !contentType.startsWith("image/") ||
      contentType.includes("svg") ||
      buffer.length < MIN_COVER_BYTES ||
      buffer.length > MAX_COVER_BYTES
    ) {
      return null;
    }
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    return {
      contentType,
      buffer,
      etag: `"${sha256.slice(0, 16)}"`,
    };
  } catch {
    return null;
  }
}

async function pruneCoverDiskCache() {
  try {
    const names = await fs.readdir(COVER_CACHE_DIR);
    const cacheFiles = names.filter((n) => n.endsWith(".cache"));
    if (cacheFiles.length <= MAX_COVER_DISK_FILES) return;
    const entries = await Promise.all(
      cacheFiles.map(async (name) => {
        const full = path.join(COVER_CACHE_DIR, name);
        try {
          const st = await fs.stat(full);
          return { full, mtimeMs: st.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    const valid = entries.filter(Boolean).toSorted((a, b) => a.mtimeMs - b.mtimeMs);
    const excess = valid.length - MAX_COVER_DISK_FILES;
    for (let i = 0; i < excess; i += 1) {
      await fs.rm(valid[i].full, { force: true }).catch(() => {});
    }
  } catch {
    // Non-fatal cleanup errors are ignored.
  }
}

async function writeCoverDiskCache(cacheKey, contentType, buffer) {
  if (!COVER_DISK_ENABLED || !contentType || !buffer?.length) return;
  try {
    await fs.mkdir(COVER_CACHE_DIR, { recursive: true, mode: 0o700 });
    const filePath = coverDiskPath(cacheKey);
    const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = Buffer.concat([Buffer.from(`${contentType}\n`, "utf8"), buffer]);
    await fs.writeFile(temp, payload, { mode: 0o600 });
    await fs.rename(temp, filePath);
    coverDiskWriteCount += 1;
    if (coverDiskWriteCount % 25 === 0) {
      await pruneCoverDiskCache();
    }
  } catch {
    // Ignore non-critical disk cache persistence errors.
  }
}

async function tryFetchCoverImageOnce(rawUrl, timeoutMs, signal) {
  if (!isAllowedCoverUrl(rawUrl) || signal?.aborted) {
    return { ok: false, transient: false };
  }
  let current = new URL(rawUrl);

  for (let hop = 0; hop <= 3; hop += 1) {
    if (signal?.aborted) return { ok: false, transient: false };
    const host = current.hostname.toLowerCase();
    const hopTimeout = timeoutMs ?? (host === "cdnec.sanmin.com.tw" ? 3_500 : 4_000);

    const step = await withCoverHostSlot(host, async () => {
      if (signal?.aborted) return { kind: "miss" };
      const headers = { "User-Agent": USER_AGENT, Accept: "image/*" };
      const cookie = coverCookieHeader(host);
      if (cookie) headers.Cookie = cookie;

      let res;
      try {
        res = await fetch(current, {
          redirect: "manual",
          headers,
          signal: buildCoverRequestSignal(hopTimeout, signal),
        });
      } catch {
        return { kind: signal?.aborted ? "miss" : "transient" };
      }

      coverHostWarmed.add(host);
      updateCoverHostCookies(host, res);

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) return { kind: "miss" };
        let next;
        try {
          next = new URL(location, current);
        } catch {
          return { kind: "miss" };
        }
        if (next.protocol !== "https:" || !isAllowedCoverRedirectHost(next.hostname)) {
          return { kind: "miss" };
        }
        return { kind: "redirect", next };
      }

      if (res.status === 429 || res.status >= 500) {
        return { kind: "transient" };
      }
      if (!res.ok) return { kind: "miss" };

      const contentType = String(res.headers.get("content-type") || "").toLowerCase();
      if (!contentType.startsWith("image/") || contentType.includes("svg")) {
        return { kind: "miss" };
      }
      const len = Number(res.headers.get("content-length") || 0);
      if (len > MAX_COVER_BYTES) return { kind: "miss" };

      let buffer;
      try {
        buffer = Buffer.from(await res.arrayBuffer());
      } catch {
        return { kind: signal?.aborted ? "miss" : "transient" };
      }
      if (buffer.length < MIN_COVER_BYTES || buffer.length > MAX_COVER_BYTES) {
        return { kind: "miss" };
      }
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      if (GOOGLE_PLACEHOLDER_HASHES.has(sha256)) {
        return { kind: "miss" };
      }

      return {
        kind: "hit",
        contentType,
        buffer,
        etag: `"${sha256.slice(0, 16)}"`,
      };
    });

    if (step.kind === "redirect") {
      current = step.next;
      continue;
    }
    if (step.kind === "hit") {
      return {
        ok: true,
        contentType: step.contentType,
        buffer: step.buffer,
        etag: step.etag,
      };
    }
    if (step.kind === "transient") {
      return { ok: false, transient: true };
    }
    return { ok: false, transient: false };
  }

  return { ok: false, transient: false };
}

async function tryFetchCoverImage(rawUrl, { timeoutMs, retries, signal } = {}) {
  let parsedHost = "";
  try {
    parsedHost = new URL(rawUrl).hostname.toLowerCase();
  } catch {}
  const maxRetries = retries ?? (parsedHost === "cdnec.sanmin.com.tw" ? 1 : 0);
  let result = await tryFetchCoverImageOnce(rawUrl, timeoutMs, signal);
  for (
    let attempt = 0;
    attempt < maxRetries && !result.ok && result.transient && !signal?.aborted;
    attempt += 1
  ) {
    result = await tryFetchCoverImageOnce(rawUrl, timeoutMs, signal);
  }
  return result;
}

/**
 * Proxy vetted HTTPS book cover images and automatically fall back by ISBN across
 * Sanmin, Google Books, OpenBD, and Open Library while keeping `/library` CSP strict.
 */
export async function fetchLibraryCover(rawUrlOrOpts = "", maybeIsbn = "") {
  const opts =
    rawUrlOrOpts && typeof rawUrlOrOpts === "object"
      ? rawUrlOrOpts
      : { url: rawUrlOrOpts, isbn: maybeIsbn };
  const rawUrl = String(opts.url || "").trim();
  const rawIsbn = String(opts.isbn || "").trim();

  if (rawUrl && !isAllowedCoverUrl(rawUrl)) {
    throw libraryError("Unsupported cover image host.", "LIBRARY_COVER_DISALLOWED", 400);
  }
  const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : "";
  if (rawIsbn && !isbn) {
    throw libraryError("Invalid ISBN for cover lookup.", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!rawUrl && !isbn) {
    throw libraryError("Unsupported cover image host.", "LIBRARY_COVER_DISALLOWED", 400);
  }

  const cacheKey = `${rawUrl}|${isbn}`;
  const cached = getCoverImageCache(cacheKey);
  if (cached) {
    if (cached.hit) {
      return { contentType: cached.contentType, buffer: cached.buffer, etag: cached.etag };
    }
    throw libraryError("Cover image not available.", "LIBRARY_COVER_NOT_FOUND", 404);
  }

  const existing = coverInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const diskHit = await readCoverDiskCache(cacheKey);
    if (diskHit) {
      setCoverImageCache(cacheKey, {
        hit: true,
        contentType: diskHit.contentType,
        buffer: diskHit.buffer,
        etag: diskHit.etag,
        bytes: diskHit.buffer.length,
      });
      return diskHit;
    }

    let hadTransient = false;
    const attempted = new Set();
    const tryCandidateUrl = async (candidateUrl, signal) => {
      if (!candidateUrl || attempted.has(candidateUrl) || signal?.aborted) return null;
      attempted.add(candidateUrl);
      const result = await tryFetchCoverImage(candidateUrl, { signal });
      if (result.ok) return result;
      if (result.transient && !signal?.aborted) hadTransient = true;
      return null;
    };

    const tryProvider = async (provider, signal) => {
      if (signal?.aborted) return null;
      if (provider === "sanmin") {
        const url = sanminCoverUrlFromIsbn(isbn);
        return url ? tryCandidateUrl(url, signal) : null;
      }
      if (provider === "openbd") {
        return isbn.startsWith("9784")
          ? tryCandidateUrl(`https://cover.openbd.jp/${isbn}.jpg`, signal)
          : null;
      }
      if (provider === "gbooks") {
        const url = await lookupGoogleBooksCover(isbn);
        return url ? tryCandidateUrl(url, signal) : null;
      }
      if (provider === "openlibrary") {
        return tryCandidateUrl(
          `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
          signal,
        );
      }
      return null;
    };

    let resolved = rawUrl ? await tryCandidateUrl(rawUrl) : null;
    if (!resolved && isbn) {
      let order;
      if (/^978(957|986|626|7)/.test(isbn)) {
        order = ["sanmin", "gbooks", "openlibrary"];
      } else if (/^9784/.test(isbn)) {
        order = ["openbd", "gbooks", "sanmin", "openlibrary"];
      } else {
        order = isbn.startsWith("978")
          ? ["gbooks", "openlibrary", "sanmin"]
          : ["gbooks", "openlibrary"];
      }
      const remaining = order.filter((provider) => {
        if (provider === "sanmin") {
          const sanminUrl = sanminCoverUrlFromIsbn(isbn);
          return Boolean(sanminUrl && !attempted.has(sanminUrl));
        }
        return true;
      });
      if (remaining.length > 0) {
        const controller = new AbortController();
        // Start fallback providers concurrently; await in priority order and abort losers on hit.
        const tasks = remaining.map((provider) =>
          tryProvider(provider, controller.signal).catch(() => null),
        );
        try {
          for (const task of tasks) {
            const hit = await task;
            if (hit) {
              resolved = hit;
              break;
            }
          }
        } finally {
          controller.abort();
        }
      }
    }

    if (resolved) {
      setCoverImageCache(cacheKey, {
        hit: true,
        contentType: resolved.contentType,
        buffer: resolved.buffer,
        etag: resolved.etag,
        bytes: resolved.buffer.length,
      });
      void writeCoverDiskCache(cacheKey, resolved.contentType, resolved.buffer).catch(() => {});
      return {
        contentType: resolved.contentType,
        buffer: resolved.buffer,
        etag: resolved.etag,
      };
    }

    setCoverImageCache(
      cacheKey,
      { hit: false, bytes: 0 },
      hadTransient ? COVER_TRANSIENT_MISS_TTL_MS : COVER_MISS_TTL_MS,
    );
    throw libraryError("Cover image not available.", "LIBRARY_COVER_NOT_FOUND", 404);
  })().finally(() => {
    coverInFlight.delete(cacheKey);
  });

  coverInFlight.set(cacheKey, promise);
  return promise;
}

export function prefetchCatalogCovers(items = []) {
  if (!Array.isArray(items) || !items.length) return;
  const specs = [];
  const allIsbns = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    let url = isAllowedCoverUrl(item.rawCoverUrl)
      ? String(item.rawCoverUrl).trim()
      : "";
    let isbn = normalizeIsbn(item.isbn);

    if (!url && typeof item.coverProxyUrl === "string" && item.coverProxyUrl) {
      try {
        const parsed = new URL(item.coverProxyUrl, "http://localhost");
        const proxyUrl = parsed.searchParams.get("url") || "";
        const proxyIsbn = parsed.searchParams.get("isbn") || "";
        if (isAllowedCoverUrl(proxyUrl)) url = proxyUrl.trim();
        if (!isbn) isbn = normalizeIsbn(proxyIsbn);
      } catch {}
    }

    if (isbn) allIsbns.push(isbn);
    if (url || isbn) specs.push({ url, isbn });
  }

  if (allIsbns.length > 0) {
    void warmGoogleBooksCovers(allIsbns).catch(() => {});
  }

  for (const { url, isbn } of specs) {
    const cacheKey = `${url}|${isbn}`;
    if (getCoverImageCache(cacheKey) || coverInFlight.has(cacheKey)) continue;
    void fetchLibraryCover({ url, isbn }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Authenticated Library Overview, OPAC Account, Rooms & Downloads

async function loadEndnoteCatalog({ force = false } = {}) {
  if (!force && downloadsCache && Date.now() < downloadsCache.expiresAt) {
    return downloadsCache.items;
  }
  const { html } = await fetchAuthenticatedLibraryPage(
    `${LIBRARY_ORIGIN}/sso/dslist.aspx`,
  );
  const items = parseEndnoteDownloads(html);
  downloadsCache = { items, expiresAt: Date.now() + OVERVIEW_TTL_MS };
  return items;
}

function buildPublicCarrelDefaults(parsedForm) {
  const d = parsedForm?.formDefaults || {};
  return {
    role: d.role || "學生",
    today: d.today || "",
    hasContactDefaults: Boolean(d.name || d.studentId),
    department: d.department || "",
    phone: d.phone || "",
    email: d.email || "",
    altEmail: d.altEmail || "",
    periods: d.periods?.length
      ? d.periods
      : [
          { value: "1", label: "整天" },
          { value: "2", label: "9時-13時" },
          { value: "3", label: "13時-17時" },
          { value: "4", label: "17時-21時" },
        ],
    rooms: d.rooms?.length
      ? d.rooms
      : ["1", "2", "3", "4", "5", "6", "7"].map((v) => ({
          value: v,
          label: `研究小間10F-${v}`,
        })),
    rules: d.rules || [],
  };
}

/**
 * Fetch the consolidated authenticated `/library` hub state with per-section
 * partial error isolation.
 */
export async function getLibraryOverview({ force = false } = {}) {
  if (!force && overviewCache && Date.now() < overviewCache.expiresAt) {
    return overviewCache.data;
  }
  if (!force && overviewInFlight) {
    return overviewInFlight;
  }

  overviewInFlight = (async () => {
    await ensureLibrarySession({ needOpac: true, forceRefresh: force });

    const sectionErrors = {};

    const [opacResult, cancelResult, formResult, downloadsResult] =
      await Promise.allSettled([
        fetchAuthenticatedLibraryPage(`${OPAC_BASE}/search/account?`, {
          needOpac: true,
        }),
        fetchAuthenticatedLibraryPage(
          `${LIBRARY_ORIGIN}/library/OrderRoom/CancelRoom2.aspx`,
        ),
        fetchAuthenticatedLibraryPage(
          `${LIBRARY_ORIGIN}/library/OrderRoom/OrderRoom2.aspx`,
        ),
        loadEndnoteCatalog({ force }),
      ]);

    // If any section revealed an upstream ePortal login requirement, propagate 401.
    for (const res of [opacResult, cancelResult, formResult, downloadsResult]) {
      if (
        res.status === "rejected" &&
        res.reason?.code === "EPORTAL_LOGIN_REQUIRED"
      ) {
        throw res.reason;
      }
    }

    let account = {
      status: "UNKNOWN",
      checkoutsCount: 0,
      holdsCount: 0,
      finesTotal: "NT$0.00",
      patron: { maskedId: "" },
      checkouts: [],
      holds: [],
      fines: [],
      history: [],
    };
    if (opacResult.status === "fulfilled") {
      account = parseOpacAccount(opacResult.value.html);
    } else {
      sectionErrors.opac =
        opacResult.reason?.message || "無法載入館藏個人借閱帳戶。";
    }

    let reservations = [];
    if (cancelResult.status === "fulfilled") {
      reservations = parseCarrelReservations(cancelResult.value.html).reservations;
    } else {
      sectionErrors.carrels =
        cancelResult.reason?.message || "無法載入研究小間預約紀錄。";
    }

    let formDefaults = buildPublicCarrelDefaults(null);
    if (formResult.status === "fulfilled") {
      formDefaults = buildPublicCarrelDefaults(parseCarrelForm(formResult.value.html));
    } else if (!sectionErrors.carrels) {
      sectionErrors.carrels =
        formResult.reason?.message || "無法載入研究小間申請設定。";
    }

    let downloads = [];
    if (downloadsResult.status === "fulfilled") {
      downloads = downloadsResult.value.map(({ fid, title, platform }) => ({
        fid,
        title,
        platform,
        downloadPath: `/api/library/downloads/${encodeURIComponent(fid)}`,
      }));
    } else {
      sectionErrors.downloads =
        downloadsResult.reason?.message || "無法載入書目管理軟體清單。";
    }

    const data = {
      fetchedAt: new Date().toISOString(),
      status: account.status,
      patron: account.patron,
      summary: {
        checkoutsCount: account.checkoutsCount,
        holdsCount: account.holdsCount,
        finesTotal: account.finesTotal,
        activeCarrelsCount: reservations.length,
      },
      account: {
        checkouts: account.checkouts,
        holds: account.holds,
        fines: account.fines,
        history: account.history,
      },
      carrels: {
        reservations: reservations.map(({ postbackTarget, postbackArgument, submitValue, ...pub }) => pub),
        formDefaults,
      },
      downloads,
      quickLinks: [
        { key: "opac", label: "官方館藏系統", kind: "open" },
        { key: "group-discuss", label: "預約團體討論室", kind: "open" },
        { key: "group-screening", label: "預約團體放映室", kind: "open" },
        { key: "orientation", label: "預約新生利用教育", kind: "open" },
        { key: "ejournals", label: "電子期刊資源", kind: "open" },
        { key: "summon", label: "電子資源探索 (Summon)", kind: "open" },
        { key: "recommend", label: "書刊推薦", kind: "open" },
        { key: "patron-rights", label: "讀者權益聲明", kind: "open" },
        { key: "reset-pin", label: "重設館藏查詢密碼", kind: "open" },
      ],
      sectionErrors,
    };

    overviewCache = { data, expiresAt: Date.now() + OVERVIEW_TTL_MS };
    return data;
  })().finally(() => {
    overviewInFlight = null;
  });

  return overviewInFlight;
}

/**
 * Renew eligible OPAC checkouts through the authenticated SirsiDynix session.
 */
export async function renewOpacCheckouts(itemIds = []) {
  const cleanIds = Array.isArray(itemIds)
    ? itemIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (!cleanIds.length) {
    throw libraryError("請選擇至少一本要續借的館藏。", "LIBRARY_INVALID_PARAM", 400);
  }

  const { html } = await fetchAuthenticatedLibraryPage(
    `${OPAC_BASE}/search/account?`,
    { needOpac: true },
  );
  const parsed = parseOpacAccount(html);
  const targetLoans = parsed.checkouts.filter(
    (c) => cleanIds.includes(c.id) && c.renewable && c.renewFieldName,
  );
  if (!targetLoans.length) {
    throw libraryError(
      "選取的館藏目前無法線上續借。",
      "LIBRARY_RENEW_UNAVAILABLE",
      400,
    );
  }

  const actionUrl = parsed.renewAction
    ? new URL(parsed.renewAction, OPAC_ORIGIN).toString()
    : `${OPAC_BASE}/search/account.checkouts.renewform`;

  const body = new URLSearchParams();
  for (const loan of targetLoans) {
    body.append(loan.renewFieldName, loan.renewValue);
  }

  const { response } = await httpRequestWithCookies(actionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${OPAC_BASE}/search/account?`,
    },
    body: body.toString(),
    timeoutMs: 15_000,
  });
  const replyHtml = await response.text();
  invalidateLibraryDataCaches();

  const updated = parseOpacAccount(replyHtml);
  const alertMessage = stripHtml(
    replyHtml.match(/<div[^>]*class="[^"]*(?:error|message|confirm|feedback)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
      "已送出續借請求。",
  );

  return {
    ok: true,
    message: alertMessage,
    account: updated,
  };
}

// ---------------------------------------------------------------------------
// Authenticated OPAC My Lists (`我的清單` / `/search/mylists`)

const MYLISTS_TTL_MS = 2 * 60_000;

function normalizeOpacListId(raw = "") {
  const clean = String(raw ?? "").trim();
  if (!clean) return "";
  if (!/^\d{1,12}$/.test(clean)) {
    throw libraryError("Invalid OPAC list ID.", "LIBRARY_INVALID_PARAM", 400);
  }
  return clean;
}

function normalizeOpacTitleId(raw = "") {
  const clean = String(raw ?? "").trim();
  if (!/^\d{1,12}$/.test(clean)) {
    throw libraryError("Invalid catalog item ID.", "LIBRARY_INVALID_PARAM", 400);
  }
  return clean;
}

function toPublicMyListsPayload(parsed) {
  const mappedItems = mergeCachedAvailabilityIntoItems(
    (parsed.items || []).map((item) =>
      normalizeCatalogItemForPublic({
        ...item,
        rawCoverUrl: "",
        availableCount: null,
        totalCount: null,
        holdsCount: null,
        holdable: false,
      }),
    ),
  );
  if (mappedItems.length) {
    prefetchCatalogCovers(mappedItems);
  }
  const availabilityPending = mappedItems.some(
    (item) => item.availableCount == null,
  );
  return {
    ok: true,
    activeListId: parsed.activeListId,
    activeListName: parsed.activeListName,
    canSaveTemp:
      Boolean(parsed.forms?.saveTempListForm) &&
      parsed.activeListId === "0" &&
      mappedItems.length > 0,
    canCreateList: Boolean(parsed.forms?.createListForm),
    lists: (parsed.lists || []).map((l) => ({
      id: l.id,
      name: l.name,
      isTemp: Boolean(l.isTemp),
      active: Boolean(l.active),
      count: l.count,
      canDelete: !l.isTemp && Boolean(l.deleteInputName),
    })),
    availabilityPending,
    items: mappedItems,
  };
}

async function fetchAuthenticatedOpacMyLists(listId = "") {
  const cleanId = listId ? normalizeOpacListId(listId) : "";
  const targetUrl = cleanId
    ? `${OPAC_BASE}/search/mylists/${encodeURIComponent(cleanId)}?`
    : `${OPAC_BASE}/search/mylists?`;

  let { html } = await fetchAuthenticatedLibraryPage(targetUrl, {
    needOpac: true,
  });
  let parsed = parseOpacMyLists(html, { fallbackListId: cleanId || "0" });

  if (parsed.loginRequired) {
    await ensureLibrarySession({ needOpac: true, forceRefresh: true });
    const retry = await httpRequestWithCookies(targetUrl, {
      maxRedirects: 8,
      timeoutMs: 18_000,
    });
    html = await retry.response.text();
    parsed = parseOpacMyLists(html, { fallbackListId: cleanId || "0" });
    if (parsed.loginRequired) {
      throw libraryError(
        "OPAC 個人清單工作階段需要重新登入 Server ePortal。",
        "EPORTAL_LOGIN_REQUIRED",
        401,
      );
    }
  }

  return parsed;
}

/**
 * Fetch the patron's OPAC My Lists (`我的清單`) and the items in the active/selected list.
 */
export async function getOpacMyLists({ listId = "", force = false } = {}) {
  const cleanId = listId ? normalizeOpacListId(listId) : "";
  const cacheKey = cleanId || "default";
  if (!force) {
    const cached = getCachedMap(myListsCache, cacheKey);
    if (cached) return cached;
  }

  const parsed = await fetchAuthenticatedOpacMyLists(cleanId);
  const payload = toPublicMyListsPayload(parsed);
  setCachedMap(myListsCache, cacheKey, payload, MYLISTS_TTL_MS, 20);
  if (parsed.activeListId && parsed.activeListId !== cacheKey) {
    setCachedMap(myListsCache, parsed.activeListId, payload, MYLISTS_TTL_MS, 20);
  }
  return payload;
}

/**
 * Add a catalog title to a patron's OPAC list (`臨時清單` or saved list ID).
 */
export async function addOpacMyListItem({
  titleId,
  listId = "0",
  makeDefault = false,
} = {}) {
  const cleanId = normalizeOpacTitleId(titleId);
  const cleanListId = normalizeOpacListId(listId || "0") || "0";

  await ensureLibrarySession({ needOpac: true });
  const encodedEnt = `ent:$002f$002fSD_ILS$002f0$002fSD_ILS:${cleanId}`;
  const dParam = encodeURIComponent(`ent://SD_ILS/0/SD_ILS:${cleanId}~~0`).replace(
    /~/g,
    "%7E",
  );
  const addUrl = `${OPAC_BASE}/search/detailnonmodal.detail.addtolists:addtolist/${encodeURIComponent(cleanListId)}/${makeDefault ? "true" : "false"}/${encodedEnt}/Detail/$N?d=${dParam}`;

  let { response } = await httpRequestWithCookies(addUrl, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: `${OPAC_BASE}/search/detailnonmodal/${encodedEnt}/one`,
    },
    timeoutMs: 12_000,
  });

  let reply = await response.json().catch(() => null);
  if (!reply || reply?.login) {
    await ensureLibrarySession({ needOpac: true, forceRefresh: true });
    const retry = await httpRequestWithCookies(addUrl, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: `${OPAC_BASE}/search/detailnonmodal/${encodedEnt}/one`,
      },
      timeoutMs: 12_000,
    });
    response = retry.response;
    reply = await response.json().catch(() => null);
  }

  if (reply?.login) {
    throw libraryError(
      "請重新登入 Server ePortal 以新增至我的清單。",
      "EPORTAL_LOGIN_REQUIRED",
      401,
    );
  }
  if (!response.ok || reply?.error) {
    throw libraryError("無法將館藏加入 OPAC 清單。", "LIBRARY_OPAC_UNAVAILABLE", 502);
  }
  if (Array.isArray(reply?.failed) && reply.failed.length && !(reply?.added?.length)) {
    throw libraryError(
      String(reply.failed[0] || "無法加入 OPAC 清單。"),
      "LIBRARY_MYLISTS_FAILED",
      400,
    );
  }

  myListsCache.clear();
  const updated = await getOpacMyLists({ listId: cleanListId, force: true });
  return {
    ...updated,
    added: Array.isArray(reply?.added) ? reply.added : [],
  };
}

async function submitMyListFormMutation({
  listId = "0",
  titleIds = [],
  action,
  destListId = "",
}) {
  const cleanListId = normalizeOpacListId(listId || "0") || "0";
  const cleanIds = Array.isArray(titleIds)
    ? titleIds.map(normalizeOpacTitleId)
    : [normalizeOpacTitleId(titleIds)];
  if (!cleanIds.length) {
    throw libraryError("請選擇至少一筆清單館藏。", "LIBRARY_INVALID_PARAM", 400);
  }

  const parsed = await fetchAuthenticatedOpacMyLists(cleanListId);
  const idSet = new Set(cleanIds);
  const hasMatch = parsed.items.some((item) => idSet.has(item.id));
  if (!hasMatch) {
    return { ...toPublicMyListsPayload(parsed), changed: false };
  }

  const form = parsed.forms?.myListForm;
  if (!form?.actionPath || !form?.formData) {
    throw libraryError(
      "無法取得 OPAC 清單操作表單。",
      "LIBRARY_OPAC_UNAVAILABLE",
      502,
    );
  }

  const rawContext = parsed.items
    .map((item) => (idSet.has(item.id) ? "1" : "0"))
    .join("");
  const submitId = form.submitName || form.submitClientId || "listdetails_submit";
  const postUrl = new URL(form.actionPath, OPAC_ORIGIN).toString();
  const body = new URLSearchParams({
    "t:formdata": form.formData,
    "t:submit": JSON.stringify([submitId, submitId]),
    listdetails_action: action,
    listdetails_rawContext: rawContext,
    listdetails_destListId: destListId || parsed.activeListId || cleanListId,
    listdetails_sortType: "",
    listdetails_saveSort: "",
    "t:zoneid": form.zoneId || "myListItemsZone",
  });

  const { response } = await httpRequestWithCookies(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${OPAC_BASE}/search/mylists/${encodeURIComponent(cleanListId)}?`,
    },
    body: body.toString(),
    timeoutMs: 15_000,
  });
  const replyText = await response.text();
  if (!response.ok || /<title>系統錯誤<\/title>/i.test(replyText)) {
    throw libraryError("OPAC 清單更新失敗。", "LIBRARY_MYLISTS_FAILED", 502);
  }

  myListsCache.clear();
  const updated = await getOpacMyLists({ listId: cleanListId, force: true });
  return { ...updated, changed: true };
}

/**
 * Remove one or more titles from an OPAC My List via Tapestry `DELETE` submission.
 */
export async function removeOpacMyListItems({ titleIds = [], listId = "0" } = {}) {
  return submitMyListFormMutation({
    listId,
    titleIds,
    action: "DELETE",
  });
}

/**
 * Move or copy one or more titles from one OPAC My List to another.
 */
export async function transferOpacMyListItems({
  titleIds = [],
  fromListId = "0",
  destListId,
  mode = "COPY",
} = {}) {
  const cleanDestId = normalizeOpacListId(destListId);
  if (!cleanDestId) {
    throw libraryError("請選擇目標清單。", "LIBRARY_INVALID_PARAM", 400);
  }
  return submitMyListFormMutation({
    listId: fromListId || "0",
    titleIds,
    action: String(mode || "").toUpperCase() === "MOVE" ? "MOVE" : "COPY",
    destListId: cleanDestId,
  });
}

/**
 * Create a new saved OPAC list or save the current temporary list (`臨時清單`) under a name.
 */
export async function createOrSaveOpacMyList({ name = "", fromTemp = false } = {}) {
  const cleanName = String(name || "").trim().slice(0, 120);
  if (!cleanName) {
    throw libraryError("請輸入清單名稱。", "LIBRARY_INVALID_PARAM", 400);
  }

  const parsed = await fetchAuthenticatedOpacMyLists(fromTemp ? "0" : "");
  const form = fromTemp
    ? parsed.forms?.saveTempListForm || parsed.forms?.createListForm
    : parsed.forms?.createListForm || parsed.forms?.saveTempListForm;
  if (!form?.actionPath || !form?.formData) {
    throw libraryError(
      "無法建立已保存的 OPAC 清單（請確認已登入 OPAC）。",
      "LIBRARY_MYLISTS_UNAVAILABLE",
      400,
    );
  }

  const body = new URLSearchParams({
    "t:formdata": form.formData,
    [form.nameField]: cleanName,
  });
  if (form.submitName) {
    body.set(form.submitName, form.submitValue || "保存");
  }
  if (form.zoneId) {
    body.set("t:zoneid", form.zoneId);
  }
  const submitId = form.submitClientId || form.submitName;
  if (submitId) {
    body.set("t:submit", JSON.stringify([submitId, submitId]));
  }

  const postUrl = new URL(form.actionPath, OPAC_ORIGIN).toString();
  const { response } = await httpRequestWithCookies(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${OPAC_BASE}/search/mylists?`,
    },
    body: body.toString(),
    timeoutMs: 15_000,
  });
  const replyText = await response.text();
  if (!response.ok || /<title>系統錯誤<\/title>/i.test(replyText)) {
    throw libraryError("建立 OPAC 清單失敗。", "LIBRARY_MYLISTS_FAILED", 502);
  }

  myListsCache.clear();
  const latest = await fetchAuthenticatedOpacMyLists("");
  const created = latest.lists.find((l) => l.name === cleanName && !l.isTemp);
  if (created && !created.active) {
    return getOpacMyLists({ listId: created.id, force: true });
  }
  const payload = toPublicMyListsPayload(latest);
  setCachedMap(myListsCache, latest.activeListId || "default", payload, MYLISTS_TTL_MS, 20);
  return payload;
}

/**
 * Delete a saved OPAC list by ID (`臨時清單` ID `0` cannot be deleted).
 */
export async function deleteOpacMyList({ listId = "" } = {}) {
  const cleanId = normalizeOpacListId(listId);
  if (!cleanId || cleanId === "0") {
    throw libraryError("臨時清單無法刪除。", "LIBRARY_INVALID_PARAM", 400);
  }

  const parsed = await fetchAuthenticatedOpacMyLists(cleanId);
  const target = parsed.lists.find((l) => l.id === cleanId);
  const form = parsed.forms?.deleteListsForm;
  if (!target || !form?.actionPath || !form?.formData) {
    throw libraryError("找不到可刪除的 OPAC 清單。", "LIBRARY_MYLISTS_UNAVAILABLE", 404);
  }

  const body = new URLSearchParams({
    "t:formdata": form.formData,
    [form.actionField || "lists_action"]: "DELETE",
    [form.activeListField || "lists_activeList"]: cleanId,
  });
  if (target.deleteInputName) {
    body.set(target.deleteInputName, target.deleteInputValue || "on");
  }
  if (form.zoneId) {
    body.set("t:zoneid", form.zoneId);
  }
  const submitId = form.submitClientId || form.submitName || "lists_submit";
  body.set("t:submit", JSON.stringify([submitId, submitId]));

  const postUrl = new URL(form.actionPath, OPAC_ORIGIN).toString();
  const { response } = await httpRequestWithCookies(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${OPAC_BASE}/search/mylists?`,
    },
    body: body.toString(),
    timeoutMs: 15_000,
  });
  const replyText = await response.text();
  if (!response.ok || /<title>系統錯誤<\/title>/i.test(replyText)) {
    throw libraryError("刪除 OPAC 清單失敗。", "LIBRARY_MYLISTS_FAILED", 502);
  }

  myListsCache.clear();
  return getOpacMyLists({ force: true });
}

/**
 * Fetch monthly Study Carrel availability from `RoomCAL2.aspx`.
 */
export async function getCarrelAvailability({
  year,
  month,
  force = false,
} = {}) {
  const now = new Date();
  const targetYear = Number.parseInt(year, 10) || now.getFullYear();
  const targetMonth = Number.parseInt(month, 10) || now.getMonth() + 1;

  if (
    targetYear < now.getFullYear() - 1 ||
    targetYear > now.getFullYear() + 1 ||
    targetMonth < 1 ||
    targetMonth > 12
  ) {
    throw libraryError("Invalid year or month.", "LIBRARY_INVALID_PARAM", 400);
  }

  const cacheKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  if (!force) {
    const cached = getCachedMap(calendarCache, cacheKey);
    if (cached) return cached;
  }

  const calUrl = `${LIBRARY_ORIGIN}/library/OrderRoom/RoomCAL2.aspx`;
  let { html } = await fetchAuthenticatedLibraryPage(calUrl);
  let cal = parseCarrelCalendar(html, { year: targetYear, month: targetMonth });

  // Step prev/next months via ASP.NET postback if requested month differs (max 3 hops).
  for (let hop = 0; hop < 3; hop += 1) {
    const currentSerial = cal.year * 12 + cal.month;
    const wantedSerial = targetYear * 12 + targetMonth;
    if (currentSerial === wantedSerial) break;

    const nav = wantedSerial < currentSerial ? cal.prevTarget : cal.nextTarget;
    if (!nav) break;

    const form = new URLSearchParams({
      __EVENTTARGET: nav.target,
      __EVENTARGUMENT: nav.arg,
      __VIEWSTATE: cal.hidden.__VIEWSTATE || "",
      __VIEWSTATEGENERATOR: cal.hidden.__VIEWSTATEGENERATOR || "",
      __EVENTVALIDATION: cal.hidden.__EVENTVALIDATION || "",
    });
    const nextPage = await fetchAuthenticatedLibraryPage(calUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: calUrl,
      },
      body: form.toString(),
    });
    html = nextPage.html;
    cal = parseCarrelCalendar(html, { year: targetYear, month: targetMonth });
  }

  const result = {
    year: cal.year,
    month: cal.month,
    rooms: cal.rooms,
    days: cal.days,
  };
  setCachedMap(calendarCache, cacheKey, result, CALENDAR_TTL_MS, 12);
  return result;
}

function toWebFormsDate(isoDate) {
  const m = String(isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    dt.getFullYear() !== Number(yyyy) ||
    dt.getMonth() !== Number(mm) - 1 ||
    dt.getDate() !== Number(dd)
  ) {
    return null;
  }
  return { iso: m[0], us: `${mm}/${dd}/${yyyy}`, date: dt };
}

function extractAspNetFeedback(html = "") {
  const alertMatch = String(html || "").match(
    /alert\(\s*(['"])((?:\\.|[^\\])*?)\1\s*\)/i,
  );
  if (alertMatch) {
    return decodeHtmlEntities(
      alertMatch[2].replace(/\\n/g, " ").replace(/\\'/g, "'").replace(/\\"/g, '"'),
    ).trim();
  }
  const msgLabel = String(html || "").match(
    /id="[^"]*(?:lblMsg|LabelMsg|Message|Err)[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  return msgLabel ? stripHtml(msgLabel[1]) : "";
}

/**
 * Submit a Study Carrel reservation to `OrderRoom2.aspx` on the user's behalf.
 */
export async function bookStudyCarrel(payload = {}) {
  const role = String(payload.role || "學生").trim();
  const department = String(payload.department || "").trim();
  const phone = String(payload.phone || "").trim();
  const altEmail = String(payload.altEmail || "").trim();
  const timePeriod = String(payload.timePeriod || "").trim();
  const room = String(payload.room || "").trim();
  const start = toWebFormsDate(payload.dateStart);
  const end = toWebFormsDate(payload.dateEnd || payload.dateStart);

  if (!["專任教師", "研究生", "學生"].includes(role)) {
    throw libraryError("請選擇有效的身份別。", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!department || !phone || !altEmail) {
    throw libraryError(
      "請填寫所屬單位、聯絡電話與備用電子郵件。",
      "LIBRARY_INVALID_PARAM",
      400,
    );
  }
  if (!["1", "2", "3", "4"].includes(timePeriod)) {
    throw libraryError("請選擇有效的借用時段。", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!["1", "2", "3", "4", "5", "6", "7"].includes(room)) {
    throw libraryError("請選擇有效的研究小間編號 (10F-1–10F-7)。", "LIBRARY_INVALID_PARAM", 400);
  }
  if (!start || !end || end.date < start.date) {
    throw libraryError("借用起始與結束日期不正確。", "LIBRARY_INVALID_PARAM", 400);
  }
  const days = Math.round((end.date - start.date) / 86_400_000) + 1;
  if (days > 62) {
    throw libraryError("借用天數超出上限。", "LIBRARY_INVALID_PARAM", 400);
  }

  const orderUrl = `${LIBRARY_ORIGIN}/library/OrderRoom/OrderRoom2.aspx`;
  const { html } = await fetchAuthenticatedLibraryPage(orderUrl);
  const parsed = parseCarrelForm(html);

  const email = String(payload.email || parsed.formDefaults.email || "").trim();
  if (!parsed.formDefaults.name || !parsed.formDefaults.studentId) {
    throw libraryError(
      "無法讀取官方預約表單的姓名或學號，請重新登入 Server ePortal。",
      "EPORTAL_LOGIN_REQUIRED",
      401,
    );
  }

  const form = new URLSearchParams({
    __EVENTTARGET: "",
    __EVENTARGUMENT: "",
    __VIEWSTATE: parsed.hidden.__VIEWSTATE || "",
    __VIEWSTATEGENERATOR: parsed.hidden.__VIEWSTATEGENERATOR || "",
    __EVENTVALIDATION: parsed.hidden.__EVENTVALIDATION || "",
    RBLType: role,
    tbCrt_Date: parsed.formDefaults.today || "",
    tbName: parsed.formDefaults.name,
    tbSID: parsed.formDefaults.studentId,
    tbClassName: department,
    tbTEL: phone,
    tbEMail: email,
    tbEMail1: altEmail,
    tbDate1: start.us,
    tbDate2: end.us,
    tbDays: String(days),
    ddlTimePeriod: timePeriod,
    ddlRoom: room,
    btnOrder: "確定預約",
  });

  const { html: replyHtml } = await fetchAuthenticatedLibraryPage(orderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: orderUrl,
    },
    body: form.toString(),
  });

  invalidateLibraryDataCaches();

  const feedback = extractAspNetFeedback(replyHtml);
  const isFailure =
    !feedback ||
    /失敗|已被預約|額滿|不可|超過|錯誤|請輸入|請選擇|無法/.test(feedback);

  if (isFailure && feedback) {
    throw libraryError(feedback, "LIBRARY_BOOKING_REJECTED", 409);
  }

  return {
    ok: true,
    message: feedback || "研究小間預約申請已送出。",
  };
}

/**
 * Cancel a future Study Carrel reservation matched against live `CancelRoom2.aspx`.
 */
export async function cancelStudyCarrel(targetId) {
  const cleanTarget = String(targetId || "").trim();
  if (!cleanTarget) {
    throw libraryError("Missing reservation targetId.", "LIBRARY_INVALID_PARAM", 400);
  }

  const cancelUrl = `${LIBRARY_ORIGIN}/library/OrderRoom/CancelRoom2.aspx`;
  const { html } = await fetchAuthenticatedLibraryPage(cancelUrl);
  const parsed = parseCarrelReservations(html);
  const target = parsed.reservations.find((r) => r.targetId === cleanTarget);

  if (!target) {
    throw libraryError("找不到指定的研究小間預約紀錄。", "LIBRARY_NOT_FOUND", 404);
  }
  if (!target.canCancel || !target.postbackTarget) {
    throw libraryError("該筆預約無法透過線上取消（僅可取消明天以後之預約）。", "LIBRARY_CANCEL_UNAVAILABLE", 400);
  }

  const form = new URLSearchParams({
    __EVENTTARGET: target.submitValue ? "" : target.postbackTarget,
    __EVENTARGUMENT: target.submitValue ? "" : target.postbackArgument,
    __VIEWSTATE: parsed.hidden.__VIEWSTATE || "",
    __VIEWSTATEGENERATOR: parsed.hidden.__VIEWSTATEGENERATOR || "",
    __EVENTVALIDATION: parsed.hidden.__EVENTVALIDATION || "",
  });
  if (target.submitValue) {
    form.set(target.postbackTarget, target.submitValue);
  }

  const { html: replyHtml } = await fetchAuthenticatedLibraryPage(cancelUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: cancelUrl,
    },
    body: form.toString(),
  });

  invalidateLibraryDataCaches();
  const after = parseCarrelReservations(replyHtml);
  const feedback = extractAspNetFeedback(replyHtml) || "已取消該筆研究小間預約。";

  return {
    ok: true,
    message: feedback,
    reservations: after.reservations.map(
      ({ postbackTarget, postbackArgument, submitValue, ...pub }) => pub,
    ),
  };
}

/**
 * Stream an EndNote installer file (`dlfile.aspx`) resolved strictly from the
 * server's authenticated `dslist.aspx` catalog so raw `fk` keys aren't trusted
 * from client requests.
 */
export async function downloadEndnoteFile(fid) {
  const cleanFid = String(fid || "").trim();
  if (!/^\d{1,20}$/.test(cleanFid)) {
    throw libraryError("Invalid download id.", "LIBRARY_INVALID_PARAM", 400);
  }

  const items = await loadEndnoteCatalog();
  const entry = items.find((item) => item.fid === cleanFid);
  if (!entry) {
    throw libraryError("找不到指定的下載項目。", "LIBRARY_NOT_FOUND", 404);
  }

  const dlUrl = `${LIBRARY_ORIGIN}/sso/dlfile.aspx?fid=${encodeURIComponent(entry.fid)}&fk=${encodeURIComponent(entry.fk)}`;
  await ensureLibrarySession();
  const { response } = await httpRequestWithCookies(dlUrl, {
    maxRedirects: 6,
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw libraryError(
      `Download failed with HTTP ${response.status}.`,
      "LIBRARY_DOWNLOAD_FAILED",
      502,
    );
  }

  const cd = String(response.headers.get("content-disposition") || "");
  const fallbackName = `${entry.title.replace(/[^A-Za-z0-9._\-\u4e00-\u9fff]+/g, "_")}.zip`;
  const filenameMatch = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  const safeName = filenameMatch
    ? decodeURIComponent(filenameMatch[1].replace(/["\\/]/g, "").trim())
    : fallbackName;

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    filename: safeName || "endnote-download",
    contentType: response.headers.get("content-type") || "application/octet-stream",
    buffer,
  };
}

/**
 * Resolve an allowlisted `/library/open/:key` destination to an authenticated SSO
 * redirect URL without exposing tickets in `/api/library/overview`.
 */
export async function resolveLibraryOpenTarget(key) {
  const cleanKey = String(key || "").trim();
  if (Object.hasOwn(STATIC_OPEN_TARGETS, cleanKey)) {
    return STATIC_OPEN_TARGETS[cleanKey];
  }
  const linkProp = SSO_OPEN_KEY_MAP[cleanKey];
  if (!linkProp) {
    throw libraryError("Unknown library destination.", "LIBRARY_INVALID_PARAM", 400);
  }

  await ensureLibrarySession({ forceRefresh: true });
  const target = sessionLinks[linkProp];
  if (!target) {
    throw libraryError(
      "無法取得對應的圖書館 SSO 連結。",
      "LIBRARY_OPEN_UNAVAILABLE",
      502,
    );
  }
  return target;
}

function resolveLibraryErrorStatus(error) {
  if (error?.statusCode) return error.statusCode;
  if (error?.code === "EPORTAL_PROFILE_BUSY") return 409;
  if (error?.code === "EPORTAL_LOGIN_REQUIRED") return 401;
  return 502;
}

function sendLibraryFailure(sendError, res, error, fallbackMessage, fallbackCode) {
  sendError(
    res,
    resolveLibraryErrorStatus(error),
    error?.message || fallbackMessage,
    error?.code || fallbackCode,
  );
}

/**
 * Dispatch all `/api/library/*` and `/library/open/:key` routes using the shared
 * hybrid catalog/authenticated session service. Returns true if handled.
 */
export async function handleLibraryRequest(
  req,
  res,
  url,
  { sendJson, sendError, readJsonBody },
  deps = {},
) {
  const {
    overviewFn = getLibraryOverview,
    searchCatalogFn = searchLibraryCatalog,
    catalogAvailabilityFn = getLibraryCatalogAvailability,
    catalogItemFn = getLibraryCatalogItem,
    renewFn = renewOpacCheckouts,
    databasesFn = searchLibraryDatabases,
    availabilityFn = getCarrelAvailability,
    bookCarrelFn = bookStudyCarrel,
    cancelCarrelFn = cancelStudyCarrel,
    downloadFn = downloadEndnoteFile,
    coverFn = fetchLibraryCover,
    openTargetFn = resolveLibraryOpenTarget,
    favoritesStore = null,
    favoritesListFn = null,
    favoritesAddFn = null,
    favoritesRemoveFn = null,
    opacMyListsFn = getOpacMyLists,
    opacMyListAddFn = addOpacMyListItem,
    opacMyListRemoveFn = removeOpacMyListItems,
    opacMyListTransferFn = transferOpacMyListItems,
    opacMyListCreateFn = createOrSaveOpacMyList,
    opacMyListDeleteFn = deleteOpacMyList,
  } = deps;

  if (req.method === "GET" && url.pathname === "/api/library/opac/mylists") {
    try {
      const force = /^(1|true|yes)$/i.test(
        String(url.searchParams.get("refresh") || ""),
      );
      sendJson(
        res,
        200,
        await opacMyListsFn({
          listId: url.searchParams.get("listId") || "",
          force,
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load OPAC My Lists.",
        "LIBRARY_MYLISTS_UNAVAILABLE",
      );
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/library/opac/mylists/lists") {
    try {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await opacMyListCreateFn({
          name: body?.name || "",
          fromTemp: Boolean(body?.fromTemp),
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to create OPAC list.",
        "LIBRARY_MYLISTS_FAILED",
      );
    }
    return true;
  }

  const opacListDeleteMatch =
    req.method === "DELETE" &&
    url.pathname.match(/^\/api\/library\/opac\/mylists\/lists\/([^/]+)$/);
  if (opacListDeleteMatch) {
    try {
      const listId = decodeURIComponent(opacListDeleteMatch[1]);
      sendJson(res, 200, await opacMyListDeleteFn({ listId }));
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to delete OPAC list.",
        "LIBRARY_MYLISTS_FAILED",
      );
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/library/opac/mylists/items") {
    try {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await opacMyListAddFn({
          titleId: body?.titleId || body?.id || "",
          listId: body?.listId || "0",
          makeDefault: Boolean(body?.makeDefault),
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to add item to OPAC list.",
        "LIBRARY_MYLISTS_FAILED",
      );
    }
    return true;
  }

  if (
    req.method === "POST" &&
    url.pathname === "/api/library/opac/mylists/items/transfer"
  ) {
    try {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await opacMyListTransferFn({
          titleIds: body?.titleIds || (body?.titleId ? [body.titleId] : []),
          fromListId: body?.fromListId || "0",
          destListId: body?.destListId || "",
          mode: body?.mode || "COPY",
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to transfer items between OPAC lists.",
        "LIBRARY_MYLISTS_FAILED",
      );
    }
    return true;
  }

  const opacItemDeleteMatch =
    req.method === "DELETE" &&
    url.pathname.match(/^\/api\/library\/opac\/mylists\/items\/([^/]+)$/);
  if (opacItemDeleteMatch) {
    try {
      const titleId = decodeURIComponent(opacItemDeleteMatch[1]);
      const listId = url.searchParams.get("listId") || "0";
      sendJson(
        res,
        200,
        await opacMyListRemoveFn({ titleIds: [titleId], listId }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to remove item from OPAC list.",
        "LIBRARY_MYLISTS_FAILED",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/favorites") {
    try {
      const listFn =
        favoritesListFn ||
        (favoritesStore ? () => favoritesStore.getLibraryFavorites() : null);
      if (!listFn) {
        sendError(res, 501, "Library favorites storage is unavailable.");
        return true;
      }
      const items = await listFn();
      sendJson(res, 200, { ok: true, items: Array.isArray(items) ? items : [] });
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load library favorites.",
        "LIBRARY_FAVORITES_ERROR",
      );
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/library/favorites") {
    try {
      const addFn =
        favoritesAddFn ||
        (favoritesStore ? (body) => favoritesStore.addLibraryFavorite(body) : null);
      if (!addFn) {
        sendError(res, 501, "Library favorites storage is unavailable.");
        return true;
      }
      const body = await readJsonBody(req);
      const saved = await addFn(body);
      sendJson(res, 200, { ok: true, ...saved });
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to save favorite book.",
        "LIBRARY_FAVORITES_ERROR",
      );
    }
    return true;
  }

  const favoriteDeleteMatch =
    req.method === "DELETE" &&
    url.pathname.match(/^\/api\/library\/favorites\/([^/]+)$/);
  if (favoriteDeleteMatch) {
    try {
      const removeFn =
        favoritesRemoveFn ||
        (favoritesStore ? (id) => favoritesStore.removeLibraryFavorite(id) : null);
      if (!removeFn) {
        sendError(res, 501, "Library favorites storage is unavailable.");
        return true;
      }
      const id = decodeURIComponent(favoriteDeleteMatch[1]);
      const result = await removeFn(id);
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to remove favorite book.",
        "LIBRARY_FAVORITES_ERROR",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/overview") {
    try {
      const force = /^(1|true|yes)$/i.test(
        String(url.searchParams.get("refresh") || ""),
      );
      sendJson(res, 200, await overviewFn({ force }));
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load NUTC Library overview.",
        "LIBRARY_OVERVIEW_UNAVAILABLE",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/catalog/search") {
    try {
      sendJson(
        res,
        200,
        await searchCatalogFn({
          q: url.searchParams.get("q") || "",
          field: url.searchParams.get("field") || "ALL",
          scope: url.searchParams.get("scope") || "ALL",
          preset: url.searchParams.get("preset") || "",
          sort: url.searchParams.get("sort") || "RE",
          tags: url.searchParams.getAll("tag"),
          page: url.searchParams.get("page") || "1",
          ...(url.searchParams.has("pageSize")
            ? { pageSize: url.searchParams.get("pageSize") }
            : {}),
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to search the library catalog.",
        "LIBRARY_OPAC_UNAVAILABLE",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/catalog/availability") {
    try {
      sendJson(
        res,
        200,
        await catalogAvailabilityFn(url.searchParams.get("ids") || ""),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load catalog availability.",
        "LIBRARY_OPAC_UNAVAILABLE",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/catalog/item") {
    try {
      sendJson(
        res,
        200,
        await catalogItemFn(url.searchParams.get("path") || ""),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load catalog item holdings.",
        "LIBRARY_OPAC_UNAVAILABLE",
      );
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/library/opac/renew") {
    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, await renewFn(body?.itemIds));
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to renew selected library items.",
        "LIBRARY_RENEW_FAILED",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/databases") {
    try {
      sendJson(
        res,
        200,
        await databasesFn({
          q: url.searchParams.get("q") || "",
          language: url.searchParams.get("language") || "",
          college: url.searchParams.get("college") || "",
          subject: url.searchParams.get("subject") || "",
          type: url.searchParams.get("type") || "",
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load electronic databases.",
        "LIBRARY_DB_UNAVAILABLE",
      );
    }
    return true;
  }

  if (
    req.method === "GET" &&
    url.pathname === "/api/library/rooms/carrel/availability"
  ) {
    try {
      const force = /^(1|true|yes)$/i.test(
        String(url.searchParams.get("refresh") || ""),
      );
      sendJson(
        res,
        200,
        await availabilityFn({
          year: url.searchParams.get("year") || "",
          month: url.searchParams.get("month") || "",
          force,
        }),
      );
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to load study carrel availability.",
        "LIBRARY_ROOMS_UNAVAILABLE",
      );
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/library/rooms/carrel/book") {
    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, await bookCarrelFn(body || {}));
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to submit study carrel booking.",
        "LIBRARY_BOOKING_FAILED",
      );
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/library/rooms/carrel/cancel") {
    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, await cancelCarrelFn(body?.targetId || ""));
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to cancel study carrel booking.",
        "LIBRARY_CANCEL_FAILED",
      );
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/library/cover") {
    try {
      const cover = await coverFn({
        url: url.searchParams.get("url") || "",
        isbn: url.searchParams.get("isbn") || "",
      });
      const etag =
        cover.etag ||
        `"${crypto.createHash("sha256").update(cover.buffer).digest("hex").slice(0, 16)}"`;
      if (req.headers?.["if-none-match"] === etag) {
        res.writeHead(304, {
          ETag: etag,
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        });
        res.end();
        return true;
      }
      res.writeHead(200, {
        "Content-Type": cover.contentType,
        "Content-Length": cover.buffer.length,
        ETag: etag,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(cover.buffer);
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Cover image unavailable.",
        "LIBRARY_COVER_UNAVAILABLE",
      );
    }
    return true;
  }

  const downloadMatch =
    req.method === "GET" &&
    url.pathname.match(/^\/api\/library\/downloads\/([^/]+)$/);
  if (downloadMatch) {
    try {
      const fid = decodeURIComponent(downloadMatch[1]);
      const file = await downloadFn(fid);
      res.writeHead(200, {
        "Content-Type": file.contentType,
        "Content-Length": file.buffer.length,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(file.buffer);
    } catch (error) {
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to download software file.",
        "LIBRARY_DOWNLOAD_FAILED",
      );
    }
    return true;
  }

  const openMatch =
    req.method === "GET" && url.pathname.match(/^\/library\/open\/([a-z0-9-]+)$/);
  if (openMatch) {
    try {
      const targetUrl = await openTargetFn(openMatch[1]);
      res.writeHead(302, {
        Location: targetUrl,
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
      });
      res.end();
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") {
        res.writeHead(302, {
          Location: "/server-login/?force=1&next=%2Flibrary",
          "Cache-Control": "no-store",
        });
        res.end();
        return true;
      }
      sendLibraryFailure(
        sendError,
        res,
        error,
        "Unable to open official library destination.",
        "LIBRARY_OPEN_UNAVAILABLE",
      );
    }
    return true;
  }

  return false;
}

