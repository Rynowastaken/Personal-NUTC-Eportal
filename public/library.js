// NUTC Portal Library Hub: modern search-first Operate interface under /library.
// Shares public/ais.css design tokens & chrome while talking strictly to /api/library/*.
(() => {
  "use strict";

  const BASE = "/library";
  const DEMO = globalThis.__NUTC_DEMO__?.hub === "library" ? globalThis.__NUTC_DEMO__ : null;
  const ROUTES = {
    "": "home",
    catalog: "catalog",
    favorites: "favorites",
    loans: "loans",
    rooms: "rooms",
    resources: "resources",
  };
  const NAV = [
    ["home", "總覽"],
    ["catalog", "館藏"],
    ["favorites", "收藏"],
    ["loans", "借閱"],
    ["rooms", "空間"],
    ["resources", "資源"],
  ];

  const SCOPES = [
    ["ALL", "全部"],
    ["SM", "三民總館"],
    ["MS", "民生分館"],
    ["BOOK", "紙本圖書"],
    ["EBOOK", "電子書"],
    ["AV", "視聽影片"],
    ["LANG", "語言中心"],
  ];

  const SORTS = [
    ["RE", "預設排序"],
    ["PD", "出版年（新→舊）"],
    ["PA", "出版年（舊→新）"],
    ["TL", "題名"],
    ["AT", "作者"],
  ];

  const DEFAULT_CATALOG_PAGE_SIZE = 24;
  const CATALOG_PAGE_SIZES = [
    ["12", "每頁 12 筆"],
    ["24", "每頁 24 筆"],
    ["36", "每頁 36 筆"],
    ["48", "每頁 48 筆"],
  ];
  const VALID_CATALOG_PAGE_SIZES = new Set([12, 24, 36, 48]);

  function normalizeCatalogPageSize(val) {
    const parsed = Number.parseInt(String(val ?? "").trim(), 10);
    return VALID_CATALOG_PAGE_SIZES.has(parsed) ? parsed : DEFAULT_CATALOG_PAGE_SIZE;
  }

  function formatNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n.toLocaleString("en-US") : String(val ?? "");
  }

  function tagLabelFromQf(qf) {
    const parts = String(qf || "").split("\t");
    return parts[3] || parts[2] || String(qf || "");
  }

  const FIELDS = [
    ["ALL", "所有欄位"],
    ["TITLE", "題名"],
    ["AUTHOR", "著者"],
    ["SUBJECT", "主題"],
    ["JOURNAL", "期刊名"],
    ["ISBN", "ISBN"],
    ["ISSN", "ISSN"],
    ["BARCODE", "館藏條碼"],
  ];

  const DB_FILTERS = [
    { label: "全校資料庫", params: { college: "全校" } },
    { label: "中文資料庫", params: { language: "中文" } },
    { label: "西文資料庫", params: { language: "西文" } },
    { label: "日文資料庫", params: { language: "日文" } },
    { label: "論文比對", params: { q: "論文比對" } },
    { label: "資訊與流通", params: { college: "資訊與流通學院" } },
    { label: "商學院", params: { college: "商學院" } },
    { label: "設計學院", params: { college: "設計學院" } },
    { label: "語文學院", params: { college: "語文學院" } },
    { label: "中護健康", params: { college: "中護健康學院" } },
  ];

  // ---------------------------------------------------------------------------
  // Routing

  function routeUrl(subPath = "", search = "") {
    const clean = String(subPath || "").replace(/^\/+|\/+$/g, "");
    if (!DEMO) {
      return `${clean ? `${BASE}/${clean}` : BASE}${search || ""}`;
    }
    const params = new URLSearchParams(search || "");
    const next = new URLSearchParams();
    if (clean) next.set("r", clean);
    for (const [k, v] of params.entries()) {
      if (k === "r") continue;
      next.append(k, v);
    }
    const qs = next.toString();
    return `${location.pathname}${qs ? `?${qs}` : ""}`;
  }

  function matchRoute(url) {
    if (url.pathname.startsWith(`${BASE}/open/`)) return null;
    if (DEMO) {
      let rest = "";
      if (url.pathname === location.pathname) {
        const params = url.searchParams || new URL(url.href).searchParams;
        rest = (params.get("r") || "").replace(/^\/+|\/+$/g, "");
      } else if (url.pathname === BASE || url.pathname.startsWith(`${BASE}/`)) {
        rest = url.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
      } else {
        return null;
      }
      return { name: ROUTES[rest] || "home" };
    }
    if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return null;
    const rest = url.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
    return { name: ROUTES[rest] || "home" };
  }

  function hrefFor(name) {
    return routeUrl(name === "home" ? "" : name);
  }

  function navigate(href, { replace = false } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) {
      location.assign(url.href);
      return;
    }
    let nextPath = url.pathname + url.search;
    if (DEMO && (url.pathname === BASE || url.pathname.startsWith(`${BASE}/`))) {
      const rest = url.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
      nextPath = routeUrl(rest, url.search);
    }
    history[replace ? "replaceState" : "pushState"](
      null,
      "",
      nextPath,
    );
    render();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.target && link.target !== "_self") return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) return;
    event.preventDefault();
    navigate(url.href);
  });

  window.addEventListener("popstate", () => render());

  // ---------------------------------------------------------------------------
  // DOM & SVG icon helpers (uniform 1.75 stroke)

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === "class") el.className = value;
        else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
        else el.setAttribute(key, value === true ? "" : value);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      el.append(child instanceof Node ? child : String(child));
    }
    return el;
  }

  function replaceNodes(parent, ...children) {
    parent.replaceChildren(
      ...children.flat(Infinity).filter((c) => c != null && c !== false),
    );
  }

  const ICONS = {
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    credit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M15 9.5c0-1.1-1.34-2-3-2s-3 .9-3 2 1.34 2 3 2 3 .9 3 2-1.34 2-3 2-3-.9-3-2"/>',
    door: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    spark: '<path d="M12 2.5v19M3.77 7.25l16.46 9.5M20.23 7.25l-16.46 9.5"/>',
  };

  function icon(name, cls = "i") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", cls);
    svg.innerHTML = ICONS[name] || ICONS.book;
    return svg;
  }

  // ---------------------------------------------------------------------------
  // API Client + State

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.code = data.code || "";
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const CATALOG_VIEW_STORAGE_KEY = "nutc.library.catalogView";
  const CATALOG_PAGE_SIZE_STORAGE_KEY = "nutc.library.catalogPageSize";

  function loadSavedCatalogView() {
    try {
      return localStorage.getItem(CATALOG_VIEW_STORAGE_KEY) === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  }

  function saveCatalogView(mode) {
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, mode);
    } catch {}
  }

  function loadSavedCatalogPageSize() {
    try {
      return normalizeCatalogPageSize(localStorage.getItem(CATALOG_PAGE_SIZE_STORAGE_KEY));
    } catch {
      return DEFAULT_CATALOG_PAGE_SIZE;
    }
  }

  function saveCatalogPageSize(size) {
    try {
      localStorage.setItem(CATALOG_PAGE_SIZE_STORAGE_KEY, String(normalizeCatalogPageSize(size)));
    } catch {}
  }

  const state = {
    overview: null,
    overviewError: null,
    overviewLoading: false,
    privacyRevealed: false,

    favorites: [],
    favoritesLoaded: false,
    favoritesLoading: false,
    favoritesError: "",
    favoritesQuery: "",
    favoriteIds: new Set(),
    favoritePendingIds: new Set(),

    catalogQuery: "",
    catalogDraftQ: "",
    catalogField: "ALL",
    catalogScope: "ALL",
    catalogPreset: "",
    catalogSort: "RE",
    catalogView: loadSavedCatalogView(),
    catalogPageSize: loadSavedCatalogPageSize(),
    catalogTags: [],
    catalogFacetGroup: "SUBJECT",
    catalogPage: 1,
    lastCatalogSearch: null,
    catalogData: null,
    catalogLoading: false,
    catalogError: "",
    catalogAppending: false,
    catalogAppendError: "",

    loanTab: "checkouts",
    selectedRenewIds: new Set(),
    renewBusy: false,
    renewFeedback: null,

    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    calData: null,
    calLoading: false,
    calError: "",
    selectedDateKey: "",
    carrelDraft: {},
    bookingBusy: false,
    bookingFeedback: null,
    confirmCancelId: "",
    cancelBusyId: "",

    dbFilterIdx: 0,
    dbKeyword: "",
    dbDraftKeyword: "",
    dbData: null,
    dbLoading: false,
    dbError: "",
  };

  async function loadOverview({ force = false } = {}) {
    if (state.overviewLoading && !force) return;
    state.overviewLoading = true;
    state.overviewError = null;
    try {
      state.overview = await apiJson(
        `/api/library/overview${force ? "?refresh=1" : ""}`,
      );
    } catch (error) {
      state.overviewError = error;
    } finally {
      state.overviewLoading = false;
    }
  }

  function extractBookId(item) {
    if (!item) return "";
    const direct = String(item.id || "").trim();
    if (direct) return direct;
    const match = String(item.detailPath || "").match(/SD_ILS:(\d+)/i);
    return match ? match[1] : "";
  }

  function buildFavoritePayload(item, fallback = {}) {
    const id = extractBookId(item) || extractBookId(fallback);
    return {
      id,
      title: String(item?.title || fallback?.title || "").trim(),
      author: String(item?.author || fallback?.author || "").trim(),
      publisherYear: String(item?.publisherYear || fallback?.publisherYear || "").trim(),
      isbn: String(item?.isbn || fallback?.isbn || "").trim(),
      callNumber: String(
        item?.callNumber || item?.holdings?.[0]?.callNumber || fallback?.callNumber || "",
      ).trim(),
      campus: String(
        item?.campus || item?.holdings?.[0]?.branch || fallback?.campus || "",
      ).trim(),
      detailPath: String(item?.detailPath || fallback?.detailPath || "").trim(),
      officialUrl: String(item?.officialUrl || fallback?.officialUrl || "").trim(),
      coverProxyUrl: String(item?.coverProxyUrl || fallback?.coverProxyUrl || "").trim(),
    };
  }

  function syncFavoritesState(items) {
    const list = Array.isArray(items) ? items : [];
    const byId = new Map(state.favorites.map((fav) => [String(fav.id), fav]));
    state.favorites = list.map((item) => {
      const prev = byId.get(String(item.id));
      return prev && item.availableCount == null && prev.availableCount != null
        ? {
            ...item,
            availableCount: prev.availableCount,
            totalCount: prev.totalCount,
            holdsCount: prev.holdsCount,
            holdable: prev.holdable,
          }
        : item;
    });
    state.favoriteIds = new Set(state.favorites.map((item) => String(item.id)));
  }

  function syncFavoriteButtonsInDom(bookId) {
    const id = String(bookId || "").trim();
    if (!id) return;
    const isFav = state.favoriteIds.has(id);
    const busy = state.favoritePendingIds.has(id);
    for (const btn of document.querySelectorAll(".fav-btn[data-fav-book-id]")) {
      if (btn.getAttribute("data-fav-book-id") !== id) continue;
      btn.setAttribute("aria-pressed", String(isFav));
      btn.disabled = busy;
      const label = isFav ? "取消收藏" : "加入收藏";
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
      const txt = btn.querySelector("[data-fav-label]");
      if (txt) txt.textContent = isFav ? "已收藏" : "收藏";
    }
  }

  async function loadFavorites({ force = false } = {}) {
    if (state.favoritesLoading && !force) return;
    state.favoritesLoading = true;
    state.favoritesError = "";
    try {
      const res = await apiJson("/api/library/favorites");
      syncFavoritesState(res?.items);
      state.favoritesLoaded = true;
    } catch (error) {
      state.favoritesError = error?.message || "無法載入我的收藏。";
    } finally {
      state.favoritesLoading = false;
    }
  }

  async function toggleFavorite(item, fallback = {}) {
    const payload = buildFavoritePayload(item, fallback);
    if (!payload.id || !payload.title || state.favoritePendingIds.has(payload.id)) return;

    const wasFav = state.favoriteIds.has(payload.id);
    const prevFavorites = [...state.favorites];
    state.favoritePendingIds.add(payload.id);
    state.favoritesError = "";

    if (wasFav) {
      syncFavoritesState(state.favorites.filter((fav) => String(fav.id) !== payload.id));
    } else {
      syncFavoritesState([
        { ...payload, savedAt: new Date().toISOString() },
        ...state.favorites.filter((fav) => String(fav.id) !== payload.id),
      ]);
    }
    syncFavoriteButtonsInDom(payload.id);

    const route = matchRoute(new URL(location.href)) || { name: "home" };
    if (route.name === "favorites" || route.name === "home") render();

    try {
      const res = wasFav
        ? await apiJson(`/api/library/favorites/${encodeURIComponent(payload.id)}`, {
            method: "DELETE",
          })
        : await apiJson("/api/library/favorites", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      syncFavoritesState(res?.items);
      state.favoritesLoaded = true;
    } catch (error) {
      syncFavoritesState(prevFavorites);
      state.favoritesError = error?.message || "更新收藏失敗。";
    } finally {
      state.favoritePendingIds.delete(payload.id);
      syncFavoriteButtonsInDom(payload.id);
      const current = matchRoute(new URL(location.href)) || { name: "home" };
      if (current.name === "favorites" || current.name === "home") render();
    }
  }

  function renderFavoriteButton(item, { showLabel = false, className = "fav-btn", fallback = {} } = {}) {
    const id = extractBookId(item) || extractBookId(fallback);
    if (!id) return null;
    const isFav = state.favoriteIds.has(id);
    const busy = state.favoritePendingIds.has(id);
    const ariaText = isFav ? "取消收藏" : "加入收藏";
    return h(
      "button",
      {
        class: className,
        type: "button",
        disabled: busy,
        "data-fav-book-id": id,
        "aria-pressed": String(isFav),
        "aria-label": ariaText,
        title: ariaText,
        onclick: (e) => {
          e.stopPropagation();
          void toggleFavorite(item, fallback);
        },
      },
      icon("heart"),
      showLabel ? h("span", { "data-fav-label": "1" }, isFav ? "已收藏" : "收藏") : null,
    );
  }

  let catalogRequestSeq = 0;
  const CATALOG_CLIENT_TTL_MS = 5 * 60_000;
  const clientCatalogCache = new Map();
  const prefetchInFlight = new Set();
  let nextPagePrefetchTimer = null;
  let homePrefetchScheduled = false;

  function buildCatalogSearchParams({
    q = "",
    field = "ALL",
    scope = "ALL",
    preset = "",
    sort = "RE",
    tags = [],
    page = 1,
    pageSize = state.catalogPageSize,
  } = {}) {
    const qs = new URLSearchParams({
      q: String(q || "").trim(),
      field: field || "ALL",
      scope: scope || "ALL",
      preset: preset || "",
      sort: sort || "RE",
      page: String(page || 1),
      pageSize: String(normalizeCatalogPageSize(pageSize)),
    });
    const cleanTags = Array.isArray(tags) ? [...new Set(tags.filter(Boolean))] : [];
    for (const tag of cleanTags) {
      qs.append("tag", tag);
    }
    return qs;
  }

  function getClientCatalogCache(key) {
    const entry = clientCatalogCache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      clientCatalogCache.delete(key);
      return null;
    }
    return entry.value;
  }

  function setClientCatalogCache(key, value) {
    if (clientCatalogCache.has(key)) clientCatalogCache.delete(key);
    clientCatalogCache.set(key, {
      value,
      expiresAt: Date.now() + CATALOG_CLIENT_TTL_MS,
    });
    while (clientCatalogCache.size > 30) {
      const oldestKey = clientCatalogCache.keys().next().value;
      clientCatalogCache.delete(oldestKey);
    }
  }

  function prefetchCatalogQuery(params) {
    const qs = buildCatalogSearchParams(params);
    const cacheKey = qs.toString();
    if (getClientCatalogCache(cacheKey) || prefetchInFlight.has(cacheKey)) return;
    prefetchInFlight.add(cacheKey);
    void apiJson(`/api/library/catalog/search?${qs}`)
      .then((res) => {
        setClientCatalogCache(cacheKey, res);
      })
      .catch(() => {})
      .finally(() => {
        prefetchInFlight.delete(cacheKey);
      });
  }

  function scheduleNextPagePrefetch(data) {
    if (nextPagePrefetchTimer) {
      clearTimeout(nextPagePrefetchTimer);
      nextPagePrefetchTimer = null;
    }
    if (!data || !(data.page < data.totalPages)) return;
    const nextParams = {
      q: data.query || "",
      field: data.field || "ALL",
      scope: data.scope || "ALL",
      preset: data.preset || "",
      sort: data.sort || "RE",
      tags: Array.isArray(data.tags) ? data.tags : [],
      page: (data.endPage || data.page || 1) + 1,
      pageSize: data.pageSize || state.catalogPageSize,
    };
    if (nextParams.page > (Number(data.totalPages) || 1)) return;
    nextPagePrefetchTimer = setTimeout(() => {
      nextPagePrefetchTimer = null;
      prefetchCatalogQuery(nextParams);
    }, 350);
  }

  function initLoadedCatalogData(res) {
    const pageNum = Math.max(1, Number(res?.page) || 1);
    return {
      ...res,
      page: pageNum,
      startPage: pageNum,
      endPage: pageNum,
      items: Array.isArray(res?.items) ? [...res.items] : [],
    };
  }

  function catalogHasMore(data = state.catalogData) {
    if (!data || !Array.isArray(data.items) || !data.items.length) return false;
    const endPage = Math.max(1, Number(data.endPage || data.page) || 1);
    const totalPages = Math.max(1, Number(data.totalPages) || 1);
    return endPage < totalPages;
  }

  function formatCatalogPageMeta(data) {
    if (!data) return "";
    const start = Math.max(1, Number(data.startPage || data.page) || 1);
    const end = Math.max(start, Number(data.endPage || data.page) || start);
    const totalPages = Math.max(1, Number(data.totalPages) || 1);
    const rangeLabel = start === end ? formatNumber(end) : `${formatNumber(start)}–${formatNumber(end)}`;
    return `第 ${rangeLabel} / ${formatNumber(totalPages)} 頁`;
  }

  async function hydrateCatalogAvailability(target, reqId) {
    const itemsList = Array.isArray(target) ? target : target?.items;
    const shouldCheck = Array.isArray(target)
      ? itemsList.length > 0
      : Boolean(target?.availabilityPending);
    if (!shouldCheck || !Array.isArray(itemsList)) return;
    const pendingIds = [
      ...new Set(
        itemsList
          .filter((item) => item.availableCount == null && item.id)
          .map((item) => item.id),
      ),
    ];
    if (!pendingIds.length) {
      if (!Array.isArray(target) && target) target.availabilityPending = false;
      return;
    }
    try {
      const reply = await apiJson(
        `/api/library/catalog/availability?ids=${encodeURIComponent(pendingIds.join(","))}`,
      );
      if (reqId !== catalogRequestSeq) return;
      const availMap = reply?.items || {};
      const rowsById = new Map();
      for (const el of mainEl.querySelectorAll(".book-row[data-book-id], .book-card[data-book-id]")) {
        rowsById.set(el.getAttribute("data-book-id"), el);
      }
      for (const item of itemsList) {
        const hit = availMap[item.id];
        if (!hit) continue;
        item.availableCount = hit.availableCount;
        item.totalCount = hit.totalCount;
        item.holdsCount = hit.holdsCount;
        item.holdable = hit.holdable;
        const endEl = rowsById.get(String(item.id))?.querySelector(".book-end");
        if (endEl) {
          endEl.replaceChildren(...buildBookEndChildren(item));
        }
      }
      if (!Array.isArray(target) && target) target.availabilityPending = false;
    } catch {
      // Availability lookup is best-effort; keep catalog interactive.
    }
  }

  async function runCatalogSearch({
    q = state.catalogQuery,
    field = state.catalogField,
    scope = state.catalogScope,
    preset = state.catalogPreset,
    sort = state.catalogSort,
    tags = state.catalogTags,
    page = state.catalogPage,
    pageSize = state.catalogPageSize,
  } = {}) {
    const reqId = ++catalogRequestSeq;
    const cleanTags = Array.isArray(tags) ? [...new Set(tags.filter(Boolean))] : [];
    const cleanPageSize = normalizeCatalogPageSize(pageSize);
    state.catalogQuery = q;
    state.catalogDraftQ = q;
    state.catalogField = field;
    state.catalogScope = scope;
    state.catalogPreset = preset;
    state.catalogSort = sort || "RE";
    state.catalogTags = cleanTags;
    state.catalogPage = page;
    state.catalogPageSize = cleanPageSize;
    state.catalogError = "";
    state.catalogAppending = false;
    state.catalogAppendError = "";

    const qs = buildCatalogSearchParams({
      q,
      field,
      scope,
      preset,
      sort: state.catalogSort,
      tags: cleanTags,
      page,
      pageSize: cleanPageSize,
    });
    const cacheKey = qs.toString();
    const cached = getClientCatalogCache(cacheKey);
    if (cached) {
      const initialData = initLoadedCatalogData(cached);
      state.catalogData = initialData;
      state.catalogLoading = false;
      render();
      if (cached.availabilityPending) {
        void hydrateCatalogAvailability(initialData.items, reqId);
      }
      scheduleNextPagePrefetch(initialData);
      return;
    }

    state.catalogLoading = true;
    render();
    try {
      const res = await apiJson(`/api/library/catalog/search?${qs}`);
      if (reqId !== catalogRequestSeq) return;
      setClientCatalogCache(cacheKey, res);
      const initialData = initLoadedCatalogData(res);
      state.catalogData = initialData;
      state.catalogLoading = false;
      render();
      if (res.availabilityPending) {
        void hydrateCatalogAvailability(initialData.items, reqId);
      }
      scheduleNextPagePrefetch(initialData);
    } catch (error) {
      if (reqId !== catalogRequestSeq) return;
      state.catalogError = error?.message || "無法查詢館藏系統。";
    } finally {
      if (reqId === catalogRequestSeq && state.catalogLoading) {
        state.catalogLoading = false;
        render();
      }
    }
  }

  async function runDatabasesLoad({
    q = state.dbKeyword,
    filterIdx = state.dbFilterIdx,
  } = {}) {
    state.dbKeyword = q;
    state.dbDraftKeyword = q;
    state.dbFilterIdx = filterIdx;
    state.dbLoading = true;
    state.dbError = "";
    render();
    try {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        const preset = DB_FILTERS[filterIdx]?.params || { college: "全校" };
        for (const [k, v] of Object.entries(preset)) {
          params.set(k, v);
        }
      }
      state.dbData = await apiJson(`/api/library/databases?${params}`);
    } catch (error) {
      state.dbError = error?.message || "無法載入電子資料庫清單。";
    } finally {
      state.dbLoading = false;
      render();
    }
  }

  async function loadCarrelCalendar({
    year = state.calYear,
    month = state.calMonth,
    force = false,
  } = {}) {
    state.calYear = year;
    state.calMonth = month;
    state.calLoading = true;
    state.calError = "";
    render();
    try {
      const qs = new URLSearchParams({
        year: String(year),
        month: String(month),
        ...(force ? { refresh: "1" } : {}),
      });
      state.calData = await apiJson(`/api/library/rooms/carrel/availability?${qs}`);
    } catch (error) {
      state.calError = error?.message || "無法載入研究小間可預約日期。";
    } finally {
      state.calLoading = false;
      render();
    }
  }

  // ---------------------------------------------------------------------------
  // Shell: Top bar + Modal + Error card

  const menuRoot = { btn: null, panel: null };
  let activeModal = null;
  let lastFocused = null;
  let activeSelect = null;

  function closeModal() {
    if (!activeModal) return;
    activeModal.hidden = true;
    document.documentElement.classList.remove("modal-open");
    activeModal = null;
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (activeSelect) {
        e.preventDefault();
        activeSelect.close({ returnFocus: true });
        return;
      }
      if (activeModal) closeModal();
      if (menuRoot.panel && !menuRoot.panel.hidden) {
        menuRoot.panel.hidden = true;
        menuRoot.btn?.setAttribute("aria-expanded", "false");
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (
      menuRoot.panel &&
      !menuRoot.panel.hidden &&
      !menuRoot.panel.contains(e.target) &&
      !menuRoot.btn?.contains(e.target)
    ) {
      menuRoot.panel.hidden = true;
      menuRoot.btn?.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("pointerdown", (e) => {
    if (!activeSelect) return;
    if (activeSelect.wrap.contains(e.target)) return;
    const label = e.target.closest?.("label[for]");
    if (label && label.htmlFor === activeSelect.id) return;
    activeSelect.close();
  });

  const modalEl = h(
    "div",
    {
      class: "modal",
      hidden: true,
      role: "dialog",
      "aria-modal": "true",
      onclick: (e) => {
        if (e.target === modalEl) closeModal();
      },
    },
    h("div", { class: "dialog wide", id: "libDialog", tabindex: "-1" }),
  );

  /** Accessible, animated theme-glass listbox replacing native select popups. */
  function createSelect({
    id,
    options,
    value,
    ariaLabel,
    small = false,
    disabled = false,
    onChange,
  }) {
    const items = (options || []).map((entry) => {
      if (Array.isArray(entry)) {
        return { value: String(entry[0] ?? ""), label: String(entry[1] ?? entry[0] ?? "") };
      }
      if (entry && typeof entry === "object") {
        const val = String(entry.value ?? "");
        return { value: val, label: String(entry.label ?? val) };
      }
      const val = String(entry ?? "");
      return { value: val, label: val };
    });

    const desired = value == null ? "" : String(value);
    const initial = items.find((item) => item.value === desired) || items[0] || { value: "", label: "" };
    let currentValue = initial.value;

    const valueSpan = h("span", { class: "select-value" }, initial.label);
    const trigger = h(
      "button",
      {
        type: "button",
        class: "select-trigger",
        id: id || null,
        "aria-haspopup": "listbox",
        "aria-expanded": "false",
        "aria-controls": id ? `${id}-options` : null,
        "aria-label": ariaLabel || null,
        disabled: disabled || null,
        "data-value": currentValue,
      },
      valueSpan,
      h("span", { class: "select-chevron", "aria-hidden": "true" }, icon("chevron-down")),
    );

    const optionButtons = items.map((item) =>
      h(
        "button",
        {
          type: "button",
          class: "select-option",
          role: "option",
          tabindex: "-1",
          "data-value": item.value,
          "aria-selected": String(item.value === currentValue),
        },
        h("span", { class: "select-option-label" }, item.label),
        h("span", { class: "select-check", "aria-hidden": "true" }, icon("check")),
      ),
    );

    const menu = h(
      "div",
      {
        class: "select-menu",
        id: id ? `${id}-options` : null,
        role: "listbox",
        "aria-label": ariaLabel || null,
        "data-state": "closed",
        "aria-hidden": "true",
        inert: true,
      },
      optionButtons,
    );

    const wrap = h(
      "div",
      {
        class: `select-field${small ? " select-field--sm" : ""}`,
        "data-open": "false",
      },
      trigger,
      menu,
    );

    function setValue(next, { emit = true } = {}) {
      const strNext = next == null ? "" : String(next);
      const match = items.find((item) => item.value === strNext);
      if (!match) return;
      const changed = strNext !== currentValue;
      currentValue = strNext;
      trigger.dataset.value = currentValue;
      valueSpan.textContent = match.label;
      for (const btn of optionButtons) {
        btn.setAttribute("aria-selected", String(btn.dataset.value === currentValue));
      }
      if (emit && changed) {
        onChange?.(currentValue);
      }
    }

    function positionMenu() {
      delete menu.dataset.align;
      delete menu.dataset.side;
      const wrapRect = wrap.getBoundingClientRect();
      const menuWidth = Math.max(wrapRect.width, menu.offsetWidth);
      if (
        wrapRect.left + menuWidth > window.innerWidth - 12 &&
        wrapRect.right - menuWidth >= 12
      ) {
        menu.dataset.align = "end";
      }
      const neededHeight = Math.min(menu.scrollHeight, 296) + 12;
      const spaceBelow = window.innerHeight - wrapRect.bottom;
      const spaceAbove = wrapRect.top;
      if (spaceBelow < neededHeight && spaceAbove > spaceBelow) {
        menu.dataset.side = "top";
      }
    }

    const controller = {
      id,
      wrap,
      close: (opts) => setOpen(false, opts),
    };

    function setOpen(open, { focusSelected = false, returnFocus = false } = {}) {
      const visible = Boolean(open && !trigger.disabled);
      if (visible) {
        if (activeSelect && activeSelect !== controller) activeSelect.close();
        if (menuRoot.panel && !menuRoot.panel.hidden) {
          menuRoot.panel.hidden = true;
          menuRoot.btn?.setAttribute("aria-expanded", "false");
        }
        positionMenu();
        activeSelect = controller;
      } else if (activeSelect === controller) {
        activeSelect = null;
      }
      wrap.dataset.open = visible ? "true" : "false";
      menu.dataset.state = visible ? "open" : "closed";
      menu.inert = !visible;
      menu.setAttribute("aria-hidden", String(!visible));
      trigger.setAttribute("aria-expanded", String(visible));
      if (visible && focusSelected) {
        const selectedBtn =
          optionButtons.find((btn) => btn.dataset.value === currentValue) || optionButtons[0];
        selectedBtn?.focus({ preventScroll: true });
        selectedBtn?.scrollIntoView?.({ block: "nearest" });
      } else if (!visible && returnFocus) {
        trigger.focus({ preventScroll: true });
      }
    }

    function moveFocus(key, startIdx) {
      if (!optionButtons.length) return;
      let idx = startIdx;
      if (key === "Home") idx = 0;
      else if (key === "End") idx = optionButtons.length - 1;
      else if (key === "ArrowDown") idx = (startIdx + 1) % optionButtons.length;
      else if (key === "ArrowUp") idx = (startIdx - 1 + optionButtons.length) % optionButtons.length;
      setOpen(true);
      const target = optionButtons[idx];
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: "nearest" });
    }

    trigger.addEventListener("click", () => {
      const wasOpen = trigger.getAttribute("aria-expanded") === "true";
      setOpen(!wasOpen, { focusSelected: !wasOpen });
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && trigger.getAttribute("aria-expanded") === "true") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false, { returnFocus: true });
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const selectedIdx = Math.max(
        0,
        optionButtons.findIndex((btn) => btn.dataset.value === currentValue),
      );
      moveFocus(e.key, selectedIdx);
    });

    optionButtons.forEach((btn, idx) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setValue(btn.dataset.value);
        setOpen(false, { returnFocus: true });
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false, { returnFocus: true });
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          moveFocus(e.key, idx);
        } else if (e.key === "Tab") {
          setOpen(false);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setValue(btn.dataset.value);
          setOpen(false, { returnFocus: true });
        }
      });
    });

    Object.defineProperty(wrap, "value", {
      get() {
        return currentValue;
      },
      set(next) {
        setValue(next, { emit: false });
      },
    });

    return wrap;
  }

  function renderBookModalHero(book, fallbackCoverUrl, onPickSubject, favFallback = {}) {
    const coverUrl = book.coverProxyUrl || fallbackCoverUrl || "";
    const coverBox = h(
      "div",
      { class: `book-modal-cover${coverUrl ? "" : " is-empty"}` },
      coverUrl
        ? h("img", {
            src: coverUrl,
            alt: "",
            decoding: "async",
            onerror: (e) => {
              const box = e.currentTarget.parentElement;
              e.currentTarget.remove();
              if (box) {
                box.classList.add("is-empty");
                box.append(icon("book"));
              }
            },
          })
        : icon("book"),
    );

    const contributorsText = Array.isArray(book.contributors)
      ? book.contributors.filter(Boolean).join("、")
      : "";
    const specPairs = [
      ["譯者／合著", contributorsText, false],
      ["出版", book.publisherYear, false],
      ["版本", book.edition, false],
      ["規格", book.physicalDesc, false],
      ["叢書", book.series, false],
      ["語言", book.language, false],
      ["ISBN", book.isbn, true],
    ].filter(([, val]) => Boolean(val));

    const subjects = Array.isArray(book.subjects) ? book.subjects.filter(Boolean) : [];
    const favBtn = renderFavoriteButton(book, {
      showLabel: true,
      className: "fav-btn fav-btn--modal",
      fallback: favFallback,
    });

    return h(
      "div",
      { class: "book-modal-hero" },
      coverBox,
      h(
        "div",
        { class: "book-modal-info" },
        h(
          "div",
          { class: "book-modal-title-row" },
          h("h2", { class: "dialog-title" }, book.title),
          h(
            "div",
            { class: "book-modal-head-actions" },
            favBtn,
            h(
              "button",
              {
                class: "dialog-close",
                type: "button",
                "aria-label": "關閉",
                onclick: closeModal,
              },
              icon("x"),
            ),
          ),
        ),
        book.author ? h("div", { class: "book-modal-author" }, book.author) : null,
        specPairs.length
          ? h(
              "dl",
              { class: "book-modal-specs" },
              specPairs.flatMap(([label, val, isNum]) => [
                h("dt", null, label),
                h("dd", isNum ? { class: "num" } : null, val),
              ]),
            )
          : null,
        subjects.length
          ? h(
              "div",
              { class: "book-modal-subjects" },
              subjects.slice(0, 6).map((subj) =>
                h(
                  "button",
                  {
                    class: "chip-btn chip-btn--tag",
                    type: "button",
                    onclick: () => onPickSubject(subj),
                  },
                  subj,
                ),
              ),
            )
          : null,
      ),
    );
  }

  function buildBookSynopsisSection(summary, summarySource) {
    if (!summary) return null;
    const paragraphs = String(summary)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!paragraphs.length) return null;

    const isLong = summary.length > 320 || paragraphs.length > 3;
    const box = h(
      "div",
      { class: `book-modal-synopsis${isLong ? " is-clamped" : ""}` },
      paragraphs.map((p) => h("p", null, p)),
    );
    const toggleBtn = isLong
      ? h(
          "button",
          {
            class: "btn ghost small book-modal-more",
            type: "button",
            onclick: () => {
              const clamped = box.classList.toggle("is-clamped");
              toggleBtn.textContent = clamped ? "展開完整簡介" : "收合";
            },
          },
          "展開完整簡介",
        )
      : null;

    return h(
      "section",
      { class: "book-modal-section" },
      h(
        "div",
        { class: "book-modal-section-head" },
        h("h3", null, "內容簡介"),
        summarySource
          ? h("span", { class: "book-modal-source" }, summarySource)
          : null,
      ),
      box,
      toggleBtn,
    );
  }

  function holdingStatusTone(status, availability) {
    const s = String(status || "").trim();
    if (!s) return "muted";
    if (/到期|借出|外借|遺失|毀損|修補|裝訂|註銷|缺書|賠書|不可外借/.test(s)) {
      return "urgent";
    }
    if (/預約|保留|調撥|運送|移送|處理中|編目|驗收/.test(s)) {
      return "soon";
    }
    if (
      /在架|可借|可線上|在館|書區|書庫|書展|資料區|資料室|參考|期刊|視聽|特藏|新書|指定|\d+\s*[FB樓]|[區庫室廳]$/.test(
        s,
      ) ||
      (availability &&
        availability.totalCount > 0 &&
        availability.availableCount >= availability.totalCount)
    ) {
      return "done";
    }
    return "muted";
  }

  function buildBookHoldingsSection(holdings, availability) {
    const hasAvail = availability && availability.totalCount != null;
    const availPill = hasAvail
      ? h(
          "span",
          {
            class: `chip num ${availability.availableCount > 0 ? "done" : "urgent"}`,
          },
          availability.availableCount > 0
            ? `可借 ${availability.availableCount} / ${availability.totalCount}`
            : `已全數借出 (0 / ${availability.totalCount})`,
        )
      : null;
    const holdsPill =
      availability && availability.holdsCount > 0
        ? h("span", { class: "meta num" }, `預約 ${availability.holdsCount}`)
        : null;

    return h(
      "section",
      { class: "book-modal-section" },
      h(
        "div",
        { class: "book-modal-section-head" },
        h("h3", null, `館藏複本 (${holdings.length})`),
        availPill || holdsPill
          ? h("div", { class: "book-modal-section-meta" }, availPill, holdsPill)
          : null,
      ),
      holdings.length
        ? h(
            "div",
            { class: "holdings-list" },
            holdings.map((copy) => {
              const cleanStatus =
                copy.status && copy.status !== "未知" ? copy.status : "";
              const metaNodes = [];
              if (copy.callNumber) {
                metaNodes.push(h("span", { class: "book-call" }, copy.callNumber));
              }
              const tailText = [
                copy.itemType || "",
                copy.barcode ? `條碼 ${copy.barcode}` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              if (tailText) {
                metaNodes.push(h("span", { class: "num" }, tailText));
              }

              return h(
                "div",
                { class: "holding-row" },
                h(
                  "div",
                  null,
                  h("div", { class: "holding-loc" }, copy.branch || "館內"),
                  metaNodes.length
                    ? h("div", { class: "holding-sub" }, metaNodes)
                    : null,
                ),
                cleanStatus
                  ? h(
                      "span",
                      {
                        class: `chip ${holdingStatusTone(cleanStatus, availability)}`,
                      },
                      cleanStatus,
                    )
                  : null,
              );
            }),
          )
        : h("div", { class: "empty" }, "目前無可顯示的館藏複本明細。"),
    );
  }

  function openBookModal(item) {
    lastFocused = document.activeElement;
    const dialog = modalEl.querySelector("#libDialog");

    const onPickSubject = (subject) => {
      closeModal();
      state.catalogTags = [];
      state.catalogSort = "RE";
      state.catalogPreset = "";
      state.catalogScope = "ALL";
      state.lastCatalogSearch = null;
      const qs = new URLSearchParams({
        q: subject,
        field: "SUBJECT",
        scope: "ALL",
        page: "1",
      });
      navigate(`${BASE}/catalog?${qs}`);
    };

    replaceNodes(
      dialog,
      renderBookModalHero(item, item.coverProxyUrl, onPickSubject, item),
      h(
        "div",
        { class: "dialog-body" },
        h("div", { class: "loading", style: "margin:4px 0 14px" }),
        h("div", { class: "skel" }),
        h("div", { class: "skel short" }),
      ),
    );
    modalEl.hidden = false;
    document.documentElement.classList.add("modal-open");
    activeModal = modalEl;
    dialog.focus({ preventScroll: true });

    apiJson(
      `/api/library/catalog/item?path=${encodeURIComponent(item.detailPath)}`,
    )
      .then((detail) => {
        if (modalEl.hidden) return;
        const heroEl = dialog.querySelector(".book-modal-hero");
        if (heroEl) {
          heroEl.replaceWith(
            renderBookModalHero(detail, item.coverProxyUrl, onPickSubject, item),
          );
        }
        const body = dialog.querySelector(".dialog-body");
        if (!body) return;
        const holdings = Array.isArray(detail.holdings) ? detail.holdings : [];
        const notes = Array.isArray(detail.notes) ? detail.notes.filter(Boolean) : [];
        const bioParagraphs = String(detail.authorBio || "")
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);

        replaceNodes(
          body,
          buildBookSynopsisSection(detail.summary, detail.summarySource),
          bioParagraphs.length
            ? h(
                "details",
                { class: "rules-box book-modal-bio" },
                h("summary", null, "作者簡介"),
                h(
                  "div",
                  { class: "rules-body" },
                  bioParagraphs.map((p) => h("p", null, p)),
                ),
              )
            : null,
          notes.length
            ? h(
                "section",
                { class: "book-modal-section" },
                h("div", { class: "book-modal-section-head" }, h("h3", null, "書目附註")),
                h(
                  "ul",
                  { class: "book-modal-notes" },
                  notes.map((n) => h("li", null, n)),
                ),
              )
            : null,
          buildBookHoldingsSection(holdings, detail.availability),
          h(
            "div",
            { class: "actions" },
            detail.electronicUrl
              ? h(
                  "a",
                  {
                    class: "btn primary",
                    href: detail.electronicUrl,
                    target: "_blank",
                    rel: "noopener",
                  },
                  icon("external"),
                  "開啟電子資源",
                )
              : null,
            h(
              "a",
              {
                class: `btn${detail.electronicUrl ? "" : " primary"}`,
                href: detail.officialUrl || item.officialUrl,
                target: "_blank",
                rel: "noopener",
              },
              icon("external"),
              "在館藏系統開啟",
            ),
            h(
              "button",
              { class: "btn", type: "button", onclick: closeModal },
              "關閉",
            ),
          ),
        );
      })
      .catch((err) => {
        const body = dialog.querySelector(".dialog-body");
        if (!body) return;
        body.replaceChildren(
          h(
            "div",
            { class: "notice danger" },
            icon("alert"),
            h("span", null, err?.message || "無法取得館藏詳細資料。"),
          ),
          h(
            "div",
            { class: "actions" },
            h(
              "a",
              {
                class: "btn",
                href: item.officialUrl,
                target: "_blank",
                rel: "noopener",
              },
              icon("external"),
              "在館藏系統開啟",
            ),
            h(
              "button",
              { class: "btn", type: "button", onclick: closeModal },
              "關閉",
            ),
          ),
        );
      });
  }

  function renderHeader(currentRoute) {
    const menuBtn = h(
      "button",
      {
        class: "user-btn",
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        "aria-label": "圖書館選單",
        onclick: () => {
          const open = menuPanel.hidden;
          menuPanel.hidden = !open;
          menuBtn.setAttribute("aria-expanded", String(open));
        },
      },
      h("span", { class: "avatar" }, icon("user")),
    );

    const menuPanel = h(
      "div",
      { class: "menu", role: "menu", hidden: true },
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          onclick: async () => {
            menuPanel.hidden = true;
            menuBtn.setAttribute("aria-expanded", "false");
            await loadOverview({ force: true });
            render();
          },
        },
        icon("refresh"),
        "重新整理資料",
      ),
      h(
        "a",
        {
          href: "/go/library",
          target: "_blank",
          rel: "noopener",
          role: "menuitem",
        },
        icon("external"),
        "在官方圖書館開啟",
      ),
      h("div", { class: "menu-sep" }),
      h(
        "a",
        { href: DEMO ? DEMO.homeHref : "/", role: "menuitem" },
        icon("home"),
        "返回 Portal 首頁",
      ),
    );

    menuRoot.btn = menuBtn;
    menuRoot.panel = menuPanel;

    return h(
      "header",
      { class: "bar" },
      h(
        "div",
        { class: "bar-in" },
        h(
          "a",
          { class: "brand", href: hrefFor("home") },
          h("span", { class: "brand-mark", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")),
          h("span", { class: "brand-text" }, "圖書館"),
        ),
        h(
          "nav",
          { class: "nav", "aria-label": "圖書館導覽" },
          NAV.map(([key, label]) =>
            h(
              "a",
              {
                href: hrefFor(key),
                "aria-current": currentRoute === key ? "page" : false,
              },
              label,
            ),
          ),
        ),
        h("div", { class: "bar-end" }, menuBtn, menuPanel),
      ),
    );
  }

  function renderAuthOrFatalError(error) {
    const loginRequired =
      error?.status === 401 || error?.code === "EPORTAL_LOGIN_REQUIRED";
    return h(
      "div",
      { class: "error" },
      icon(loginRequired ? "lock" : "alert"),
      h("h1", null, loginRequired ? "需要登入 Server ePortal" : "圖書館資料暫時無法讀取"),
      h(
        "p",
        null,
        loginRequired
          ? "Server ePortal 的登入工作階段已逾期，請重新登入後再回到圖書館。"
          : error?.message || "連線圖書館系統時發生錯誤。",
      ),
      h(
        "div",
        { class: "actions" },
        loginRequired
          ? h(
              "a",
              {
                class: "btn primary",
                href: "/server-login/?force=1&next=%2Flibrary",
              },
              "登入 Server ePortal",
            )
          : h(
              "button",
              {
                class: "btn primary",
                type: "button",
                onclick: async () => {
                  await loadOverview({ force: true });
                  render();
                },
              },
              icon("refresh"),
              "重試",
            ),
        h(
          "a",
          { class: "btn", href: "/go/library", target: "_blank", rel: "noopener" },
          icon("external"),
          "在官方圖書館開啟",
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Book Row helper

  function buildBookEndChildren(item) {
    const availBadge =
      item.availableCount == null
        ? null
        : h(
            "span",
            {
              class: `chip num ${
                item.availableCount > 0 ? "done" : "urgent"
              }`,
            },
            `可借 ${item.availableCount} / ${item.totalCount ?? item.availableCount}`,
          );
    return [
      availBadge,
      item.holdsCount > 0
        ? h("span", { class: "meta num" }, `預約 ${item.holdsCount}`)
        : null,
    ].filter(Boolean);
  }

  function buildCatalogCoverNode(item, index = 0, { fallbackClass = "" } = {}) {
    if (!item.coverProxyUrl) {
      return fallbackClass
        ? h("div", { class: fallbackClass, "aria-hidden": "true" }, icon("book"))
        : icon("book");
    }
    return h("img", {
      src: item.coverProxyUrl,
      alt: "",
      decoding: "async",
      fetchpriority: index === 0 ? "high" : null,
      loading: index >= 6 ? "lazy" : null,
      onerror: (e) => {
        const img = e.currentTarget;
        if (fallbackClass) {
          img.replaceWith(h("div", { class: fallbackClass, "aria-hidden": "true" }, icon("book")));
          return;
        }
        const box = img.parentElement;
        img.remove();
        if (box) box.append(icon("book"));
      },
    });
  }

  function renderBookRow(item, index = 0) {
    const coverImg = buildCatalogCoverNode(item, index);

    return h(
      "article",
      {
        class: "book-row",
        "data-book-id": item.id,
      },
      h("div", { class: "book-cover" }, coverImg),
      h(
        "div",
        { class: "book-meta" },
        h(
          "div",
          { class: "book-title" },
          h(
            "button",
            {
              type: "button",
              class: "book-row-action",
              onclick: () => openBookModal(item),
            },
            item.title,
          ),
        ),
        (item.author || item.publisherYear)
          ? h(
              "div",
              { class: "book-author" },
              [item.author, item.publisherYear].filter(Boolean).join(" · "),
            )
          : null,
        h(
          "div",
          { class: "book-tags" },
          item.callNumber ? h("span", { class: "book-call" }, item.callNumber) : null,
          item.campus ? h("span", null, item.campus) : null,
          item.isbn ? h("span", { class: "num" }, `ISBN ${item.isbn}`) : null,
        ),
      ),
      h(
        "div",
        { class: "book-row-side" },
        h("div", { class: "book-end" }, buildBookEndChildren(item)),
        renderFavoriteButton(item),
      ),
    );
  }

  function renderBookCard(item, index = 0) {
    const subline = [item.author, item.publisherYear].filter(Boolean).join(" · ") || item.campus || "";
    const endChildren = buildBookEndChildren(item);
    return h(
      "article",
      {
        class: "book-card",
        "data-book-id": item.id,
      },
      buildCatalogCoverNode(item, index, { fallbackClass: "media book-card-empty" }),
      renderFavoriteButton(item, { className: "fav-btn fav-btn--card" }),
      h(
        "h3",
        { class: "book-card-title" },
        h(
          "button",
          {
            type: "button",
            class: "book-card-action",
            onclick: () => openBookModal(item),
          },
          item.title,
        ),
      ),
      subline ? h("p", { class: "book-card-author" }, subline) : null,
      h(
        "footer",
        { class: "book-card-foot" },
        h("div", { class: "book-end" }, endChildren),
        item.callNumber ? h("span", { class: "book-call" }, item.callNumber) : null,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // View: Overview (/library)

  function renderHomeView() {
    if (state.overviewError && !state.overview) {
      return renderAuthOrFatalError(state.overviewError);
    }

    const data = state.overview;
    const summary = data?.summary || {
      checkoutsCount: "—",
      holdsCount: "—",
      finesTotal: "—",
      activeCarrelsCount: "—",
    };
    const checkouts = data?.account?.checkouts || [];
    const holds = data?.account?.holds || [];
    const carrels = data?.carrels?.reservations || [];

    const quickInput = h("input", {
      id: "homeCatalogInput",
      class: "input",
      type: "search",
      placeholder: "搜尋書名、作者、ISBN 或關鍵字…",
      value: state.catalogDraftQ,
      oninput: (e) => {
        state.catalogDraftQ = e.target.value;
      },
      "aria-label": "搜尋館藏",
    });

    const quickSelect = createSelect({
      id: "homeCatalogScope",
      options: SCOPES,
      value: state.catalogScope,
      ariaLabel: "館藏範圍",
      onChange: (val) => {
        state.catalogScope = val;
      },
    });

    const quickForm = h(
      "form",
      {
        class: "search-panel",
        onsubmit: (e) => {
          e.preventDefault();
          const q = quickInput.value.trim();
          const sc = quickSelect.value;
          state.catalogTags = [];
          state.catalogSort = "RE";
          state.lastCatalogSearch = null;
          state.catalogData = null;
          const qs = new URLSearchParams({
            ...(q ? { q } : {}),
            scope: sc,
          });
          navigate(`${BASE}/catalog?${qs}`);
        },
      },
      h(
        "div",
        { class: "search-bar search-bar--wide" },
        quickInput,
        quickSelect,
        h(
          "button",
          { class: "btn primary", type: "submit" },
          icon("search"),
          "搜尋館藏",
        ),
      ),
      h(
        "div",
        { class: "chips" },
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            onclick: () => {
              state.catalogTags = [];
              state.catalogSort = "RE";
              state.lastCatalogSearch = null;
              state.catalogData = null;
              navigate(`${BASE}/catalog?preset=SMNEW`);
            },
          },
          "三民總館新進館藏",
        ),
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            onclick: () => {
              state.catalogTags = [];
              state.catalogSort = "RE";
              state.lastCatalogSearch = null;
              state.catalogData = null;
              navigate(`${BASE}/catalog?preset=MSNEW`);
            },
          },
          "民生分館新進館藏",
        ),
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            onclick: () => navigate(`${BASE}/rooms`),
          },
          "預約研究小間",
        ),
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            onclick: () => navigate(`${BASE}/resources`),
          },
          "電子資料庫 & EndNote",
        ),
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            onclick: () => navigate(routeUrl("favorites")),
          },
          state.favorites.length ? `我的收藏 (${state.favorites.length})` : "我的收藏",
        ),
      ),
    );

    const kpiGrid = h(
      "div",
      { class: "stat-grid" },
      h(
        "a",
        { class: "stat", href: routeUrl("loans", "?tab=checkouts") },
        h("div", { class: "stat-top" }, h("span", null, "借閱中"), icon("book")),
        h("div", { class: "stat-value" }, String(summary.checkoutsCount)),
        h(
          "div",
          { class: "stat-sub" },
          checkouts[0] ? `最近到期 ${checkouts[0].dueDate || "—"}` : "目前無外借",
        ),
      ),
      h(
        "a",
        { class: "stat", href: routeUrl("loans", "?tab=holds") },
        h("div", { class: "stat-top" }, h("span", null, "預約中"), icon("bookmark")),
        h("div", { class: "stat-value" }, String(summary.holdsCount)),
        h(
          "div",
          { class: "stat-sub" },
          holds[0] ? holds[0].status || holds[0].title : "目前無預約",
        ),
      ),
      h(
        "a",
        { class: "stat", href: routeUrl("loans", "?tab=fines") },
        h("div", { class: "stat-top" }, h("span", null, "應付罰款"), icon("credit")),
        h("div", { class: "stat-value" }, String(summary.finesTotal)),
        h("div", { class: "stat-sub" }, data?.status ? `帳戶狀態：${data.status}` : "館藏帳戶"),
      ),
      h(
        "a",
        { class: "stat", href: routeUrl("rooms") },
        h("div", { class: "stat-top" }, h("span", null, "研究小間"), icon("door")),
        h("div", { class: "stat-value" }, String(summary.activeCarrelsCount)),
        h(
          "div",
          { class: "stat-sub" },
          carrels[0] ? `${carrels[0].room} · ${carrels[0].dateRange}` : "目前無有效預約",
        ),
      ),
    );

    const loansSection = h(
      "section",
      { class: "section" },
      h(
        "div",
        { class: "section-head" },
        h("h2", null, "目前借閱"),
        h("a", { class: "meta", href: routeUrl("loans") }, "查看全部"),
      ),
      data?.sectionErrors?.opac
        ? h(
            "div",
            { class: "notice danger" },
            icon("alert"),
            h("span", null, data.sectionErrors.opac),
          )
        : h(
            "div",
            { class: "list" },
            checkouts.length
              ? checkouts.slice(0, 4).map((loan) =>
                  h(
                    "a",
                    { class: "row", href: routeUrl("loans") },
                    h("div", { class: "row-icon accent" }, icon("book")),
                    h(
                      "div",
                      { style: "min-width:0" },
                      h("div", { class: "row-title" }, loan.title),
                      h("div", { class: "row-sub num" }, [loan.callNumber, loan.renewals].filter(Boolean).join(" · ")),
                    ),
                    h(
                      "div",
                      { class: "row-end" },
                      h("span", { class: "chip accent num" }, loan.dueDate || "借閱中"),
                    ),
                  ),
                )
              : h(
                  "div",
                  { class: "empty" },
                  icon("book"),
                  h("strong", null, "目前無外借圖書"),
                ),
          ),
    );

    const roomsSection = h(
      "section",
      { class: "section" },
      h(
        "div",
        { class: "section-head" },
        h("h2", null, "研究小間預約"),
        h("a", { class: "meta", href: routeUrl("rooms") }, "預約或查詢"),
      ),
      data?.sectionErrors?.carrels
        ? h(
            "div",
            { class: "notice danger" },
            icon("alert"),
            h("span", null, data.sectionErrors.carrels),
          )
        : h(
            "div",
            { class: "list" },
            carrels.length
              ? carrels.slice(0, 4).map((res) =>
                  h(
                    "a",
                    { class: "row", href: routeUrl("rooms") },
                    h("div", { class: "row-icon done" }, icon("door")),
                    h(
                      "div",
                      { style: "min-width:0" },
                      h("div", { class: "row-title" }, res.room),
                      h("div", { class: "row-sub num" }, [res.dateRange, res.timePeriod].filter(Boolean).join(" · ")),
                    ),
                    h("div", { class: "row-end" }, res.status ? h("span", { class: "chip done" }, res.status) : null),
                  ),
                )
              : h(
                  "div",
                  { class: "empty" },
                  icon("door"),
                  h("strong", null, "目前無研究小間預約"),
                ),
          ),
    );

    const quickRow = h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", null, "常用服務")),
      h(
        "div",
        { class: "service-grid" },
        [
          ["opac", "官方館藏查詢", "SirsiDynix Enterprise", "book"],
          ["ejournals", "電子期刊資源", "期刊文獻檢索", "database"],
          ["summon", "電子資源探索", "Summon 整合檢索", "compass"],
        ].map(([key, title, sub, ic]) =>
          h(
            "a",
            {
              class: "service",
              href: `${BASE}/open/${key}`,
              target: "_blank",
              rel: "noopener",
            },
            h("div", { class: "service-icon" }, icon(ic)),
            h("div", { class: "service-title" }, title),
            h("div", { class: "service-foot" }, icon("external"), sub),
          ),
        ),
      ),
    );

    const favoritesSection = state.favorites.length
      ? h(
          "section",
          { class: "section" },
          h(
            "div",
            { class: "section-head" },
            h(
              "h2",
              null,
              "我的收藏",
              h("span", { class: "count" }, `(${state.favorites.length})`),
            ),
            h("a", { class: "meta", href: routeUrl("favorites") }, "查看全部"),
          ),
          h(
            "div",
            { class: "list" },
            state.favorites.slice(0, 4).map((fav, idx) => renderBookRow(fav, idx)),
          ),
        )
      : null;

    return h(
      "div",
      null,
      state.overviewLoading ? h("div", { class: "loading" }) : null,
      h(
        "div",
        { class: "hero" },
        h("h1", null, "圖書館 ", icon("spark", "claude-spark")),
        h(
          "div",
          { class: "hero-side" },
          h(
            "div",
            { class: "hero-status" },
            data?.fetchedAt
              ? `更新於 ${new Date(data.fetchedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
              : "",
          ),
        ),
      ),
      kpiGrid,
      quickForm,
      h("div", { class: "home-grid" }, loansSection, roomsSection),
      favoritesSection,
      quickRow,
    );
  }

  // ---------------------------------------------------------------------------
  // View: Favorites (/library/favorites)

  function renderFavoritesView() {
    const query = state.favoritesQuery.trim().toLowerCase();
    const allItems = state.favorites;
    const filtered = query
      ? allItems.filter((item) =>
          [item.title, item.author, item.publisherYear, item.isbn, item.callNumber, item.campus]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : allItems;

    const filterInput = h("input", {
      id: "favoritesFilterInput",
      class: "input",
      type: "search",
      placeholder: "搜尋已收藏書名、作者、ISBN 或索書號…",
      value: state.favoritesQuery,
      oninput: (e) => {
        state.favoritesQuery = e.target.value;
        render();
      },
      "aria-label": "篩選收藏書籍",
    });

    const setView = (nextView) => {
      if (state.catalogView === nextView) return;
      state.catalogView = nextView;
      saveCatalogView(nextView);
      render();
    };

    const viewToggle = h(
      "div",
      { id: "favoritesViewToggle", class: "seg view-seg", role: "group", "aria-label": "顯示模式" },
      h(
        "button",
        {
          type: "button",
          "data-view": "list",
          "aria-pressed": String(state.catalogView === "list"),
          onclick: () => setView("list"),
        },
        icon("list"),
        "列表",
      ),
      h(
        "button",
        {
          type: "button",
          "data-view": "grid",
          "aria-pressed": String(state.catalogView === "grid"),
          onclick: () => setView("grid"),
        },
        icon("grid"),
        "圖示",
      ),
    );

    let bodyNode;
    if (state.favoritesError) {
      bodyNode = h(
        "div",
        { class: "notice danger", style: "margin-top:16px;align-items:center" },
        icon("alert"),
        h("span", { style: "flex:1" }, state.favoritesError),
        h(
          "button",
          {
            class: "btn small",
            type: "button",
            onclick: () => void loadFavorites({ force: true }).then(() => render()),
          },
          icon("refresh"),
          "重試",
        ),
      );
    } else if (!state.favoritesLoaded && state.favoritesLoading) {
      bodyNode = h(
        "section",
        { class: "section" },
        h("div", { class: "list" }, h("div", { class: "empty" }, icon("heart"), h("strong", null, "載入收藏中…"))),
      );
    } else {
      bodyNode = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "section-head" },
          h(
            "h2",
            null,
            "收藏書單",
            h("span", { class: "count" }, `(${filtered.length})`),
          ),
          h("div", { class: "section-controls" }, viewToggle),
        ),
        filtered.length
          ? state.catalogView === "grid"
            ? h(
                "div",
                { class: "book-grid" },
                filtered.map((item, idx) => renderBookCard(item, idx)),
              )
            : h(
                "div",
                { class: "list" },
                filtered.map((item, idx) => renderBookRow(item, idx)),
              )
          : h(
              "div",
              { class: "list" },
              h(
                "div",
                { class: "empty" },
                icon("heart"),
                h("strong", null, allItems.length ? "找不到符合篩選的收藏" : "尚無收藏書籍"),
                h(
                  "div",
                  { class: "actions", style: "justify-content:center" },
                  allItems.length
                    ? h(
                        "button",
                        {
                          class: "btn small",
                          type: "button",
                          onclick: () => {
                            state.favoritesQuery = "";
                            render();
                          },
                        },
                        "清除篩選",
                      )
                    : h(
                        "a",
                        { class: "btn small primary", href: routeUrl("catalog") },
                        icon("search"),
                        "前往館藏查詢",
                      ),
                ),
              ),
            ),
      );
    }

    return h(
      "div",
      null,
      h("div", { class: "hero" }, h("h1", null, "我的收藏")),
      allItems.length
        ? h(
            "form",
            {
              class: "search-panel",
              onsubmit: (e) => e.preventDefault(),
            },
            h(
              "div",
              { class: "search-bar" },
              filterInput,
              state.favoritesQuery
                ? h(
                    "button",
                    {
                      class: "btn",
                      type: "button",
                      onclick: () => {
                        state.favoritesQuery = "";
                        render();
                      },
                    },
                    "清除",
                  )
                : null,
            ),
          )
        : null,
      bodyNode,
    );
  }

  // ---------------------------------------------------------------------------
  // View: Catalog Search (/library/catalog)

  function syncCatalogUrlParams() {
    if (location.search === state.lastCatalogSearch) return;
    state.lastCatalogSearch = location.search;
    const sp = new URLSearchParams(location.search);
    const hasParams =
      sp.has("q") ||
      sp.has("preset") ||
      sp.has("scope") ||
      sp.has("field") ||
      sp.has("sort") ||
      sp.has("tag") ||
      sp.has("page") ||
      sp.has("pageSize");
    if (!hasParams) return;
    const q = sp.get("q") || "";
    const scope = sp.get("scope") || "ALL";
    const field = sp.get("field") || "ALL";
    const preset = sp.get("preset") || "";
    const sort = sp.get("sort") || "RE";
    const tags = sp.getAll("tag").filter(Boolean);
    const page = Number(sp.get("page")) || 1;
    const pageSize = sp.has("pageSize")
      ? normalizeCatalogPageSize(sp.get("pageSize"))
      : state.catalogPageSize;
    const changed =
      !state.catalogData ||
      q !== state.catalogQuery ||
      scope !== state.catalogScope ||
      field !== state.catalogField ||
      preset !== state.catalogPreset ||
      sort !== state.catalogSort ||
      tags.join("||") !== state.catalogTags.join("||") ||
      page !== state.catalogPage ||
      pageSize !== state.catalogPageSize;
    if (changed && !state.catalogLoading) {
      void runCatalogSearch({ q, field, scope, preset, sort, tags, page, pageSize });
    }
  }

  function renderCatalogView() {
    const inputEl = h("input", {
      id: "catalogQueryInput",
      class: "input",
      type: "search",
      placeholder: "輸入書名、作者、ISBN 或主題…",
      value: state.catalogDraftQ,
      oninput: (e) => {
        state.catalogDraftQ = e.target.value;
      },
      "aria-label": "館藏關鍵字",
    });

    const fieldEl = createSelect({
      id: "catalogFieldSelect",
      options: FIELDS,
      value: state.catalogField,
      ariaLabel: "搜尋欄位",
      onChange: (val) => {
        state.catalogField = val;
      },
    });

    const submitSearch = (nextPage = 1, nextPreset = "") => {
      const q = inputEl.value.trim();
      const qs = new URLSearchParams({
        ...(q ? { q } : {}),
        field: fieldEl.value,
        scope: state.catalogScope,
        ...(nextPreset ? { preset: nextPreset } : {}),
        ...(state.catalogSort && state.catalogSort !== "RE"
          ? { sort: state.catalogSort }
          : {}),
        ...(state.catalogPageSize !== DEFAULT_CATALOG_PAGE_SIZE
          ? { pageSize: String(state.catalogPageSize) }
          : {}),
        page: String(nextPage),
      });
      for (const tag of state.catalogTags) {
        qs.append("tag", tag);
      }
      const nextSearch = `?${qs}`;
      const targetUrl = routeUrl("catalog", nextSearch);
      state.lastCatalogSearch = new URL(targetUrl, location.origin).search;
      history.replaceState(null, "", targetUrl);
      void runCatalogSearch({
        q,
        field: fieldEl.value,
        scope: state.catalogScope,
        preset: nextPreset,
        sort: state.catalogSort,
        tags: state.catalogTags,
        page: nextPage,
        pageSize: state.catalogPageSize,
      });
    };

    const toggleTag = (qf) => {
      const next = new Set(state.catalogTags);
      if (next.has(qf)) {
        next.delete(qf);
      } else if (next.size < 6) {
        next.add(qf);
      }
      state.catalogTags = [...next];
      submitSearch(1, state.catalogPreset);
    };

    const data = state.catalogData;
    const facets = Array.isArray(data?.facets) ? data.facets : [];
    const activeTagsSet = new Set(state.catalogTags);
    const activeFacetGroup =
      facets.find((g) => g.key === state.catalogFacetGroup) || facets[0] || null;

    const facetBar =
      state.catalogTags.length || facets.length
        ? h(
            "div",
            { class: "facet-bar" },
            state.catalogTags.length
              ? h(
                  "div",
                  { class: "chips facet-active" },
                  state.catalogTags.map((qf) =>
                    h(
                      "button",
                      {
                        class: "chip-btn",
                        type: "button",
                        "aria-pressed": "true",
                        onclick: () => toggleTag(qf),
                      },
                      tagLabelFromQf(qf),
                      icon("x"),
                    ),
                  ),
                  h(
                    "button",
                    {
                      class: "btn ghost small",
                      type: "button",
                      onclick: () => {
                        state.catalogTags = [];
                        submitSearch(1, state.catalogPreset);
                      },
                    },
                    "清除標籤",
                  ),
                )
              : null,
            facets.length
              ? h(
                  "div",
                  { class: "facet-tabs", role: "tablist", "aria-label": "標籤分類" },
                  facets.map((g) =>
                    h(
                      "button",
                      {
                        class: "facet-tab",
                        type: "button",
                        role: "tab",
                        "aria-pressed": String(activeFacetGroup?.key === g.key),
                        onclick: () => {
                          state.catalogFacetGroup = g.key;
                          render();
                        },
                      },
                      g.label,
                    ),
                  ),
                )
              : null,
            activeFacetGroup
              ? h(
                  "div",
                  { class: "chips facet-chips" },
                  activeFacetGroup.items.map((item) =>
                    h(
                      "button",
                      {
                        class: "chip-btn",
                        type: "button",
                        "aria-pressed": String(activeTagsSet.has(item.qf)),
                        onclick: () => toggleTag(item.qf),
                      },
                      h("span", null, item.label),
                      item.count != null
                        ? h("span", { class: "chip-count num" }, formatNumber(item.count))
                        : null,
                    ),
                  ),
                )
              : null,
          )
        : null;

    const form = h(
      "form",
      {
        class: "search-panel",
        onsubmit: (e) => {
          e.preventDefault();
          submitSearch(1, "");
        },
      },
      h(
        "div",
        { class: "search-bar search-bar--wide" },
        inputEl,
        fieldEl,
        h(
          "button",
          { class: "btn primary", type: "submit" },
          icon("search"),
          "搜尋",
        ),
      ),
      h(
        "div",
        { class: "chips" },
        SCOPES.map(([val, label]) =>
          h(
            "button",
            {
              class: "chip-btn",
              type: "button",
              "aria-pressed": String(!state.catalogPreset && state.catalogScope === val),
              onclick: () => {
                state.catalogScope = val;
                submitSearch(1, "");
              },
            },
            label,
          ),
        ),
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            "aria-pressed": String(state.catalogPreset === "SMNEW"),
            onclick: () => {
              state.catalogDraftQ = "";
              state.catalogTags = [];
              inputEl.value = "";
              submitSearch(1, "SMNEW");
            },
          },
          "三民新進",
        ),
        h(
          "button",
          {
            class: "chip-btn",
            type: "button",
            "aria-pressed": String(state.catalogPreset === "MSNEW"),
            onclick: () => {
              state.catalogDraftQ = "";
              state.catalogTags = [];
              inputEl.value = "";
              submitSearch(1, "MSNEW");
            },
          },
          "民生新進",
        ),
      ),
      facetBar,
    );

    let resultsBody;
    if (state.catalogError) {
      resultsBody = h(
        "div",
        { class: "notice danger", style: "margin-top:16px;align-items:center" },
        icon("alert"),
        h("span", { style: "flex:1" }, state.catalogError),
        h(
          "button",
          {
            class: "btn small",
            type: "button",
            onclick: () => void runCatalogSearch(),
          },
          icon("refresh"),
          "重試",
        ),
      );
    } else if (data && data.items) {
      const sortEl = createSelect({
        id: "catalogSortSelect",
        options: SORTS,
        value: state.catalogSort,
        ariaLabel: "排序方式",
        small: true,
        onChange: (val) => {
          state.catalogSort = val;
          submitSearch(1, state.catalogPreset);
        },
      });

      const pageSizeEl = createSelect({
        id: "catalogPageSizeSelect",
        options: CATALOG_PAGE_SIZES,
        value: String(state.catalogPageSize),
        ariaLabel: "每頁顯示筆數",
        small: true,
        onChange: (val) => {
          const nextSize = normalizeCatalogPageSize(val);
          if (nextSize === state.catalogPageSize) return;
          state.catalogPageSize = nextSize;
          saveCatalogPageSize(nextSize);
          submitSearch(1, state.catalogPreset);
        },
      });

      const headingText = data.preset
        ? data.preset === "SMNEW"
          ? "三民總館新進館藏"
          : "民生分館新進館藏"
        : data.query
          ? "搜尋結果"
          : "全部館藏";

      const hasActiveFilters =
        Boolean(data.query) ||
        state.catalogScope !== "ALL" ||
        state.catalogTags.length > 0 ||
        Boolean(data.preset);

      const goToCatalogPage = (nextPage, nextPreset) => {
        const maxPages = Math.max(1, Number(data?.totalPages) || 1);
        const clamped = Math.max(
          1,
          Math.min(maxPages, Math.floor(Number(nextPage) || 1)),
        );
        if (clamped === (data.startPage || data.page) && data.startPage === data.endPage) return;
        submitSearch(clamped, nextPreset);
        const secEl = mainEl.querySelector(".section");
        if (secEl && secEl.getBoundingClientRect().top < 64) {
          secEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };

      const endPage = data.endPage || data.page || 1;
      const pageJumpInput = h("input", {
        id: "catalogPageJump",
        class: "input pager-input num",
        type: "number",
        inputmode: "numeric",
        min: "1",
        max: String(data.totalPages),
        value: String(endPage),
        disabled: state.catalogLoading,
        "aria-label": "前往頁碼",
      });

      const setView = (nextView) => {
        if (state.catalogView === nextView) return;
        state.catalogView = nextView;
        saveCatalogView(nextView);
        render();
      };

      const viewToggle = h(
        "div",
        { id: "catalogViewToggle", class: "seg view-seg", role: "group", "aria-label": "顯示模式" },
        h(
          "button",
          {
            type: "button",
            "data-view": "list",
            "aria-pressed": String(state.catalogView === "list"),
            onclick: () => setView("list"),
          },
          icon("list"),
          "列表",
        ),
        h(
          "button",
          {
            type: "button",
            "data-view": "grid",
            "aria-pressed": String(state.catalogView === "grid"),
            onclick: () => setView("grid"),
          },
          icon("grid"),
          "圖示",
        ),
      );

      resultsBody = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "section-head" },
          h(
            "h2",
            null,
            headingText,
            h("span", { id: "catalogTotalCount", class: "count" }, `(${formatNumber(data.totalResults)})`),
          ),
          h(
            "div",
            { class: "section-controls" },
            viewToggle,
            pageSizeEl,
            sortEl,
            h(
              "span",
              { id: "catalogPageMeta", class: "meta num" },
              formatCatalogPageMeta(data),
            ),
          ),
        ),
        data.items.length
          ? state.catalogView === "grid"
            ? h(
                "div",
                { id: "catalogResultsList", class: "book-grid" },
                data.items.map((item, idx) => renderBookCard(item, idx)),
              )
            : h(
                "div",
                { id: "catalogResultsList", class: "list" },
                data.items.map((item, idx) => renderBookRow(item, idx)),
              )
          : h(
              "div",
              { class: "list" },
              h(
                "div",
                { class: "empty" },
                icon("search"),
                h("strong", null, "找不到符合條件的館藏"),
                hasActiveFilters
                  ? h(
                      "div",
                      { class: "actions", style: "justify-content:center" },
                      h(
                        "button",
                        {
                          class: "btn small",
                          type: "button",
                          onclick: () => {
                            state.catalogQuery = "";
                            state.catalogDraftQ = "";
                            state.catalogField = "ALL";
                            state.catalogScope = "ALL";
                            state.catalogPreset = "";
                            state.catalogSort = "RE";
                            state.catalogTags = [];
                            inputEl.value = "";
                            fieldEl.value = "ALL";
                            submitSearch(1, "");
                          },
                        },
                        "重設條件",
                      ),
                    )
                  : null,
              ),
            ),
        data.items.length
          ? h(
              "div",
              { class: "catalog-feed-foot" },
              h("div", { id: "catalogLoadSentinel", class: "infinite-sentinel" }, ...buildCatalogSentinelNodes(data)),
              data.totalPages > 1
                ? h(
                    "form",
                    {
                      class: "pager-jump",
                      onsubmit: (e) => {
                        e.preventDefault();
                        const target = Number.parseInt(pageJumpInput.value, 10);
                        if (!Number.isFinite(target)) return;
                        goToCatalogPage(target, data.preset);
                      },
                    },
                    pageJumpInput,
                    h("span", { class: "meta num" }, `/ ${formatNumber(data.totalPages)} 頁`),
                    h(
                      "button",
                      {
                        class: "btn small",
                        type: "submit",
                        disabled: state.catalogLoading,
                      },
                      "前往",
                    ),
                  )
                : null,
            )
          : null,
      );
    } else {
      resultsBody = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "list" },
          h(
            "div",
            { class: "empty" },
            icon("book"),
            h("strong", null, "載入館藏中…"),
          ),
        ),
      );
    }

    return h(
      "div",
      null,
      state.catalogLoading ? h("div", { class: "loading" }) : null,
      h("div", { class: "hero" }, h("h1", null, "館藏查詢")),
      form,
      resultsBody,
    );
  }

  // ---------------------------------------------------------------------------
  // View: My Account / Loans (/library/loans)

  function renderLoansView() {
    if (state.overviewError && !state.overview) {
      return renderAuthOrFatalError(state.overviewError);
    }
    const data = state.overview;
    const acct = data?.account || {
      checkouts: [],
      holds: [],
      fines: [],
      history: [],
    };
    const maskedId = data?.patron?.maskedId || "";

    const sp = new URLSearchParams(location.search);
    const paramTab = sp.get("tab");
    if (
      paramTab &&
      ["checkouts", "holds", "fines", "history"].includes(paramTab) &&
      state.loanTab !== paramTab
    ) {
      state.loanTab = paramTab;
    }

    const tabs = [
      ["checkouts", `借閱中 (${acct.checkouts.length})`],
      ["holds", `預約中 (${acct.holds.length})`],
      ["fines", `罰款 (${acct.fines.length})`],
      ["history", `歷史 (${acct.history.length})`],
    ];

    const toolbar = h(
      "div",
      { class: "toolbar" },
      h(
        "div",
        { class: "seg", role: "tablist" },
        tabs.map(([k, label]) =>
          h(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-pressed": String(state.loanTab === k),
              onclick: () => {
                state.loanTab = k;
                if (new URLSearchParams(location.search).has("tab")) {
                  history.replaceState(null, "", routeUrl("loans", `?tab=${k}`));
                }
                render();
              },
            },
            label,
          ),
        ),
      ),
      h("div", { class: "spacer" }),
      maskedId
        ? h(
            "button",
            {
              class: "btn small",
              type: "button",
              onclick: () => {
                state.privacyRevealed = !state.privacyRevealed;
                render();
              },
            },
            icon(state.privacyRevealed ? "eye-off" : "eye"),
            state.privacyRevealed ? `證號 ${maskedId}` : "顯示借閱證號",
          )
        : null,
    );

    let panelContent;
    if (data?.sectionErrors?.opac) {
      panelContent = h(
        "div",
        { class: "notice danger", style: "margin-top:16px" },
        icon("alert"),
        h("span", null, data.sectionErrors.opac),
      );
    } else if (state.loanTab === "checkouts") {
      const renewableLoans = acct.checkouts.filter((c) => c.renewable);
      const renewableAny = renewableLoans.length > 0;
      const allSelected =
        renewableAny &&
        renewableLoans.every((c) => state.selectedRenewIds.has(c.id));
      panelContent = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "list" },
          acct.checkouts.length
            ? acct.checkouts.map((loan) => {
                const selected = loan.renewable && state.selectedRenewIds.has(loan.id);
                const subText = [loan.callNumber, loan.renewals].filter(Boolean).join(" · ");
                if (!renewableAny) {
                  return h(
                    "div",
                    { class: "row" },
                    h("div", { class: "row-icon accent" }, icon("book")),
                    h(
                      "div",
                      { style: "min-width:0" },
                      h("div", { class: "row-title" }, loan.title),
                      h("div", { class: "row-sub num" }, subText),
                    ),
                    h(
                      "div",
                      { class: "row-end" },
                      h("span", { class: "chip num" }, loan.dueDate || "借閱中"),
                    ),
                  );
                }
                if (loan.renewable) {
                  return h(
                    "label",
                    {
                      class: "row loan-row loan-row--selectable",
                      "data-selected": selected ? "true" : "false",
                    },
                    h(
                      "span",
                      { class: "loan-check-slot" },
                      h("input", {
                        type: "checkbox",
                        class: "loan-check-input",
                        checked: selected,
                        "aria-label": `選擇續借 ${loan.title}`,
                        onchange: (e) => {
                          if (e.target.checked) state.selectedRenewIds.add(loan.id);
                          else state.selectedRenewIds.delete(loan.id);
                          render();
                        },
                      }),
                      h("span", { class: "loan-check-box", "aria-hidden": "true" }, icon("check")),
                    ),
                    h(
                      "div",
                      { style: "min-width:0" },
                      h("div", { class: "row-title" }, loan.title),
                      h("div", { class: "row-sub num" }, subText),
                    ),
                    h(
                      "div",
                      { class: "row-end" },
                      h("span", { class: "chip accent num" }, loan.dueDate || "借閱中"),
                    ),
                  );
                }
                return h(
                  "div",
                  { class: "row loan-row loan-row--locked" },
                  h(
                    "span",
                    { class: "loan-check-slot" },
                    h("input", {
                      type: "checkbox",
                      class: "loan-check-input",
                      disabled: true,
                      "aria-label": `${loan.title}（不可續借）`,
                    }),
                    h("span", { class: "loan-check-box", "aria-hidden": "true" }, icon("check")),
                  ),
                  h(
                    "div",
                    { style: "min-width:0" },
                    h("div", { class: "row-title" }, loan.title),
                    h("div", { class: "row-sub num" }, subText),
                  ),
                  h(
                    "div",
                    { class: "row-end" },
                    h("span", { class: "chip num" }, loan.dueDate || "借閱中"),
                  ),
                );
              })
            : h("div", { class: "empty" }, icon("book"), h("strong", null, "目前無借閱中館藏")),
        ),
        renewableAny
          ? h(
              "div",
              { class: "actions" },
              h(
                "button",
                {
                  class: "btn primary",
                  type: "button",
                  disabled: state.selectedRenewIds.size === 0 || state.renewBusy,
                  onclick: async () => {
                    state.renewBusy = true;
                    state.renewFeedback = null;
                    render();
                    try {
                      const reply = await apiJson("/api/library/opac/renew", {
                        method: "POST",
                        body: JSON.stringify({
                          itemIds: [...state.selectedRenewIds],
                        }),
                      });
                      state.selectedRenewIds.clear();
                      state.renewFeedback = {
                        kind: "success",
                        text: reply.message || "續借請求已送出。",
                      };
                      await loadOverview({ force: true });
                    } catch (err) {
                      state.renewFeedback = {
                        kind: "danger",
                        text: err?.message || "續借失敗，請稍後再試。",
                      };
                    } finally {
                      state.renewBusy = false;
                      render();
                    }
                  },
                },
                state.renewBusy ? "續借中…" : `續借已選 (${state.selectedRenewIds.size})`,
              ),
              renewableLoans.length > 1
                ? h(
                    "button",
                    {
                      class: "btn ghost",
                      type: "button",
                      disabled: state.renewBusy,
                      onclick: () => {
                        if (allSelected) {
                          for (const c of renewableLoans) state.selectedRenewIds.delete(c.id);
                        } else {
                          for (const c of renewableLoans) state.selectedRenewIds.add(c.id);
                        }
                        render();
                      },
                    },
                    allSelected ? "取消全選" : "全選可續借",
                  )
                : null,
            )
          : null,
        state.renewFeedback
          ? h(
              "div",
              { class: `notice ${state.renewFeedback.kind}`, style: "margin-top:12px" },
              icon(state.renewFeedback.kind === "success" ? "check" : "alert"),
              h("span", null, state.renewFeedback.text),
            )
          : null,
      );
    } else if (state.loanTab === "holds") {
      panelContent = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "list" },
          acct.holds.length
            ? acct.holds.map((hold) =>
                h(
                  "div",
                  { class: "row" },
                  h("div", { class: "row-icon accent" }, icon("bookmark")),
                  h(
                    "div",
                    { style: "min-width:0" },
                    h("div", { class: "row-title" }, hold.title),
                    h("div", { class: "row-sub num" }, [hold.pickupLibrary, hold.expiresAt].filter(Boolean).join(" · ")),
                  ),
                  h("div", { class: "row-end" }, h("span", { class: "chip accent" }, hold.status || "預約中")),
                ),
              )
            : h("div", { class: "empty" }, icon("bookmark"), h("strong", null, "目前無預約中館藏")),
        ),
      );
    } else if (state.loanTab === "fines") {
      panelContent = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "list" },
          acct.fines.length
            ? acct.fines.map((fine) =>
                h(
                  "div",
                  { class: "row" },
                  h("div", { class: "row-icon danger" }, icon("credit")),
                  h(
                    "div",
                    { style: "min-width:0" },
                    h("div", { class: "row-title" }, fine.title),
                    h("div", { class: "row-sub num" }, [fine.reason, fine.date].filter(Boolean).join(" · ")),
                  ),
                  h("div", { class: "row-end" }, h("span", { class: "chip urgent num" }, fine.amount)),
                ),
              )
            : h("div", { class: "empty" }, icon("check"), h("strong", null, "無待繳罰款"), `目前累計：${data?.summary?.finesTotal || "NT$0.00"}`),
        ),
      );
    } else {
      panelContent = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "list" },
          acct.history.length
            ? acct.history.map((item) =>
                h(
                  "div",
                  { class: "row" },
                  h("div", { class: "row-icon" }, icon("book")),
                  h(
                    "div",
                    { style: "min-width:0" },
                    h("div", { class: "row-title" }, item.title),
                    item.author ? h("div", { class: "row-sub" }, item.author) : null,
                  ),
                  h("div", { class: "row-end" }, item.checkoutDate ? h("span", { class: "meta num" }, item.checkoutDate) : null),
                ),
              )
            : h("div", { class: "empty" }, icon("book"), h("strong", null, "無借閱歷史紀錄")),
        ),
      );
    }

    return h(
      "div",
      null,
      h(
        "div",
        { class: "hero" },
        h("h1", null, "借閱帳戶"),
        h(
          "div",
          { class: "hero-side" },
          h("span", { class: "chip done" }, `狀態 ${data?.status || "OK"}`),
        ),
      ),
      toolbar,
      panelContent,
    );
  }

  // ---------------------------------------------------------------------------
  // View: Rooms & Study Carrels (/library/rooms)

  function buildCalendarPanel(onSelectDate) {
    const cal = state.calData;
    const year = cal?.year || state.calYear;
    const month = cal?.month || state.calMonth;
    const daysMap = new Map((cal?.days || []).map((d) => [d.day, d]));

    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();

    const stepMonth = (delta) => {
      const dt = new Date(year, month - 1 + delta, 1);
      void loadCarrelCalendar({ year: dt.getFullYear(), month: dt.getMonth() + 1 });
    };

    const gridCells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      gridCells.push(h("div", { class: "cal-day empty", "aria-hidden": "true" }));
    }
    for (let d = 1; d <= totalDays; d += 1) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayData = daysMap.get(d);
      const avail = dayData?.availableRooms || [];
      gridCells.push(
        h(
          "button",
          {
            class: `cal-day${state.selectedDateKey === dateKey ? " selected" : ""}`,
            type: "button",
            "aria-label": `${dateKey} 可借 ${avail.length} 間`,
            onclick: () => {
              state.selectedDateKey = dateKey;
              onSelectDate(dateKey);
              render();
            },
          },
          h("span", { class: "cal-day-num" }, String(d)),
          dayData
            ? h(
                "span",
                { class: "cal-day-dots" },
                ["1", "2", "3", "4", "5", "6", "7"].map((r) =>
                  h("i", {
                    class: `cal-dot${avail.includes(r) ? "" : " booked"}`,
                    title: `10F-${r}`,
                  }),
                ),
              )
            : null,
        ),
      );
    }

    const selectedEntry = state.selectedDateKey
      ? (cal?.days || []).find((d) => d.dateKey === state.selectedDateKey)
      : null;

    return h(
      "div",
      { class: "panel" },
      h(
        "div",
        { class: "cal-head" },
        h("h2", null, "研究小間可預約月曆"),
        h(
          "div",
          { class: "cal-nav" },
          h(
            "button",
            {
              class: "btn small",
              type: "button",
              disabled: state.calLoading,
              onclick: () => stepMonth(-1),
              "aria-label": "上個月",
            },
            icon("left"),
          ),
          h("span", { class: "cal-month" }, `${year} 年 ${month} 月`),
          h(
            "button",
            {
              class: "btn small",
              type: "button",
              disabled: state.calLoading,
              onclick: () => stepMonth(1),
              "aria-label": "下個月",
            },
            icon("right"),
          ),
        ),
      ),
      state.calError
        ? h("div", { class: "notice danger" }, icon("alert"), h("span", null, state.calError))
        : h(
            "div",
            null,
            h(
              "div",
              { class: "cal-weekdays" },
              ["日", "一", "二", "三", "四", "五", "六"].map((w) => h("span", null, w)),
            ),
            h("div", { class: "cal-days" }, gridCells),
            h(
              "div",
              { class: "cal-legend" },
              h("span", null, h("i", { class: "cal-dot" }), "可預約 (10F-1 ~ 10F-7)"),
              h("span", null, h("i", { class: "cal-dot booked" }), "已額滿"),
            ),
            selectedEntry
              ? h(
                  "div",
                  { class: "notice", style: "margin-top:12px" },
                  icon("calendar"),
                  h(
                    "span",
                    { class: "num" },
                    `${selectedEntry.dateKey} 可借：${
                      selectedEntry.availableRooms.length
                        ? selectedEntry.availableRooms.map((r) => `10F-${r}`).join("、")
                        : "已全部預約"
                    }`,
                  ),
                )
              : null,
          ),
    );
  }

  function renderRoomsView() {
    if (state.overviewError && !state.overview) {
      return renderAuthOrFatalError(state.overviewError);
    }

    const carrels = state.overview?.carrels || {};
    const defaults = carrels.formDefaults || {
      role: "學生",
      department: "",
      phone: "",
      email: "",
      altEmail: "",
      periods: [
        { value: "1", label: "整天" },
        { value: "2", label: "9時-13時" },
        { value: "3", label: "13時-17時" },
        { value: "4", label: "17時-21時" },
      ],
      rooms: ["1", "2", "3", "4", "5", "6", "7"].map((v) => ({
        value: v,
        label: `研究小間10F-${v}`,
      })),
      rules: [],
    };
    const reservations = carrels.reservations || [];
    const todayIso = new Date().toISOString().slice(0, 10);
    const initialDate = state.selectedDateKey || todayIso;
    const draft = state.carrelDraft;
    const draftVal = (key, fallback) =>
      Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : fallback;

    const currentRole = draftVal("role", defaults.role || "學生");
    const currentRoom = draftVal("room", defaults.rooms[0]?.value || "1");
    const currentPeriod = draftVal("timePeriod", "2");

    const roleSelect = createSelect({
      id: "carrelRole",
      options: ["學生", "研究生", "專任教師"],
      value: currentRole,
      ariaLabel: "身份別",
      onChange: (val) => {
        draft.role = val;
      },
    });
    const roomSelect = createSelect({
      id: "carrelRoom",
      options: defaults.rooms,
      value: currentRoom,
      ariaLabel: "研究小間",
      onChange: (val) => {
        draft.room = val;
      },
    });
    const periodSelect = createSelect({
      id: "carrelPeriod",
      options: defaults.periods,
      value: currentPeriod,
      ariaLabel: "借用時段",
      onChange: (val) => {
        draft.timePeriod = val;
      },
    });
    const dateStartInput = h("input", {
      class: "input num",
      id: "carrelStart",
      type: "date",
      value: draftVal("dateStart", initialDate),
      oninput: (e) => {
        draft.dateStart = e.target.value;
        state.selectedDateKey = e.target.value;
      },
      required: true,
    });
    const dateEndInput = h("input", {
      class: "input num",
      id: "carrelEnd",
      type: "date",
      value: draftVal("dateEnd", initialDate),
      oninput: (e) => {
        draft.dateEnd = e.target.value;
      },
      required: true,
    });
    const deptInput = h("input", {
      class: "input",
      id: "carrelDept",
      type: "text",
      placeholder: "例如：資工三甲",
      value: draftVal("department", defaults.department || ""),
      oninput: (e) => {
        draft.department = e.target.value;
      },
      required: true,
    });
    const phoneInput = h("input", {
      class: "input num",
      id: "carrelPhone",
      type: "tel",
      placeholder: "聯絡電話",
      value: draftVal("phone", defaults.phone || ""),
      oninput: (e) => {
        draft.phone = e.target.value;
      },
      required: true,
    });
    const emailInput = h("input", {
      class: "input",
      id: "carrelEmail",
      type: "email",
      value: draftVal("email", defaults.email || ""),
      oninput: (e) => {
        draft.email = e.target.value;
      },
      required: true,
    });
    const altEmailInput = h("input", {
      class: "input",
      id: "carrelAltEmail",
      type: "email",
      placeholder: "備用信箱",
      value: draftVal("altEmail", defaults.altEmail || defaults.email || ""),
      oninput: (e) => {
        draft.altEmail = e.target.value;
      },
      required: true,
    });

    const calendarPanel = buildCalendarPanel((pickedIso) => {
      draft.dateStart = pickedIso;
      draft.dateEnd = pickedIso;
      dateStartInput.value = pickedIso;
      dateEndInput.value = pickedIso;
    });

    const bookingForm = h(
      "form",
      {
        class: "panel",
        onsubmit: async (e) => {
          e.preventDefault();
          state.bookingBusy = true;
          state.bookingFeedback = null;
          render();
          try {
            const reply = await apiJson("/api/library/rooms/carrel/book", {
              method: "POST",
              body: JSON.stringify({
                role: roleSelect.value,
                room: roomSelect.value,
                timePeriod: periodSelect.value,
                dateStart: dateStartInput.value,
                dateEnd: dateEndInput.value,
                department: deptInput.value.trim(),
                phone: phoneInput.value.trim(),
                email: emailInput.value.trim(),
                altEmail: altEmailInput.value.trim(),
              }),
            });
            state.bookingFeedback = { kind: "success", text: reply.message };
            await Promise.all([
              loadOverview({ force: true }),
              loadCarrelCalendar({ force: true }),
            ]);
          } catch (err) {
            state.bookingFeedback = {
              kind: "danger",
              text: err?.message || "送出預約失敗。",
            };
          } finally {
            state.bookingBusy = false;
            render();
          }
        },
      },
      h(
        "div",
        { class: "panel-head" },
        h("h2", null, "預約研究小間"),
        h(
          "a",
          {
            class: "meta",
            href: `${BASE}/open/carrel`,
            target: "_blank",
            rel: "noopener",
          },
          "在官方表單開啟",
        ),
      ),
      h(
        "div",
        { class: "form-grid" },
        h("div", { class: "field" }, h("label", { for: "carrelRoom" }, "研究小間"), roomSelect),
        h("div", { class: "field" }, h("label", { for: "carrelPeriod" }, "借用時段"), periodSelect),
        h("div", { class: "field" }, h("label", { for: "carrelStart" }, "起始日期"), dateStartInput),
        h("div", { class: "field" }, h("label", { for: "carrelEnd" }, "結束日期"), dateEndInput),
        h("div", { class: "field" }, h("label", { for: "carrelRole" }, "身份別"), roleSelect),
        h("div", { class: "field" }, h("label", { for: "carrelDept" }, "所屬單位"), deptInput),
        h("div", { class: "field" }, h("label", { for: "carrelPhone" }, "聯絡電話"), phoneInput),
        h("div", { class: "field" }, h("label", { for: "carrelEmail" }, "電子郵件"), emailInput),
        h("div", { class: "field wide" }, h("label", { for: "carrelAltEmail" }, "備用電子郵件"), altEmailInput),
      ),
      defaults.rules?.length
        ? h(
            "details",
            { class: "rules-box" },
            h("summary", null, "借用規範（10F-1–10F-3 學生每次 4 小時，限 1–5 人）"),
            h(
              "div",
              { class: "rules-body" },
              defaults.rules.map((r) => h("div", null, r)),
            ),
          )
        : null,
      state.bookingFeedback
        ? h(
            "div",
            { class: `notice ${state.bookingFeedback.kind}`, style: "margin-top:12px" },
            icon(state.bookingFeedback.kind === "success" ? "check" : "alert"),
            h("span", null, state.bookingFeedback.text),
          )
        : null,
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          { class: "btn primary", type: "submit", disabled: state.bookingBusy },
          state.bookingBusy ? "送出中…" : "確定預約",
        ),
      ),
    );

    const activeSection = h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", null, "我的研究小間預約紀錄")),
      state.overview?.sectionErrors?.carrels
        ? h("div", { class: "notice danger" }, icon("alert"), h("span", null, state.overview.sectionErrors.carrels))
        : h(
            "div",
            { class: "list" },
            reservations.length
              ? reservations.map((res) =>
                  h(
                    "div",
                    { class: "row" },
                    h("div", { class: "row-icon done" }, icon("door")),
                    h(
                      "div",
                      { style: "min-width:0" },
                      h("div", { class: "row-title" }, res.room),
                      h("div", { class: "row-sub num" }, [res.dateRange, res.timePeriod].filter(Boolean).join(" · ")),
                    ),
                    h(
                      "div",
                      { class: "row-end" },
                      res.status ? h("span", { class: "chip done" }, res.status) : null,
                      res.canCancel
                        ? state.confirmCancelId === res.targetId
                          ? h(
                              "button",
                              {
                                class: "btn small danger",
                                type: "button",
                                disabled: state.cancelBusyId === res.targetId,
                                onclick: async () => {
                                  state.cancelBusyId = res.targetId;
                                  render();
                                  try {
                                    await apiJson("/api/library/rooms/carrel/cancel", {
                                      method: "POST",
                                      body: JSON.stringify({ targetId: res.targetId }),
                                    });
                                    state.confirmCancelId = "";
                                    await Promise.all([
                                      loadOverview({ force: true }),
                                      loadCarrelCalendar({ force: true }),
                                    ]);
                                  } catch (err) {
                                    state.bookingFeedback = {
                                      kind: "danger",
                                      text: err?.message || "取消預約失敗。",
                                    };
                                  } finally {
                                    state.cancelBusyId = "";
                                    render();
                                  }
                                },
                              },
                              state.cancelBusyId === res.targetId ? "取消中…" : "確定取消",
                            )
                          : h(
                              "button",
                              {
                                class: "btn small",
                                type: "button",
                                onclick: () => {
                                  state.confirmCancelId = res.targetId;
                                  render();
                                },
                              },
                              "取消預約",
                            )
                        : null,
                    ),
                  ),
                )
              : h("div", { class: "empty" }, icon("door"), h("strong", null, "目前沒有研究小間預約紀錄")),
          ),
    );

    const otherRooms = h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", null, "其他空間申請")),
      h(
        "div",
        { class: "service-grid" },
        [
          ["group-discuss", "預約團體討論室 (10F)", "6 人以上小組討論，至多 4 小時", "users"],
          ["group-screening", "預約團體放映室", "多媒體視聽空間預約", "door"],
          ["orientation", "預約新生利用教育", "圖書館利用教育場次預約", "calendar"],
        ].map(([key, title, sub, ic]) =>
          h(
            "a",
            {
              class: "service",
              href: `${BASE}/open/${key}`,
              target: "_blank",
              rel: "noopener",
            },
            h("div", { class: "service-icon" }, icon(ic)),
            h("div", { class: "service-title" }, title),
            h("div", { class: "service-foot" }, icon("external"), sub),
          ),
        ),
      ),
    );

    return h(
      "div",
      null,
      h("div", { class: "hero" }, h("h1", null, "空間預約")),
      h("div", { class: "rooms-grid" }, calendarPanel, bookingForm),
      activeSection,
      otherRooms,
    );
  }

  // ---------------------------------------------------------------------------
  // View: Databases, EndNote & Tools (/library/resources)

  function renderResourcesView() {
    const inputEl = h("input", {
      id: "dbQueryInput",
      class: "input",
      type: "search",
      placeholder: "搜尋電子資料庫名稱或主題（如 IEEE、期刊、論文）…",
      value: state.dbDraftKeyword,
      oninput: (e) => {
        state.dbDraftKeyword = e.target.value;
      },
      "aria-label": "搜尋電子資料庫",
    });

    const form = h(
      "form",
      {
        class: "search-panel",
        onsubmit: (e) => {
          e.preventDefault();
          void runDatabasesLoad({ q: inputEl.value, filterIdx: state.dbFilterIdx });
        },
      },
      h(
        "div",
        { class: "search-bar" },
        inputEl,
        h("button", { class: "btn primary", type: "submit" }, icon("search"), "搜尋資料庫"),
      ),
      h(
        "div",
        { class: "chips" },
        DB_FILTERS.map((f, idx) =>
          h(
            "button",
            {
              class: "chip-btn",
              type: "button",
              "aria-pressed": String(!state.dbKeyword.trim() && state.dbFilterIdx === idx),
              onclick: () => {
                state.dbDraftKeyword = "";
                inputEl.value = "";
                void runDatabasesLoad({ q: "", filterIdx: idx });
              },
            },
            f.label,
          ),
        ),
      ),
    );

    const dbList = state.dbError
      ? h("div", { class: "notice danger", style: "margin-top:16px" }, icon("alert"), h("span", null, state.dbError))
      : h(
          "section",
          { class: "section" },
          h(
            "div",
            { class: "section-head" },
            h("h2", null, "電子資料庫", state.dbData ? h("span", { class: "count" }, `(${state.dbData.count})`) : null),
          ),
          h(
            "div",
            { class: "list" },
            state.dbData?.items?.length
              ? state.dbData.items.map((db) =>
                  h(
                    "div",
                    { class: "db-card" },
                    h(
                      "div",
                      { class: "db-head" },
                      db.url
                        ? h(
                            "a",
                            {
                              class: "db-title",
                              href: db.url,
                              target: "_blank",
                              rel: "noopener",
                            },
                            db.name,
                          )
                        : h("span", { class: "db-title" }, db.name),
                      h(
                        "div",
                        { class: "db-actions" },
                        db.accessType ? h("span", { class: "chip accent" }, db.accessType) : null,
                        db.expiry ? h("span", { class: "meta num" }, `至 ${db.expiry}`) : null,
                      ),
                    ),
                    db.description ? h("div", { class: "db-desc" }, db.description) : null,
                    h(
                      "div",
                      { class: "db-actions" },
                      db.url
                        ? h(
                            "a",
                            {
                              class: "btn small",
                              href: db.url,
                              target: "_blank",
                              rel: "noopener",
                            },
                            icon("external"),
                            "開啟資料庫",
                          )
                        : null,
                      db.guideUrl
                        ? h(
                            "a",
                            {
                              class: "btn small ghost",
                              href: db.guideUrl,
                              target: "_blank",
                              rel: "noopener",
                            },
                            icon("file"),
                            "使用說明",
                          )
                        : null,
                    ),
                  ),
                )
              : h("div", { class: "empty" }, icon("database"), h("strong", null, "無符合條件的資料庫")),
          ),
        );

    const downloads = state.overview?.downloads || [];
    const endnoteSection = h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", null, "EndNote 書目管理軟體")),
      state.overview?.sectionErrors?.downloads
        ? h("div", { class: "notice danger" }, icon("alert"), h("span", null, state.overview.sectionErrors.downloads))
        : h(
            "div",
            { class: "list" },
            downloads.length
              ? downloads.map((dl) =>
                  h(
                    "a",
                    {
                      class: "row",
                      href: dl.downloadPath,
                      download: "",
                    },
                    h("div", { class: "row-icon accent" }, icon("download")),
                    h(
                      "div",
                      { style: "min-width:0" },
                      h("div", { class: "row-title" }, dl.title),
                    ),
                    h(
                      "div",
                      { class: "row-end" },
                      h("span", { class: "chip muted" }, dl.platform),
                      icon("download"),
                    ),
                  ),
                )
              : h("div", { class: "empty" }, icon("download"), h("strong", null, "尚未取得軟體下載清單")),
          ),
    );

    const toolsSection = h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", null, "其他圖書館資源與設定")),
      h(
        "div",
        { class: "service-grid" },
        [
          ["ejournals", "電子期刊", "Serials Solutions 電子期刊", "database"],
          ["summon", "電子資源探索 (Summon)", "跨庫探索檢索", "compass"],
          ["recommend", "書刊推薦", "線上推薦圖書採購", "book"],
          ["patron-rights", "讀者權益聲明", "電子郵件與開通簽核", "check"],
          ["reset-pin", "重設館藏查詢密碼", "更改 OPAC 個人密碼", "lock"],
        ].map(([key, title, sub, ic]) =>
          h(
            "a",
            {
              class: "service",
              href: `${BASE}/open/${key}`,
              target: "_blank",
              rel: "noopener",
            },
            h("div", { class: "service-icon" }, icon(ic)),
            h("div", { class: "service-title" }, title),
            h("div", { class: "service-foot" }, icon("external"), sub),
          ),
        ),
      ),
    );

    return h(
      "div",
      null,
      state.dbLoading ? h("div", { class: "loading" }) : null,
      h("div", { class: "hero" }, h("h1", null, "電子資源與工具")),
      form,
      dbList,
      endnoteSection,
      toolsSection,
    );
  }

  // ---------------------------------------------------------------------------
  let catalogSentinelObserver = null;
  let catalogScrollRaf = 0;

  function buildCatalogSentinelNodes(data = state.catalogData) {
    if (!data) return [];
    if (state.catalogAppendError) {
      return [
        h("span", { class: "meta" }, state.catalogAppendError),
        h(
          "button",
          {
            id: "catalogLoadRetry",
            class: "btn small",
            type: "button",
            onclick: () => {
              state.catalogAppendError = "";
              void loadNextCatalogPage();
            },
          },
          icon("refresh"),
          "重試載入更多",
        ),
      ];
    }
    const endPage = Math.max(1, Number(data.endPage || data.page) || 1);
    if (catalogHasMore(data)) {
      if (state.catalogAppending) {
        return [
          h(
            "span",
            { class: "meta num", role: "status", "aria-live": "polite" },
            `正在載入第 ${formatNumber(endPage + 1)} / ${formatNumber(data.totalPages)} 頁…`,
          ),
        ];
      }
      return [
        h(
          "button",
          {
            id: "catalogLoadMoreButton",
            class: "btn small",
            type: "button",
            onclick: () => void loadNextCatalogPage(),
          },
          `載入更多（已顯示 ${formatNumber(data.items.length)} / ${formatNumber(data.totalResults)} 筆）`,
        ),
      ];
    }
    return [
      h(
        "span",
        { class: "meta num" },
        `已顯示全部 ${formatNumber(data.items.length)} 筆館藏`,
      ),
    ];
  }

  function syncCatalogSentinelDom() {
    const sentinel = document.getElementById("catalogLoadSentinel");
    if (!sentinel) return;
    sentinel.replaceChildren(...buildCatalogSentinelNodes(state.catalogData));
  }

  function disconnectCatalogObserver() {
    if (catalogSentinelObserver) {
      catalogSentinelObserver.disconnect();
      catalogSentinelObserver = null;
    }
  }

  function maybeLoadMoreFromViewport() {
    const sentinel = document.getElementById("catalogLoadSentinel");
    if (
      !sentinel ||
      !catalogHasMore() ||
      state.catalogLoading ||
      state.catalogAppending ||
      state.catalogAppendError ||
      activeModal
    ) {
      return;
    }
    const rect = sentinel.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 600) {
      void loadNextCatalogPage();
    }
  }

  function setupCatalogInfiniteObserver() {
    disconnectCatalogObserver();
    const sentinel = document.getElementById("catalogLoadSentinel");
    if (!sentinel || !catalogHasMore()) return;
    if (typeof IntersectionObserver === "function") {
      catalogSentinelObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void loadNextCatalogPage();
          }
        },
        { rootMargin: "600px 0px" },
      );
      catalogSentinelObserver.observe(sentinel);
    }
  }

  async function loadNextCatalogPage() {
    const currentRoute = matchRoute(new URL(location.href)) || { name: "home" };
    if (currentRoute.name !== "catalog" || activeModal) return;
    const data = state.catalogData;
    if (!data || state.catalogLoading || state.catalogAppending || state.catalogAppendError) {
      return;
    }
    if (!catalogHasMore(data)) return;

    const reqId = catalogRequestSeq;
    const nextPage = Math.max(1, Number(data.endPage || data.page) || 1) + 1;
    const params = {
      q: data.query || "",
      field: data.field || "ALL",
      scope: data.scope || "ALL",
      preset: data.preset || "",
      sort: data.sort || "RE",
      tags: Array.isArray(data.tags) ? data.tags : [],
      page: nextPage,
      pageSize: data.pageSize || state.catalogPageSize,
    };
    const qs = buildCatalogSearchParams(params);
    const cacheKey = qs.toString();

    state.catalogAppending = true;
    state.catalogAppendError = "";
    syncCatalogSentinelDom();

    try {
      let nextRes = getClientCatalogCache(cacheKey);
      if (!nextRes) {
        nextRes = await apiJson(`/api/library/catalog/search?${qs}`);
        if (reqId !== catalogRequestSeq) return;
        setClientCatalogCache(cacheKey, nextRes);
      }
      if (reqId !== catalogRequestSeq || state.catalogData !== data) return;

      const seenIds = new Set(
        data.items.map((item) => String(item?.id || "")).filter(Boolean),
      );
      const freshItems = [];
      for (const item of Array.isArray(nextRes.items) ? nextRes.items : []) {
        const id = String(item?.id || "");
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        freshItems.push(item);
      }

      const baseIndex = data.items.length;
      data.items.push(...freshItems);
      data.page = nextRes.page || nextPage;
      data.endPage = nextRes.page || nextPage;
      if (Number(nextRes.totalResults) > 0) data.totalResults = nextRes.totalResults;
      if (Number(nextRes.totalPages) > 0) data.totalPages = nextRes.totalPages;
      state.catalogAppending = false;

      const listEl = document.getElementById("catalogResultsList");
      if (listEl) {
        if (freshItems.length) {
          const nodes = freshItems.map((item, offset) =>
            state.catalogView === "grid"
              ? renderBookCard(item, baseIndex + offset)
              : renderBookRow(item, baseIndex + offset),
          );
          listEl.append(...nodes);
        }
        const countEl = document.getElementById("catalogTotalCount");
        if (countEl) countEl.textContent = `(${formatNumber(data.totalResults)})`;
        const metaEl = document.getElementById("catalogPageMeta");
        if (metaEl) metaEl.textContent = formatCatalogPageMeta(data);
        const jumpInput = document.getElementById("catalogPageJump");
        if (jumpInput) {
          jumpInput.value = String(data.endPage);
          jumpInput.max = String(data.totalPages);
        }
        syncCatalogSentinelDom();
        setupCatalogInfiniteObserver();
      } else {
        render();
      }

      if (nextRes.availabilityPending && freshItems.length) {
        void hydrateCatalogAvailability(freshItems, reqId);
      }
      scheduleNextPagePrefetch(data);
      requestAnimationFrame(() => {
        maybeLoadMoreFromViewport();
      });
    } catch (error) {
      if (reqId !== catalogRequestSeq) return;
      state.catalogAppending = false;
      state.catalogAppendError = error?.message || "無法載入更多館藏。";
      syncCatalogSentinelDom();
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      if (catalogScrollRaf) return;
      catalogScrollRaf = requestAnimationFrame(() => {
        catalogScrollRaf = 0;
        const route = matchRoute(new URL(location.href)) || { name: "home" };
        if (route.name === "catalog") maybeLoadMoreFromViewport();
      });
    },
    { passive: true },
  );

  // Root Mount + Lazy Data Trigger

  const headerSlot = h("div");
  const mainEl = h("main");
  const rootWrap = h("div", { id: "libraryApp" }, headerSlot, mainEl);
  document.body.append(rootWrap, modalEl);
  let lastRouteName = "";
  const favoriteAvailabilityAttemptedIds = new Set();

  function render() {
    const route = matchRoute(new URL(location.href)) || { name: "home" };
    if (route.name === "home" && !homePrefetchScheduled) {
      homePrefetchScheduled = true;
      setTimeout(() => {
        prefetchCatalogQuery({
          q: "",
          field: "ALL",
          scope: "ALL",
          preset: "",
          sort: "RE",
          tags: [],
          page: 1,
          pageSize: state.catalogPageSize,
        });
      }, 500);
    }
    if (route.name === "catalog") {
      syncCatalogUrlParams();
      if (!state.catalogData && !state.catalogLoading && !state.catalogError) {
        void runCatalogSearch();
      }
    }
    if (route.name === "favorites") {
      if (!state.favoritesLoaded && !state.favoritesLoading) {
        void loadFavorites().then(() => render());
      } else {
        const pendingFavs = state.favorites
          .filter(
            (item) =>
              /^\d+$/.test(String(item.id || "")) &&
              item.availableCount == null &&
              !favoriteAvailabilityAttemptedIds.has(String(item.id)),
          )
          .slice(0, 48);
        if (pendingFavs.length) {
          for (const item of pendingFavs) {
            favoriteAvailabilityAttemptedIds.add(String(item.id));
          }
          void hydrateCatalogAvailability(pendingFavs, catalogRequestSeq);
        }
      }
    }
    if (route.name === "rooms" && !state.calData && !state.calLoading && !state.calError) {
      void loadCarrelCalendar();
    }
    if (route.name === "resources" && !state.dbData && !state.dbLoading && !state.dbError) {
      void runDatabasesLoad();
    }

    const titles = {
      home: "圖書館",
      catalog: "館藏查詢 · 圖書館",
      favorites: "我的收藏 · 圖書館",
      loans: "借閱帳戶 · 圖書館",
      rooms: "空間預約 · 圖書館",
      resources: "電子資源 · 圖書館",
    };
    document.title = `${titles[route.name] || "圖書館"} · NUTC Portal`;

    let view;
    if (route.name === "catalog") view = renderCatalogView();
    else if (route.name === "favorites") view = renderFavoritesView();
    else if (route.name === "loans") view = renderLoansView();
    else if (route.name === "rooms") view = renderRoomsView();
    else if (route.name === "resources") view = renderResourcesView();
    else view = renderHomeView();

    let activeInputState = null;
    if (!activeModal && document.activeElement && mainEl.contains(document.activeElement)) {
      const el = document.activeElement;
      if (
        (el.tagName === "INPUT" ||
          el.tagName === "SELECT" ||
          el.classList?.contains("select-trigger")) &&
        el.id
      ) {
        activeInputState = {
          id: el.id,
          start: typeof el.selectionStart === "number" ? el.selectionStart : null,
          end: typeof el.selectionEnd === "number" ? el.selectionEnd : null,
        };
      }
    }

    activeSelect?.close({ returnFocus: false });
    disconnectCatalogObserver();
    headerSlot.replaceChildren(renderHeader(route.name));
    mainEl.replaceChildren(
      view,
      h(
        "p",
        { class: "footer-link" },
        h("a", { href: DEMO ? DEMO.homeHref : "/" }, "NUTC Portal"),
        " · ",
        h(
          "a",
          { href: "/go/library", target: "_blank", rel: "noopener" },
          "在官方圖書館開啟",
        ),
      ),
    );
    if (route.name === "catalog") {
      setupCatalogInfiniteObserver();
    }
    if (route.name !== lastRouteName) {
      lastRouteName = route.name;
      mainEl.classList.remove("enter");
      void mainEl.offsetWidth;
      mainEl.classList.add("enter");
    }

    if (activeInputState) {
      const nextInput = document.getElementById(activeInputState.id);
      if (nextInput && typeof nextInput.focus === "function") {
        nextInput.focus({ preventScroll: true });
        if (activeInputState.start != null && typeof nextInput.setSelectionRange === "function") {
          try {
            nextInput.setSelectionRange(activeInputState.start, activeInputState.end ?? activeInputState.start);
          } catch {}
        }
      }
    }
  }

  window.NutcTheme?.init?.();
  void (async () => {
    render();
    await Promise.all([loadOverview(), loadFavorites()]);
    render();
  })();
})();
