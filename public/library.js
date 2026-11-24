// NUTC Portal Library Hub: modern search-first Operate interface under /library.
// Shares public/ais.css design tokens & chrome while talking strictly to /api/library/*.
(() => {
  "use strict";

  const BASE = "/library";
  const ROUTES = {
    "": "home",
    catalog: "catalog",
    loans: "loans",
    rooms: "rooms",
    resources: "resources",
  };
  const NAV = [
    ["home", "總覽"],
    ["catalog", "館藏"],
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

  function matchRoute(url) {
    if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return null;
    if (url.pathname.startsWith(`${BASE}/open/`)) return null;
    const rest = url.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
    return { name: ROUTES[rest] || "home" };
  }

  function hrefFor(name) {
    return name === "home" ? BASE : `${BASE}/${name}`;
  }

  function navigate(href, { replace = false } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) {
      location.assign(url.href);
      return;
    }
    history[replace ? "replaceState" : "pushState"](
      null,
      "",
      url.pathname + url.search,
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
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
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

  const state = {
    overview: null,
    overviewError: null,
    overviewLoading: false,
    privacyRevealed: false,

    catalogQuery: "",
    catalogDraftQ: "",
    catalogField: "ALL",
    catalogScope: "ALL",
    catalogPreset: "",
    catalogSort: "RE",
    catalogTags: [],
    catalogFacetGroup: "SUBJECT",
    catalogPage: 1,
    lastCatalogSearch: null,
    catalogData: null,
    catalogLoading: false,
    catalogError: "",

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

  let catalogRequestSeq = 0;

  async function runCatalogSearch({
    q = state.catalogQuery,
    field = state.catalogField,
    scope = state.catalogScope,
    preset = state.catalogPreset,
    sort = state.catalogSort,
    tags = state.catalogTags,
    page = state.catalogPage,
  } = {}) {
    const reqId = ++catalogRequestSeq;
    const cleanTags = Array.isArray(tags) ? [...new Set(tags.filter(Boolean))] : [];
    state.catalogQuery = q;
    state.catalogDraftQ = q;
    state.catalogField = field;
    state.catalogScope = scope;
    state.catalogPreset = preset;
    state.catalogSort = sort || "RE";
    state.catalogTags = cleanTags;
    state.catalogPage = page;
    state.catalogError = "";

    state.catalogLoading = true;
    render();
    try {
      const qs = new URLSearchParams({
        q: q.trim(),
        field,
        scope,
        preset,
        sort: state.catalogSort,
        page: String(page),
      });
      for (const tag of cleanTags) {
        qs.append("tag", tag);
      }
      const res = await apiJson(`/api/library/catalog/search?${qs}`);
      if (reqId !== catalogRequestSeq) return;
      state.catalogData = res;
    } catch (error) {
      if (reqId !== catalogRequestSeq) return;
      state.catalogError = error?.message || "無法查詢館藏系統。";
    } finally {
      if (reqId === catalogRequestSeq) {
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
    h("div", { class: "dialog wide", id: "libDialog" }),
  );

  function openBookModal(item) {
    lastFocused = document.activeElement;
    const dialog = modalEl.querySelector("#libDialog");
    dialog.replaceChildren(
      h(
        "div",
        { class: "dialog-head" },
        h("h2", { class: "dialog-title" }, item.title),
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
      h(
        "div",
        { class: "dialog-body" },
        h("div", { class: "loading", style: "margin:0 0 14px" }),
        h("p", { class: "meta" }, "正在載入館藏複本與借閱狀態…"),
      ),
    );
    modalEl.hidden = false;
    document.documentElement.classList.add("modal-open");
    activeModal = modalEl;
    dialog.querySelector(".dialog-close")?.focus();

    apiJson(
      `/api/library/catalog/item?path=${encodeURIComponent(item.detailPath)}`,
    )
      .then((detail) => {
        if (modalEl.hidden) return;
        const body = dialog.querySelector(".dialog-body");
        if (!body) return;
        const holdings = Array.isArray(detail.holdings) ? detail.holdings : [];
        body.replaceChildren(
          h(
            "div",
            { class: "meta-row", style: "margin-top:0;margin-bottom:14px" },
            detail.author ? h("span", null, detail.author) : null,
            detail.publisherYear ? h("span", null, detail.publisherYear) : null,
            detail.isbn ? h("span", { class: "num" }, `ISBN ${detail.isbn}`) : null,
          ),
          detail.summary
            ? h(
                "p",
                { class: "meta", style: "color:var(--soft);margin-bottom:14px" },
                detail.summary,
              )
            : null,
          h("h3", null, `館藏複本 (${holdings.length})`),
          holdings.length
            ? h(
                "div",
                { class: "holdings-list" },
                holdings.map((copy) =>
                  h(
                    "div",
                    { class: "holding-row" },
                    h(
                      "div",
                      null,
                      h("div", { class: "holding-loc" }, copy.branch || "館內"),
                      h(
                        "div",
                        { class: "holding-sub" },
                        [
                          copy.callNumber ? `索書號 ${copy.callNumber}` : "",
                          copy.itemType || "",
                          copy.barcode ? `條碼 ${copy.barcode}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      ),
                    ),
                    h(
                      "span",
                      {
                        class: `chip ${
                          /在架|可借|在館/.test(copy.status)
                            ? "done"
                            : /借出|預約/.test(copy.status)
                              ? "urgent"
                              : "muted"
                        }`,
                      },
                      copy.status || "查詢官方頁面",
                    ),
                  ),
                ),
              )
            : h("div", { class: "empty" }, "目前無可顯示的館藏複本明細。"),
          h(
            "div",
            { class: "actions" },
            h(
              "a",
              {
                class: "btn primary",
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
        { href: "/", role: "menuitem" },
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
          { class: "brand", href: BASE },
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

  function renderBookRow(item) {
    const coverImg = item.coverProxyUrl
      ? h("img", {
          src: item.coverProxyUrl,
          alt: "",
          loading: "lazy",
          onerror: (e) => {
            const box = e.currentTarget.parentElement;
            e.currentTarget.remove();
            if (box) box.append(icon("book"));
          },
        })
      : icon("book");

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

    return h(
      "button",
      {
        class: "book-row",
        type: "button",
        onclick: () => openBookModal(item),
      },
      h("div", { class: "book-cover" }, coverImg),
      h(
        "div",
        { class: "book-meta" },
        h("div", { class: "book-title" }, item.title),
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
        { class: "book-end" },
        availBadge,
        item.holdsCount > 0
          ? h("span", { class: "meta num" }, `預約 ${item.holdsCount}`)
          : null,
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

    const quickSelect = h(
      "select",
      {
        id: "homeCatalogScope",
        class: "select",
        "aria-label": "館藏範圍",
        onchange: (e) => {
          state.catalogScope = e.target.value;
        },
      },
      SCOPES.map(([val, label]) =>
        h("option", { value: val, selected: state.catalogScope === val }, label),
      ),
    );

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
      ),
    );

    const kpiGrid = h(
      "div",
      { class: "stat-grid" },
      h(
        "a",
        { class: "stat", href: `${BASE}/loans?tab=checkouts` },
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
        { class: "stat", href: `${BASE}/loans?tab=holds` },
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
        { class: "stat", href: `${BASE}/loans?tab=fines` },
        h("div", { class: "stat-top" }, h("span", null, "應付罰款"), icon("credit")),
        h("div", { class: "stat-value" }, String(summary.finesTotal)),
        h("div", { class: "stat-sub" }, data?.status ? `帳戶狀態：${data.status}` : "館藏帳戶"),
      ),
      h(
        "a",
        { class: "stat", href: `${BASE}/rooms` },
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
        h("a", { class: "meta", href: `${BASE}/loans` }, "查看全部"),
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
                    { class: "row", href: `${BASE}/loans` },
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
        h("a", { class: "meta", href: `${BASE}/rooms` }, "預約或查詢"),
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
                    { class: "row", href: `${BASE}/rooms` },
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
      quickRow,
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
      sp.has("page");
    if (!hasParams) return;
    const q = sp.get("q") || "";
    const scope = sp.get("scope") || "ALL";
    const field = sp.get("field") || "ALL";
    const preset = sp.get("preset") || "";
    const sort = sp.get("sort") || "RE";
    const tags = sp.getAll("tag").filter(Boolean);
    const page = Number(sp.get("page")) || 1;
    const changed =
      !state.catalogData ||
      q !== state.catalogQuery ||
      scope !== state.catalogScope ||
      field !== state.catalogField ||
      preset !== state.catalogPreset ||
      sort !== state.catalogSort ||
      tags.join("||") !== state.catalogTags.join("||") ||
      page !== state.catalogPage;
    if (changed && !state.catalogLoading) {
      void runCatalogSearch({ q, field, scope, preset, sort, tags, page });
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

    const fieldEl = h(
      "select",
      {
        id: "catalogFieldSelect",
        class: "select",
        "aria-label": "搜尋欄位",
        onchange: (e) => {
          state.catalogField = e.target.value;
        },
      },
      FIELDS.map(([val, label]) =>
        h("option", { value: val, selected: state.catalogField === val }, label),
      ),
    );

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
        page: String(nextPage),
      });
      for (const tag of state.catalogTags) {
        qs.append("tag", tag);
      }
      const nextSearch = `?${qs}`;
      state.lastCatalogSearch = nextSearch;
      history.replaceState(null, "", `${BASE}/catalog${nextSearch}`);
      void runCatalogSearch({
        q,
        field: fieldEl.value,
        scope: state.catalogScope,
        preset: nextPreset,
        sort: state.catalogSort,
        tags: state.catalogTags,
        page: nextPage,
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
      const sortEl = h(
        "select",
        {
          id: "catalogSortSelect",
          class: "select select--sm",
          "aria-label": "排序方式",
          onchange: (e) => {
            state.catalogSort = e.target.value;
            submitSearch(1, state.catalogPreset);
          },
        },
        SORTS.map(([val, label]) =>
          h("option", { value: val, selected: state.catalogSort === val }, label),
        ),
      );

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
            h("span", { class: "count" }, `(${formatNumber(data.totalResults)})`),
          ),
          h(
            "div",
            { class: "section-controls" },
            sortEl,
            h(
              "span",
              { class: "meta num" },
              `第 ${formatNumber(data.page)} / ${formatNumber(data.totalPages)} 頁`,
            ),
          ),
        ),
        data.items.length
          ? h("div", { class: "list" }, data.items.map(renderBookRow))
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
        data.totalPages > 1
          ? h(
              "div",
              { class: "pager" },
              h(
                "button",
                {
                  class: "btn small",
                  type: "button",
                  disabled: data.page <= 1 || state.catalogLoading,
                  onclick: () => submitSearch(data.page - 1, data.preset),
                },
                icon("left"),
                "上一頁",
              ),
              h(
                "span",
                { class: "meta" },
                `${formatNumber(data.page)} / ${formatNumber(data.totalPages)}`,
              ),
              h(
                "button",
                {
                  class: "btn small",
                  type: "button",
                  disabled: data.page >= data.totalPages || state.catalogLoading,
                  onclick: () => submitSearch(data.page + 1, data.preset),
                },
                "下一頁",
                icon("right"),
              ),
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
      const renewableAny = acct.checkouts.some((c) => c.renewable);
      panelContent = h(
        "section",
        { class: "section" },
        h(
          "div",
          { class: "list" },
          acct.checkouts.length
            ? acct.checkouts.map((loan) =>
                h(
                  "div",
                  { class: "row" },
                  loan.renewable
                    ? h("input", {
                        type: "checkbox",
                        checked: state.selectedRenewIds.has(loan.id),
                        "aria-label": `選擇續借 ${loan.title}`,
                        onchange: (e) => {
                          if (e.target.checked) state.selectedRenewIds.add(loan.id);
                          else state.selectedRenewIds.delete(loan.id);
                          render();
                        },
                      })
                    : h("div", { class: "row-icon accent" }, icon("book")),
                  h(
                    "div",
                    { style: "min-width:0" },
                    h("div", { class: "row-title" }, loan.title),
                    h(
                      "div",
                      { class: "row-sub num" },
                      [loan.callNumber, loan.renewals].filter(Boolean).join(" · "),
                    ),
                  ),
                  h(
                    "div",
                    { class: "row-end" },
                    h("span", { class: "chip accent num" }, loan.dueDate || "借閱中"),
                  ),
                ),
              )
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

    const roleSelect = h(
      "select",
      {
        class: "select",
        id: "carrelRole",
        onchange: (e) => {
          draft.role = e.target.value;
        },
      },
      ["學生", "研究生", "專任教師"].map((r) =>
        h("option", { value: r, selected: currentRole === r }, r),
      ),
    );
    const roomSelect = h(
      "select",
      {
        class: "select",
        id: "carrelRoom",
        onchange: (e) => {
          draft.room = e.target.value;
        },
      },
      defaults.rooms.map((r) =>
        h("option", { value: r.value, selected: currentRoom === r.value }, r.label),
      ),
    );
    const periodSelect = h(
      "select",
      {
        class: "select",
        id: "carrelPeriod",
        onchange: (e) => {
          draft.timePeriod = e.target.value;
        },
      },
      defaults.periods.map((p) =>
        h("option", { value: p.value, selected: currentPeriod === p.value }, p.label),
      ),
    );
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
  // Root Mount + Lazy Data Trigger

  const mainEl = h("main");
  const rootWrap = h("div", { id: "libraryApp" });
  document.body.append(rootWrap, modalEl);

  function render() {
    const route = matchRoute(new URL(location.href)) || { name: "home" };
    if (route.name === "catalog") {
      syncCatalogUrlParams();
      if (!state.catalogData && !state.catalogLoading && !state.catalogError) {
        void runCatalogSearch();
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
      loans: "借閱帳戶 · 圖書館",
      rooms: "空間預約 · 圖書館",
      resources: "電子資源 · 圖書館",
    };
    document.title = `${titles[route.name] || "圖書館"} · NUTC Portal`;

    let view;
    if (route.name === "catalog") view = renderCatalogView();
    else if (route.name === "loans") view = renderLoansView();
    else if (route.name === "rooms") view = renderRoomsView();
    else if (route.name === "resources") view = renderResourcesView();
    else view = renderHomeView();

    let activeInputState = null;
    if (!activeModal && document.activeElement && mainEl.contains(document.activeElement)) {
      const el = document.activeElement;
      if ((el.tagName === "INPUT" || el.tagName === "SELECT") && el.id) {
        activeInputState = {
          id: el.id,
          start: typeof el.selectionStart === "number" ? el.selectionStart : null,
          end: typeof el.selectionEnd === "number" ? el.selectionEnd : null,
        };
      }
    }

    mainEl.replaceChildren(
      view,
      h(
        "p",
        { class: "footer-link" },
        h("a", { href: "/" }, "NUTC Portal"),
        " · ",
        h(
          "a",
          { href: "/go/library", target: "_blank", rel: "noopener" },
          "在官方圖書館開啟",
        ),
      ),
    );
    mainEl.className = "enter";

    rootWrap.replaceChildren(renderHeader(route.name), mainEl);

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
    await loadOverview();
    render();
  })();
})();
