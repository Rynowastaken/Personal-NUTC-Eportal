const LIBRARY_ORIGIN = "https://library.nutc.edu.tw";
const OPAC_ORIGIN = "https://ntit.ent.sirsidynix.net";
const OPAC_BASE = `${OPAC_ORIGIN}/client/zh_TW/NUTC`;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  ldquo: '"',
  rdquo: '"',
  lsquo: "'",
  rsquo: "'",
  ndash: "-",
  mdash: "-",
};

/**
 * Decode common named and numeric HTML entities to plain text.
 */
export function decodeHtmlEntities(raw = "") {
  return String(raw || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9#]+);/gi, (m, code) => {
    const lower = code.toLowerCase();
    if (Object.hasOwn(NAMED_ENTITIES, lower)) return NAMED_ENTITIES[lower];
    if (lower.startsWith("#x")) {
      const cp = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff
        ? String.fromCodePoint(cp)
        : m;
    }
    if (lower.startsWith("#")) {
      const cp = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff
        ? String.fromCodePoint(cp)
        : m;
    }
    return m;
  });
}

/**
 * Remove scripts, styles, and HTML tags, collapsing runs of whitespace.
 */
export function stripHtml(raw = "") {
  const withoutBlocks = String(raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(withoutBlocks).replace(/\s+/g, " ").trim();
}

/**
 * Mask student/card identifiers so raw personal numbers are never shown by default.
 */
export function maskLibraryIdentifier(value = "") {
  const clean = String(value || "").replace(/\s+/g, "").trim();
  if (!clean) return "";
  if (clean.length <= 4) return "*".repeat(clean.length);
  return (
    clean.slice(0, 3) +
    "*".repeat(Math.max(3, clean.length - 5)) +
    clean.slice(-2)
  );
}

function resolveLibraryHref(rawHref, baseUrl) {
  if (!rawHref || rawHref === "#") return "";
  const normalized = decodeHtmlEntities(rawHref).replace(/\\/g, "/").trim();
  if (!normalized || /^javascript:/i.test(normalized)) return "";
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return "";
  }
}

/**
 * Extract authenticated destination links from `library.nutc.edu.tw/sso/default2.aspx`.
 */
export function parseLibraryPortalLinks(
  html = "",
  baseUrl = `${LIBRARY_ORIGIN}/sso/default2.aspx`,
) {
  const out = {};
  const anchors = [
    ...String(html || "").matchAll(
      /<a\b[^>]*href=(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ];

  const matchers = [
    ["opac", (t, u) => t.includes("館藏查詢、圖書預約") || u.includes("decryptuid")],
    ["carrel", (t, u) => t.includes("預約研究小間") || /url=OrderRoom2\.aspx/i.test(u)],
    ["carrelCancel", (t, u) => t.includes("研究小間預約紀錄") || /url=CancelRoom2\.aspx/i.test(u)],
    ["groupDiscuss", (t, u) => t.includes("預約團體討論室") || /url=OrderRoom1\.aspx/i.test(u)],
    ["groupScreening", (t, u) => t.includes("預約團體放映室") || (/url=OrderRoom\.aspx/i.test(u) && !u.includes("?t=t"))],
    ["orientation", (t, u) => t.includes("預約新生利用教育") || /OrderRoom\.aspx\?t=t/i.test(u)],
    ["recommend", (t, u) => t.includes("書刊推薦") || u.includes("brs.nutc.edu.tw")],
    ["patronRights", (t, u) => t.includes("讀者權益聲明") || /activeacc2\.aspx/i.test(u)],
    ["resetPin", (t, u) => t.includes("重設館藏查詢密碼") || /resetPIN\.aspx/i.test(u)],
    ["databases", (t, u) => t === "資料庫" || /indexDB\.asp/i.test(u)],
    ["ejournals", (t, u) => t.includes("電子期刊") || u.includes("serialssolutions.com")],
    ["endnote", (t, u) => t.includes("Endnote") || /dslist\.aspx/i.test(u)],
  ];

  for (const [, , href, inner] of anchors) {
    const text = stripHtml(inner);
    const resolved = resolveLibraryHref(href, baseUrl);
    if (!resolved) continue;
    for (const [key, testFn] of matchers) {
      if (!out[key] && testFn(text, resolved)) {
        out[key] = resolved;
      }
    }
  }

  return out;
}

/**
 * Parse EndNote installer download records from `dslist.aspx`.
 */
export function parseEndnoteDownloads(html = "") {
  const results = [];
  const seen = new Set();
  const anchors = [
    ...String(html || "").matchAll(
      /<a\b[^>]*href=(["'])([^"']*dlfile\.aspx\?[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ];

  for (const [, , rawHref, inner] of anchors) {
    const title = stripHtml(inner);
    if (!title) continue;
    let url;
    try {
      url = new URL(decodeHtmlEntities(rawHref), `${LIBRARY_ORIGIN}/sso/`);
    } catch {
      continue;
    }
    const fid = (url.searchParams.get("fid") || "").trim();
    const fk = (url.searchParams.get("fk") || "").trim();
    if (!fid || !fk || seen.has(fid)) continue;
    seen.add(fid);

    let platform = "其他";
    if (/\bWIN/i.test(title)) platform = "Windows";
    else if (/\bMAC/i.test(title)) platform = "macOS";

    results.push({ fid, fk, title, platform });
  }

  return results;
}

/**
 * Parse database entries from `library.nutc.edu.tw/database/search/DatabasesList.asp`.
 */
export function parseDatabasesList(
  html = "",
  baseUrl = `${LIBRARY_ORIGIN}/database/search/`,
) {
  const rows = [
    ...String(html || "").matchAll(
      /<tr\b[^>]*class=(["'])[^"']*\bdataresult\b[^"']*\1[^>]*>([\s\S]*?)<\/tr>/gi,
    ),
  ];

  const items = [];
  for (const [, , rowHtml] of rows) {
    const cells = [
      ...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((m) => m[1]);
    if (cells.length < 3) continue;

    const firstAnchor = cells[0].match(
      /<a\b[^>]*href=(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/a>/i,
    );
    const name = firstAnchor ? stripHtml(firstAnchor[3]) : stripHtml(cells[0]);
    const directUrl = firstAnchor ? resolveLibraryHref(firstAnchor[2], baseUrl) : "";
    if (!name) continue;

    const accessType = stripHtml(cells[1] || "");
    const description = stripHtml(cells[2] || "");

    const guideAnchor = (cells[3] || "").match(
      /<a\b[^>]*href=(["'])([^"']*)\1[^>]*>/i,
    );
    const guideUrl = guideAnchor ? resolveLibraryHref(guideAnchor[2], baseUrl) : "";

    const expiry = stripHtml(cells[4] || "");

    const detailAnchor = (cells[5] || "").match(
      /<a\b[^>]*href=(["'])([^"']*)\1[^>]*>/i,
    );
    const detailUrl = detailAnchor
      ? resolveLibraryHref(detailAnchor[2], baseUrl)
      : "";

    let id = "";
    if (detailUrl) {
      try {
        id = new URL(detailUrl).searchParams.get("Item") || "";
      } catch {
        id = "";
      }
    }
    if (!id) id = `db-${items.length + 1}`;

    items.push({
      id,
      name,
      url: directUrl,
      accessType,
      description,
      guideUrl,
      expiry,
      detailUrl,
    });
  }

  return items;
}

function extractBalancedTagBlocks(html, startPattern) {
  const blocks = [];
  const regex = new RegExp(startPattern, "gi");
  let match;
  while ((match = regex.exec(html)) !== null) {
    const start = match.index;
    let cursor = start;
    let depth = 0;
    const tagRegex = /<\/?div\b[^>]*>/gi;
    tagRegex.lastIndex = start;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
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
    if (cursor > start) {
      blocks.push(html.slice(start, cursor));
      regex.lastIndex = cursor;
    }
  }
  return blocks;
}

function firstMatch(text, pattern, group = 1) {
  const match = String(text || "").match(pattern);
  return match ? match[group] : "";
}

const FACET_GROUPS = [
  ["SUBJECT", "主題"],
  ["LANGUAGE", "語言"],
  ["PUBDATE", "出版年"],
  ["ITYPE", "類型"],
  ["LOCAL_NOTE_590", "SDGs"],
];

/**
 * Extract structured facet tag groups (`SUBJECT`, `LANGUAGE`, `PUBDATE`, `ITYPE`,
 * `LOCAL_NOTE_590`) and clickable `qf` query parameters from SirsiDynix OPAC HTML.
 */
export function parseOpacFacets(html = "") {
  const source = String(html || "");
  const byKey = new Map();
  const formRegex =
    /<form\b[^>]*id="facetForm(SUBJECT|LANGUAGE|PUBDATE|ITYPE|LOCAL_NOTE_590)"[^>]*>([\s\S]*?)<\/form>/gi;

  for (const [, keyRaw, body] of source.matchAll(formRegex)) {
    const key = keyRaw.toUpperCase();
    const seenQf = new Set();
    const items = [];
    const linkRegex =
      /<a\b[^>]*href="([^"]*navigatorclick\?[^"]*)"[^>]*>([\s\S]*?)<\/a>(?:\s*<\/span>)?(?:\s*<div\b[^>]*class="[^"]*navigatorCount[^"]*"[^>]*>\s*\(?([\d,]+)\)?\s*<\/div>)?/gi;

    for (const [, rawHref, rawLabel, rawCount] of body.matchAll(linkRegex)) {
      let qf = "";
      try {
        qf =
          new URL(decodeHtmlEntities(rawHref), OPAC_ORIGIN).searchParams.get("qf") ||
          "";
      } catch {
        qf = "";
      }
      qf = qf.trim();
      const label = stripHtml(rawLabel);
      if (!qf || !label || seenQf.has(qf)) continue;
      seenQf.add(qf);

      const count = rawCount ? Number.parseInt(rawCount.replace(/,/g, ""), 10) : null;
      items.push({
        qf,
        label,
        count: Number.isFinite(count) ? count : null,
      });
    }

    if (!items.length) continue;
    if (key === "PUBDATE") {
      items.sort((a, b) => {
        const ya = /^\d{4}$/.test(a.label) ? Number.parseInt(a.label, 10) : -1;
        const yb = /^\d{4}$/.test(b.label) ? Number.parseInt(b.label, 10) : -1;
        return yb - ya;
      });
    }
    byKey.set(key, items.slice(0, 14));
  }

  return FACET_GROUPS.filter(([key]) => byKey.has(key)).map(([key, label]) => ({
    key,
    label,
    items: byKey.get(key),
  }));
}

/**
 * Parse SirsiDynix Enterprise OPAC search results HTML.
 */
export function parseOpacSearchResults(
  html = "",
  { query = "", field = "ALL", scope = "ALL", preset = "", sort = "RE", tags = [], page = 1 } = {},
) {
  const source = String(html || "");
  const totalRaw = firstMatch(
    source,
    /class="[^"]*resultsToolbar_num_results[^"]*"[^>]*>\s*([\d,]+)\s*個結果/i,
  );
  const totalResults = totalRaw
    ? Number.parseInt(totalRaw.replace(/,/g, ""), 10) || 0
    : 0;

  const availabilityUrlRaw = firstMatch(
    source,
    /url\s*=\s*['"](https:\/\/ntit\.ent\.sirsidynix\.net\/client\/zh_TW\/NUTC\/search\/results\.displaypanel\.any_0:loadavailability\/[^'"]+)['"]/i,
  );
  const availabilityUrl = availabilityUrlRaw
    ? decodeHtmlEntities(availabilityUrlRaw)
    : "";

  const cells = extractBalancedTagBlocks(
    source,
    `<div\\s+id="results_cell\\d+"\\s+class="results_cell">`,
  );

  const items = [];
  for (let i = 0; i < cells.length; i += 1) {
    const block = cells[i];
    const indexRaw = firstMatch(block, /<div\s+id="results_cell(\d+)"/i);
    const hitIndex = indexRaw ? Number.parseInt(indexRaw, 10) : i;

    const entRaw = firstMatch(block, /value="(ent:\/\/SD_ILS\/[^"]+)"/i);
    const titleId = firstMatch(entRaw || block, /SD_ILS:(\d+)/i);
    if (!titleId) continue;

    const isbn = stripHtml(
      firstMatch(block, /<input\b[^>]*class="isbnValue"[^>]*value="([^"]*)"/i) ||
        firstMatch(block, /<input\b[^>]*value="([^"]*)"[^>]*class="isbnValue"/i),
    );

    const titleRaw =
      firstMatch(block, /id="detailLink\d+"[^>]*>([\s\S]*?)<\/a>/i) ||
      firstMatch(block, /class="displayDetailLink"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = stripHtml(titleRaw);
    if (!title) continue;

    const author = stripHtml(
      firstMatch(
        block,
        /<div\s+class="displayElementText[^"]*INITIAL_AUTHOR_SRCH"[^>]*>([\s\S]*?)<\/div>/i,
      ),
    );
    const publisherYear = stripHtml(
      firstMatch(
        block,
        /<div\s+class="displayElementText[^"]*PUBYEAR"[^>]*>([\s\S]*?)<\/div>/i,
      ),
    );
    const campus = stripHtml(
      firstMatch(
        block,
        /<div\s+class="displayElementText[^"]*LIBRARY"[^>]*>([\s\S]*?)<\/div>/i,
      ),
    );
    const callNumber = stripHtml(
      firstMatch(
        block,
        /<div\s+class="displayElementText[^"]*CALLNUMBER"[^>]*>([\s\S]*?)<\/div>/i,
      ),
    );

    const coverCandidate = stripHtml(
      firstMatch(
        source,
        new RegExp(
          `id="hitlist${hitIndex}_BOOKCOVER"[\\s\\S]{0,400}?class="BOOKCOVER_value"[^>]*>([\\s\\S]*?)<\\/div>`,
          "i",
        ),
      ) ||
        firstMatch(
          block,
          /<img\b[^>]*class="results_img"[^>]*src="(https:\/\/[^"]+)"/i,
        ),
    );
    const rawCoverUrl = /^https:\/\//i.test(coverCandidate) ? coverCandidate : "";

    const encodedEnt = `ent:$002f$002fSD_ILS$002f0$002fSD_ILS:${titleId}`;
    const detailPath = `/client/zh_TW/NUTC/search/detailnonmodal/${encodedEnt}/one`;

    items.push({
      id: titleId,
      title,
      author,
      publisherYear,
      isbn,
      callNumber,
      campus,
      availableCount: null,
      totalCount: null,
      holdsCount: null,
      holdable: false,
      rawCoverUrl,
      detailPath,
      officialUrl: `${OPAC_ORIGIN}${detailPath}`,
    });
  }

  const pageSize = 12;
  const effectiveTotal = Math.max(totalResults, items.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  return {
    query,
    field,
    scope,
    preset,
    sort,
    tags: Array.isArray(tags) ? tags : [],
    page: Math.max(1, Number(page) || 1),
    totalResults: effectiveTotal,
    totalPages,
    availabilityUrl,
    facets: parseOpacFacets(source),
    items,
  };
}

/**
 * Merge SirsiDynix `:loadavailability` JSON counts into parsed catalog items.
 */
export function mergeOpacAvailability(items = [], availabilityList = []) {
  const byId = new Map();
  if (Array.isArray(availabilityList)) {
    for (const entry of availabilityList) {
      const id = String(entry?.titleId || "").trim();
      if (!id) continue;
      byId.set(id, {
        availableCount: Number.parseInt(entry.availableCount, 10) || 0,
        totalCount: Number.parseInt(entry.copyCount, 10) || 0,
        holdsCount: Number.parseInt(entry.holdCount, 10) || 0,
        holdable: Boolean(entry.holdable),
      });
    }
  }

  return items.map((item) => {
    const match = byId.get(item.id);
    if (!match) return item;
    return { ...item, ...match };
  });
}

/**
 * Parse SirsiDynix Enterprise OPAC item detail page (`detailnonmodal/.../one`).
 */
export function parseOpacItemDetail(html = "", detailPath = "") {
  const source = String(html || "");

  const extractBiblio = (cls) =>
    stripHtml(
      firstMatch(
        source,
        new RegExp(
          `<div\\s+class="displayElementText[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
          "i",
        ),
      ),
    );

  const title =
    extractBiblio("INITIAL_TITLE_SRCH") ||
    stripHtml(firstMatch(source, /<title>([\s\S]*?)<\/title>/i));
  const author =
    extractBiblio("INITIAL_AUTHOR_SRCH") || extractBiblio("PERSONAL_AUTHOR");
  const publisherYear =
    extractBiblio("PUBLICATION_INFO") || extractBiblio("PUBYEAR");
  const isbn = extractBiblio("ISBN");
  const summary =
    extractBiblio("SUMMARY") || extractBiblio("DESCRIPTION") || extractBiblio("NOTE");

  const coverCandidate = stripHtml(
    firstMatch(source, /class="BOOKCOVER_value"[^>]*>([\s\S]*?)<\/div>/i),
  );
  const rawCoverUrl = /^https:\/\//i.test(coverCandidate) ? coverCandidate : "";

  const holdings = [];
  const rowMatches = [
    ...source.matchAll(
      /<tr\b[^>]*class="[^"]*detailItemsTableRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi,
    ),
  ];

  for (const [, rowHtml] of rowMatches) {
    const readCell = (cellClass) => {
      const cell = firstMatch(
        rowHtml,
        new RegExp(
          `<td\\b[^>]*class="[^"]*${cellClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`,
          "i",
        ),
      );
      if (!cell) return "";
      const defaultVal = firstMatch(
        cell,
        /id="asyncFieldDefault[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      );
      if (defaultVal) return stripHtml(defaultVal);
      const text = stripHtml(cell);
      return text === "正在查詢..." ? "" : text;
    };

    const branch = readCell("detailItemsTable_LIBRARY");
    const itemType = readCell("detailItemsTable_ITYPE");
    const barcode = readCell("detailItemsTable_BARCODE");
    const callNumber = readCell("detailItemsTable_CALLNUMBER");
    const status = readCell("detailItemsTable_SD_ITEM_STATUS") || "未知";

    if (branch || callNumber || barcode) {
      holdings.push({ branch, itemType, barcode, callNumber, status });
    }
  }

  return {
    title,
    author,
    publisherYear,
    isbn,
    summary,
    rawCoverUrl,
    detailPath,
    officialUrl: detailPath ? `${OPAC_ORIGIN}${detailPath}` : `${OPAC_BASE}/`,
    holdings,
  };
}

function parseAccountTableRows(sectionHtml = "") {
  const rows = [
    ...String(sectionHtml || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi),
  ];
  const parsed = [];
  for (const [, rowHtml] of rows) {
    if (/<th\b/i.test(rowHtml)) continue;
    const cells = [
      ...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((m) => m[1]);
    if (!cells.length) continue;
    parsed.push({ rowHtml, cells, texts: cells.map((c) => stripHtml(c)) });
  }
  return parsed;
}

/**
 * Parse SirsiDynix Enterprise `我的帳戶` (`search/account?`) HTML.
 */
export function parseOpacAccount(html = "") {
  const source = String(html || "");

  const status = stripHtml(
    firstMatch(source, /您的狀態[:：]\s*([^<\s|&]+)/i),
  );
  const checkoutsSummaryCount = Number.parseInt(
    firstMatch(source, /借閱\s*總計[:：]\s*(\d+)/i) || "0",
    10,
  );
  const holdsSummaryCount = Number.parseInt(
    firstMatch(source, /預約\s*總計[:：]\s*(\d+)/i) || "0",
    10,
  );
  const finesTotal =
    stripHtml(firstMatch(source, /應付款總額[:：]\s*(NT\$[\d,.]+)/i)) ||
    "NT$0.00";

  const rawCardId = stripHtml(
    firstMatch(
      source,
      /讀者借閱證號碼[\s\S]{0,160}?<(?:td|dd|div|span)[^>]*>([^<]+)<\/(?:td|dd|div|span)>/i,
    ),
  );

  // Extract section chunks safely by id boundary
  const sliceById = (id, stopIds) => {
    const startIdx = source.search(new RegExp(`id="${id}"`, "i"));
    if (startIdx < 0) return "";
    let endIdx = source.length;
    for (const stop of stopIds) {
      const idx = source.search(new RegExp(`id="${stop}"`, "i"));
      if (idx > startIdx && idx < endIdx) endIdx = idx;
    }
    return source.slice(startIdx, endIdx);
  };

  const checkoutsChunk = sliceById("checkoutsTab", ["holdsTab", "finesTab"]);
  const holdsChunk = sliceById("holdsTab", ["finesTab"]);
  const finesChunk = sliceById("finesTab", []);

  const checkoutsListChunk = sliceById("CheckoutsList", [
    "CheckoutsHistoryList",
    "holdsTab",
    "finesTab",
  ]);
  const checkouts = [];
  for (const { rowHtml, texts } of parseAccountTableRows(
    checkoutsListChunk || checkoutsChunk,
  )) {
    const title = texts.find((t) => t && !/^(續借|歸還|renew)$/i.test(t) && !/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(t)) || "";
    if (!title || /目前沒有任何|無借閱/.test(title)) continue;

    const checkboxMatch = rowHtml.match(
      /<input\b[^>]*type="checkbox"[^>]*name="([^"]*)"[^>]*value="([^"]*)"/i,
    );
    const itemId =
      checkboxMatch?.[2] ||
      firstMatch(rowHtml, /value="([^"]+)"[^>]*name="[^"]*check"/i) ||
      `loan-${checkouts.length + 1}`;
    const dueMatch = texts.find((t) => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t)) || "";
    const renewalsText = texts.find((t) => /已續借|續借次數|\d+\s*次/.test(t)) || "";
    const callNumber = texts.find((t) => /^[0-9A-Z]{2,}[.\s0-9A-Z-]*$/i.test(t) && !/^\d{4}[/-]/.test(t)) || "";

    checkouts.push({
      id: itemId,
      title,
      callNumber,
      dueDate: dueMatch,
      renewals: renewalsText,
      renewable: Boolean(checkboxMatch),
      renewFieldName: checkboxMatch?.[1] || "",
      renewValue: checkboxMatch?.[2] || "",
    });
  }

  const holds = [];
  for (const { texts } of parseAccountTableRows(holdsChunk)) {
    const joined = texts.join(" ");
    if (!joined || /目前沒有任何|無預約/.test(joined)) continue;
    const title = texts[0] || texts[1] || "";
    if (!title) continue;
    holds.push({
      title,
      pickupLibrary: texts.find((t) => /總館|分館|圖書館/.test(t)) || "",
      status: texts.find((t) => /可取|等待|處理|備妥|佇列/.test(t)) || texts[texts.length - 1] || "",
      expiresAt: texts.find((t) => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t)) || "",
    });
  }

  const fines = [];
  for (const { texts } of parseAccountTableRows(finesChunk)) {
    const joined = texts.join(" ");
    if (!joined || /目前沒有任何|無罰款|NT\$0(\.00)?$/i.test(joined)) continue;
    const title = texts[0] || "";
    if (!title) continue;
    const amount = texts.find((t) => /NT\$|\d+\.\d{2}/.test(t)) || "";
    const reason = texts.find((t) => t !== title && t !== amount && !/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t)) || "";
    const date = texts.find((t) => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t)) || "";
    fines.push({ title, reason, amount, date });
  }

  const historyChunk = sliceById("CheckoutsHistoryList", ["holdsTab", "finesTab"]);
  const history = [];
  for (const { texts } of parseAccountTableRows(historyChunk)) {
    const joined = texts.join(" ");
    if (!joined || /目前沒有任何|無歷史/.test(joined)) continue;
    const title = texts[0] || "";
    if (!title) continue;
    history.push({
      title,
      author: texts[1] || "",
      checkoutDate: texts.find((t) => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t)) || "",
    });
  }

  const renewAction = decodeHtmlEntities(
    firstMatch(
      checkoutsChunk,
      /<form\b[^>]*action="([^"]*)"[^>]*>[\s\S]*?(?:renew|續借)/i,
    ),
  );

  return {
    status: status || "OK",
    checkoutsCount: Math.max(checkoutsSummaryCount, checkouts.length),
    holdsCount: Math.max(holdsSummaryCount, holds.length),
    finesTotal,
    patron: {
      maskedId: rawCardId ? maskLibraryIdentifier(rawCardId) : "",
    },
    checkouts,
    holds,
    fines,
    history,
    renewAction,
  };
}

function extractInputValue(source, idOrName) {
  const byId = firstMatch(
    source,
    new RegExp(`<input\\b[^>]*id="${idOrName}"[^>]*value="([^"]*)"`, "i"),
  );
  if (byId) return decodeHtmlEntities(byId);
  const byValueFirst = firstMatch(
    source,
    new RegExp(`<input\\b[^>]*value="([^"]*)"[^>]*id="${idOrName}"`, "i"),
  );
  if (byValueFirst) return decodeHtmlEntities(byValueFirst);
  const byName = firstMatch(
    source,
    new RegExp(`<input\\b[^>]*name="${idOrName}"[^>]*value="([^"]*)"`, "i"),
  );
  return decodeHtmlEntities(byName);
}

/**
 * Parse `OrderRoom2.aspx` WebForms inputs, prefilled contact defaults, options, and rules.
 */
export function parseCarrelForm(html = "") {
  const source = String(html || "");

  const hidden = {};
  for (const field of [
    "__VIEWSTATE",
    "__VIEWSTATEGENERATOR",
    "__EVENTVALIDATION",
    "__EVENTTARGET",
    "__EVENTARGUMENT",
  ]) {
    hidden[field] = extractInputValue(source, field);
  }

  const radioChecked =
    firstMatch(
      source,
      /<input\b[^>]*name="RBLType"[^>]*checked="checked"[^>]*value="([^"]*)"/i,
    ) ||
    firstMatch(
      source,
      /<input\b[^>]*value="([^"]*)"[^>]*checked="checked"[^>]*name="RBLType"/i,
    ) ||
    "學生";

  const parseOptions = (selectId) => {
    const body = firstMatch(
      source,
      new RegExp(`<select\\b[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)<\\/select>`, "i"),
    );
    return [...body.matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)].map(
      ([, value, label]) => ({
        value: decodeHtmlEntities(value),
        label: stripHtml(label),
      }),
    );
  };

  const todayRaw = extractInputValue(source, "tbCrt_Date");

  const ruleMatches = [
    ...source.matchAll(
      /<tr\b[^>]*>\s*<td[^>]*>\s*(\d+\.)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
    ),
  ];
  const rules = ruleMatches
    .map(([, num, body]) => `${num} ${stripHtml(body)}`)
    .filter(Boolean);

  return {
    hidden,
    formDefaults: {
      role: decodeHtmlEntities(radioChecked),
      today: todayRaw,
      name: extractInputValue(source, "tbName"),
      studentId: extractInputValue(source, "tbSID"),
      department: extractInputValue(source, "tbClassName"),
      phone: extractInputValue(source, "tbTEL"),
      email: extractInputValue(source, "tbEMail"),
      altEmail: extractInputValue(source, "tbEMail1"),
      periods: parseOptions("ddlTimePeriod"),
      rooms: parseOptions("ddlRoom"),
      rules,
    },
  };
}

/**
 * Parse `RoomCAL2.aspx` monthly calendar table into booked/available room slots per day.
 */
export function parseCarrelCalendar(html = "", fallback = {}) {
  const source = String(html || "");
  const ymMatch = source.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  const year = ymMatch
    ? Number.parseInt(ymMatch[1], 10)
    : Number(fallback.year) || new Date().getFullYear();
  const month = ymMatch
    ? Number.parseInt(ymMatch[2], 10)
    : Number(fallback.month) || new Date().getMonth() + 1;

  const hidden = {
    __VIEWSTATE: extractInputValue(source, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: extractInputValue(source, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: extractInputValue(source, "__EVENTVALIDATION"),
  };

  let prevTarget = null;
  let nextTarget = null;
  const navMatches = [
    ...source.matchAll(
      /<a\b[^>]*href="javascript:__doPostBack\('([^']+)','([^']+)'\)"[^>]*title="([^"]*)"/gi,
    ),
  ];
  for (const [, target, arg, title] of navMatches) {
    if (title.includes("上一個月")) prevTarget = { target, arg };
    else if (title.includes("下一個月")) nextTarget = { target, arg };
  }

  const days = [];
  const allRooms = ["1", "2", "3", "4", "5", "6", "7"];
  const tdMatches = [...source.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];

  for (const [, attrs, body] of tdMatches) {
    const dayTextMatch = body.match(/^\s*(?:<a\b[^>]*>)?(\d{1,2})(?:<\/a>)?/i);
    if (!dayTextMatch) continue;
    // Heuristic: RoomCAL2 day cells contain numeric room entries inside them (1..7)
    const roomTokens = [...body.matchAll(/>\s*([1-7])\s*</g)].map((m) => m[1]);
    if (!roomTokens.length && !/10F-/i.test(body)) continue;

    const day = Number.parseInt(dayTextMatch[1], 10);
    if (day < 1 || day > 31) continue;
    const isOtherMonth =
      /Color:\s*Gray|#999999|#888888|Gray|Silver/i.test(attrs) ||
      /前個月|下個月/i.test(attrs);
    if (isOtherMonth) continue;

    const availSet = new Set(roomTokens);
    // In RoomCAL2.aspx, displayed room indices reflect remaining/booked entries; also check title/color for booked slots.
    const bookedMatches = [
      ...body.matchAll(/(?:已預約|額滿)[^<]*?([1-7])/g),
    ].map((m) => m[1]);
    const availableRooms = bookedMatches.length
      ? allRooms.filter((r) => !bookedMatches.includes(r))
      : [...availSet];
    const bookedRooms = allRooms.filter((r) => !availableRooms.includes(r));

    days.push({
      day,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      availableRooms,
      bookedRooms,
    });
  }

  // Deduplicate by day keeping richest signal
  const byDay = new Map();
  for (const d of days) {
    if (!byDay.has(d.day)) byDay.set(d.day, d);
  }

  return {
    year,
    month,
    rooms: allRooms.map((r) => ({ id: r, label: `研究小間10F-${r}` })),
    days: [...byDay.values()].sort((a, b) => a.day - b.day),
    hidden,
    prevTarget,
    nextTarget,
  };
}

/**
 * Parse `CancelRoom2.aspx` active Study Carrel reservations table.
 */
export function parseCarrelReservations(html = "") {
  const source = String(html || "");
  const hidden = {
    __VIEWSTATE: extractInputValue(source, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: extractInputValue(source, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: extractInputValue(source, "__EVENTVALIDATION"),
  };

  const reservations = [];
  const rows = [...source.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const [, rowHtml] of rows) {
    if (/<th\b/i.test(rowHtml)) continue;
    const cells = [
      ...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((m) => m[1]);
    if (cells.length < 3) continue;

    const texts = cells.map((c) => stripHtml(c));
    if (!texts.some((t) => /10F-|研究小間|\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t))) {
      continue;
    }

    const postbackMatch = rowHtml.match(
      /__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/i,
    );
    const submitMatch = rowHtml.match(
      /<input\b[^>]*type="submit"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/i,
    );

    const targetId = `carrel-${reservations.length + 1}`;
    const room = texts.find((t) => /研究小間|10F-/i.test(t)) || texts[0] || "";
    const dateRange =
      texts.find((t) => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(t)) || "";
    const timePeriod =
      texts.find((t) => /整天|9時|13時|17時|上午|下午/.test(t)) || "";
    const status =
      texts.find((t) => /審核|核准|通過|取消|預約|待/.test(t)) || "";

    reservations.push({
      targetId,
      room,
      dateRange,
      timePeriod,
      status,
      canCancel: Boolean(postbackMatch || submitMatch),
      postbackTarget: postbackMatch?.[1] || submitMatch?.[1] || "",
      postbackArgument: postbackMatch?.[2] || "",
      submitValue: submitMatch?.[2] || "",
    });
  }

  return { hidden, reservations };
}
