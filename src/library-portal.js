import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createModuleHandoff } from "./portal-session.js";
import {
  decodeHtmlEntities,
  mergeOpacAvailability,
  parseCarrelCalendar,
  parseCarrelForm,
  parseCarrelReservations,
  parseDatabasesList,
  parseEndnoteDownloads,
  parseLibraryPortalLinks,
  parseOpacAccount,
  parseOpacItemDetail,
  parseOpacSearchResults,
  stripHtml,
} from "./library-parsers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const LIBRARY_ORIGIN = "https://library.nutc.edu.tw";
export const OPAC_ORIGIN = "https://ntit.ent.sirsidynix.net";
export const OPAC_BASE = `${OPAC_ORIGIN}/client/zh_TW/NUTC`;
const SESSION_FILE = path.join(ROOT, "data", "library-session.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const OVERVIEW_TTL_MS = 5 * 60_000;
const CATALOG_TTL_MS = 5 * 60_000;
const DATABASES_TTL_MS = 5 * 60_000;
const CALENDAR_TTL_MS = 2 * 60_000;
const MAX_COVER_BYTES = 2 * 1024 * 1024;

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
  "static.findbook.com.tw",
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

function toCoverProxyUrl(rawUrl) {
  if (!isAllowedCoverUrl(rawUrl)) return "";
  return `/api/library/cover?url=${encodeURIComponent(rawUrl)}`;
}

// ---------------------------------------------------------------------------
// Bounded TTL caches + Cookie jar persistence

let jar = [];
let jarLoaded = false;
let sessionLinks = {};
let sessionInFlight = null;

let overviewCache = null;
let overviewInFlight = null;
let downloadsCache = null;
const catalogCache = new Map();
const catalogInFlight = new Map();
const itemDetailCache = new Map();
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
  itemDetailCache.clear();
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
  const coverProxyUrl = toCoverProxyUrl(item.rawCoverUrl);
  const { rawCoverUrl, ...rest } = item;
  return { ...rest, coverProxyUrl };
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
} = {}) {
  const cleanQ = String(q || "").trim().slice(0, 160);
  const upperField = String(field || "ALL").trim().toUpperCase();
  const upperScope = String(scope || "ALL").trim().toUpperCase();
  const upperPreset = String(preset || "").trim().toUpperCase();
  const upperSort = String(sort || "RE").trim().toUpperCase() || "RE";
  const pageNum = Math.max(1, Math.min(500, Number.parseInt(page, 10) || 1));

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

  const cacheKey = `${upperPreset}|${upperScope}|${upperField}|${upperSort}|${pageNum}|${cleanTags.join("||")}|${cleanQ}`;
  const cached = getCachedMap(catalogCache, cacheKey);
  if (cached) return cached;

  const existing = catalogInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
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
    if (pageNum > 1) {
      url.searchParams.set("rw", String((pageNum - 1) * 12));
    }

    let response;
    let html;
    try {
      ({ response } = await httpRequestWithCookies(url.toString(), {
        useCookies: false,
        timeoutMs: 25_000,
      }));
      if (!response.ok) {
        throw libraryError(
          `Catalog search failed with HTTP ${response.status}.`,
          "LIBRARY_OPAC_UNAVAILABLE",
          502,
        );
      }
      html = await response.text();
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw libraryError("館藏系統回應逾時，請稍後再試。", "LIBRARY_OPAC_TIMEOUT", 504);
      }
      throw error;
    }

    const parsed = parseOpacSearchResults(html, {
      query: cleanQ,
      field: upperField,
      scope: upperScope,
      preset: upperPreset,
      sort: upperSort,
      tags: cleanTags,
      page: pageNum,
    });

    let mergedItems = parsed.items;
    if (parsed.availabilityUrl && parsed.items.length > 0) {
      try {
        const availRes = await httpRequestWithCookies(parsed.availabilityUrl, {
          useCookies: false,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json, text/javascript, */*",
          },
          timeoutMs: 10_000,
        });
        if (availRes.response.ok) {
          const json = await availRes.response.json();
          mergedItems = mergeOpacAvailability(parsed.items, json);
        }
      } catch {
        // Availability enrichment is best-effort; still show catalog results.
      }
    }

    const result = {
      query: parsed.query,
      field: parsed.field,
      scope: parsed.scope,
      preset: parsed.preset,
      sort: parsed.sort,
      tags: parsed.tags,
      page: parsed.page,
      totalResults: parsed.totalResults,
      totalPages: parsed.totalPages,
      facets: parsed.facets,
      items: mergedItems.map(normalizeCatalogItemForPublic),
    };

    setCachedMap(catalogCache, cacheKey, result, CATALOG_TTL_MS, 60);
    return result;
  })().finally(() => {
    catalogInFlight.delete(cacheKey);
  });

  catalogInFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Fetch detailed bibliographic info and per-copy holdings for one OPAC record.
 */
export async function getLibraryCatalogItem(detailPath) {
  const cleanPath = String(detailPath || "").trim();
  if (!VALID_DETAIL_PATH.test(cleanPath)) {
    throw libraryError("Invalid catalog item path.", "LIBRARY_INVALID_PARAM", 400);
  }

  const cached = getCachedMap(itemDetailCache, cleanPath);
  if (cached) return cached;

  const targetUrl = `${OPAC_ORIGIN}${cleanPath}`;
  const { response } = await httpRequestWithCookies(targetUrl, {
    useCookies: false,
    timeoutMs: 12_000,
  });
  if (!response.ok) {
    throw libraryError(
      `Catalog item lookup failed with HTTP ${response.status}.`,
      "LIBRARY_OPAC_UNAVAILABLE",
      502,
    );
  }

  const html = await response.text();
  const detail = parseOpacItemDetail(html, cleanPath);
  const publicDetail = {
    ...detail,
    coverProxyUrl: toCoverProxyUrl(detail.rawCoverUrl),
  };
  delete publicDetail.rawCoverUrl;

  setCachedMap(itemDetailCache, cleanPath, publicDetail, CATALOG_TTL_MS, 60);
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

/**
 * Proxy vetted HTTPS book cover images so `/library` keeps a strict `'self'` CSP.
 */
export async function fetchLibraryCover(rawUrl) {
  if (!isAllowedCoverUrl(rawUrl)) {
    throw libraryError("Unsupported cover image host.", "LIBRARY_COVER_DISALLOWED", 400);
  }

  const res = await fetch(rawUrl, {
    redirect: "error",
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw libraryError("Cover image not available.", "LIBRARY_COVER_NOT_FOUND", 404);
  }

  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    throw libraryError("Invalid cover content type.", "LIBRARY_COVER_INVALID", 404);
  }

  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_COVER_BYTES) {
    throw libraryError("Cover image too large.", "LIBRARY_COVER_TOO_LARGE", 413);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_COVER_BYTES) {
    throw libraryError("Invalid cover payload size.", "LIBRARY_COVER_INVALID", 404);
  }

  return { contentType, buffer };
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
    catalogItemFn = getLibraryCatalogItem,
    renewFn = renewOpacCheckouts,
    databasesFn = searchLibraryDatabases,
    availabilityFn = getCarrelAvailability,
    bookCarrelFn = bookStudyCarrel,
    cancelCarrelFn = cancelStudyCarrel,
    downloadFn = downloadEndnoteFile,
    coverFn = fetchLibraryCover,
    openTargetFn = resolveLibraryOpenTarget,
  } = deps;

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
      const { contentType, buffer } = await coverFn(
        url.searchParams.get("url") || "",
      );
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(buffer);
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

