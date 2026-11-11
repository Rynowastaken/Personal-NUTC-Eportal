// NUTC Portal AIS: a student-first rebuild of the school's student system,
// served by the portal under /ais. The server keeps the AIS session, scrapes
// the pages once per overview, and this page renders them in the dashboard's
// visual language. Anything not rebuilt keeps an explicit link to AIS.
(() => {
  "use strict";

  const BASE = "/ais";
  const AIS = "https://ais.nutc.edu.tw";
  const TZ = "Asia/Taipei";
  const ROUTES = { "": "home", schedule: "schedule", grades: "grades", absences: "absences", announcements: "announcements", profile: "profile", services: "services" };
  const NAV = [
    ["home", "總覽"],
    ["schedule", "課表"],
    ["grades", "成績"],
    ["absences", "缺曠"],
    ["announcements", "公告"],
    ["profile", "個人"],
    ["services", "服務"],
  ];

  // ---------------------------------------------------------------------------
  // Routing

  function matchRoute(url) {
    if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return null;
    const rest = url.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
    const course = rest.match(/^course\/(\d+)$/);
    if (course) {
      const params = url.searchParams || new URL(url.href).searchParams;
      return {
        name: "course",
        ccid: Number(course[1]),
        sem: params.get("sem") || "",
      };
    }
    return { name: ROUTES[rest] || "home" };
  }

  function hrefFor(name) {
    return name === "home" ? BASE : `${BASE}/${name}`;
  }

  function courseHref(ccid, sem) {
    return `${BASE}/course/${ccid}?sem=${encodeURIComponent(sem || "")}`;
  }

  function navigate(href, { replace = false } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) {
      location.assign(url.href);
      return;
    }
    history[replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search);
    render();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.target && link.target !== "_self") return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) return;
    event.preventDefault();
    navigate(url.href);
  });

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      render();
    }, 0);
  }
  window.addEventListener("popstate", scheduleRender);

  // ---------------------------------------------------------------------------
  // DOM helpers

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === "class") el.className = value;
        else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
        else if (key === "html") el.innerHTML = value;
        else el.setAttribute(key, value === true ? "" : value);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      el.append(child instanceof Node ? child : String(child));
    }
    return el;
  }

  // Lucide icon paths (ISC licence), drawn at one stroke weight.
  const ICONS = {
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
    "graduation-cap": '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.59 9.084a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    id: '<rect width="20" height="16" x="2" y="4" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M6 16c0-1.1.9-2 2-2h.5a2 2 0 0 1 2 2"/><path d="M14 9h4"/><path d="M14 13h4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    spark: '<path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  };

  function icon(name) {
    const span = document.createElement("span");
    span.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
    return span.firstChild;
  }

  function spark() {
    const svg = icon("spark");
    svg.classList.add("claude-spark");
    return svg;
  }

  function richText(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select").forEach((node) => node.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const badUrl = (name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value);
        if (name.startsWith("on") || name === "style" || name === "class" || name === "srcset" || badUrl) {
          el.removeAttribute(attr.name);
        } else if (name === "href" || name === "src") {
          try {
            el.setAttribute(attr.name, new URL(attr.value, `${AIS}/student/`).href);
          } catch {
            el.removeAttribute(attr.name);
          }
        }
      }
      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });
    const box = doc.body.firstChild;
    box.className = "prose";
    return document.importNode(box, true);
  }

  // ---------------------------------------------------------------------------
  // Data

  let overviewData = null;
  let overviewAt = 0;
  let overviewPromise = null;
  let overviewRefresh = null;
  let gradesSemester = null;

  async function getJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    let body = null;
    try {
      body = await response.json();
    } catch {}
    if (!response.ok) {
      const error = new Error(body?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = body?.code;
      throw error;
    }
    return body;
  }

  function loadOverview({ force = false } = {}) {
    if (!force && overviewData && Date.now() - overviewAt < 5 * 60_000) {
      return Promise.resolve(overviewData);
    }
    if (overviewPromise) return overviewPromise;
    if (force) overviewRefresh = true;

    overviewPromise = getJson(`/api/ais/overview${force ? "?refresh=1" : ""}`)
      .then((data) => {
        overviewData = data;
        overviewAt = Date.now();
        return data;
      })
      .finally(() => {
        overviewPromise = null;
        overviewRefresh = null;
      });
    return overviewPromise;
  }

  const announcementPages = new Map();

  async function loadAnnouncements(page = 1, { force = false } = {}) {
    if (!force && announcementPages.has(page)) return announcementPages.get(page);
    const data = await getJson(`/api/ais/announcements?page=${page}${force ? "&refresh=1" : ""}`);
    announcementPages.set(page, data);
    return data;
  }

  // ---------------------------------------------------------------------------
  // Dates and schedule helpers

  const WEEKDAY_INDEX = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };

  function todayIndex() {
    const label = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date());
    return WEEKDAY_INDEX[label] ?? 0;
  }

  function nowMinutes() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    return hour * 60 + minute;
  }

  function parseClock(value) {
    const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function todayClasses(schedule) {
    if (!schedule?.periods) return [];
    const day = todayIndex();
    const now = nowMinutes();
    const classes = [];
    for (const period of schedule.periods) {
      const course = period.days?.[day];
      if (!course?.name) continue;
      const [startText, endText] = String(period.time || "").split("~");
      const start = parseClock(startText);
      const end = parseClock(endText);
      classes.push({
        slot: period.slot,
        time: period.time,
        startText,
        endText,
        start,
        end,
        course,
        current: start != null && end != null && now >= start && now <= end,
      });
    }
    return classes;
  }

  function todayBlocks(schedule) {
    const blocks = [];
    for (const item of todayClasses(schedule)) {
      const last = blocks[blocks.length - 1];
      const sameCourse =
        last &&
        last.course.name === item.course.name &&
        (last.course.room || "") === (item.course.room || "");
      if (sameCourse) {
        last.slots.push(item.slot);
        last.endText = item.endText;
        last.end = item.end;
        last.current = last.current || item.current;
      } else {
        blocks.push({ ...item, slots: [item.slot] });
      }
    }
    return blocks;
  }

  function blockLabel(block) {
    if (block.slots.length <= 1) return `第 ${block.slots[0]} 節`;
    return `第 ${block.slots[0]}–${block.slots[block.slots.length - 1]} 節`;
  }

  function todayLabel() {
    return new Intl.DateTimeFormat("zh-TW", {
      timeZone: TZ,
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date());
  }

  function greeting() {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    if (hour >= 5 && hour < 11) return "早安";
    if (hour >= 11 && hour < 18) return "午安";
    return "晚安";
  }

  const PRIVACY_KEY = "eportal.ais.privacy.v1";

  function privacyHidden() {
    try {
      return localStorage.getItem(PRIVACY_KEY) !== "shown";
    } catch {
      return true;
    }
  }

  function setPrivacyHidden(hidden) {
    try {
      localStorage.setItem(PRIVACY_KEY, hidden ? "hidden" : "shown");
    } catch {
      // The choice still applies to this render when storage is unavailable.
    }
    render();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === PRIVACY_KEY) scheduleRender();
  });

  function courseTone(name) {
    let hash = 0;
    for (const char of String(name || "")) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return `--tone:var(--tone-${(hash % 6) + 1})`;
  }

  function creditNumber(value) {
    const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(number) ? number : 0;
  }

  function numberOrDash(value, { zeroDash = false } = {}) {
    if (value == null || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (zeroDash && number === 0) return "—";
    return String(number);
  }

  function statusCode(code) {
    const raw = String(code || "").trim();
    if (!raw) return { key: "na", label: "—", full: "" };
    const first = raw[0];
    const map = {
      P: { key: "pass", label: "P" },
      T: { key: "pass", label: "T" },
      "?": { key: "doing", label: "?" },
      F: { key: "fail", label: "F" },
      W: { key: "fail", label: "W" },
      N: { key: "na", label: "N" },
      "-": { key: "na", label: "—" },
    };
    return { ...(map[first] || { key: "na", label: first }), full: raw };
  }

  function gradePill(info) {
    return h("span", { class: `grade-pill ${info?.state || "pending"}` }, info?.label || "—");
  }

  // ---------------------------------------------------------------------------
  // Shell

  const menu = h("div", { class: "menu", hidden: true, role: "menu" });
  const avatar = h("span", { class: "avatar" }, icon("user"));
  const userButton = h(
    "button",
    {
      class: "user-btn",
      type: "button",
      "aria-haspopup": "menu",
      "aria-label": "選單",
      "aria-expanded": "false",
      onclick: (event) => {
        event.stopPropagation();
        const open = menu.hidden;
        menu.hidden = !open;
        userButton.setAttribute("aria-expanded", String(open));
      },
    },
    avatar,
  );

  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target)) {
      menu.hidden = true;
      userButton.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      menu.hidden = true;
      userButton.setAttribute("aria-expanded", "false");
      userButton.focus();
    }
  });

  const navLinks = new Map(
    NAV.map(([name, label]) => [name, h("a", { href: hrefFor(name) }, label)]),
  );
  const nav = h("nav", { class: "nav", "aria-label": "主要" }, [...navLinks.values()]);
  const main = h("main", { id: "main" });

  document.body.append(
    h(
      "header",
      { class: "bar" },
      h(
        "div",
        { class: "bar-in" },
        h(
          "a",
          { class: "brand", href: BASE, "aria-label": "學生管理首頁" },
          h("span", { class: "brand-mark", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")),
          h("span", { class: "brand-text" }, "學生管理"),
        ),
        nav,
        h("div", { class: "bar-end" }, userButton, menu),
      ),
    ),
    main,
  );

  function renderMenu() {
    const profile = overviewData?.profile;
    const hidden = privacyHidden();
    menu.replaceChildren(
      h(
        "div",
        { class: "menu-note" },
        hidden
          ? ["隱私模式已開啟", h("br"), "個人資訊已隱藏"]
          : [
              profile?.name ? `${profile.name}${profile.gender ? ` · ${profile.gender}` : ""}` : "NUTC 學生管理",
              h("br"),
              profile?.studentId || "資料由 AIS 提供",
            ],
      ),
      h("a", { href: "/", role: "menuitem" }, icon("home"), "回到 Portal"),
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          onclick: () => setPrivacyHidden(!hidden),
        },
        icon(hidden ? "eye" : "eye-off"),
        hidden ? "顯示個人資訊" : "隱藏個人資訊",
      ),
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          onclick: () => {
            menu.hidden = true;
            userButton.setAttribute("aria-expanded", "false");
            void refreshAll();
          },
        },
        icon("refresh"),
        "重新整理資料",
      ),
      h("div", { class: "menu-sep" }),
      h("a", { href: "/go/ais", target: "_blank", rel: "noopener", role: "menuitem" }, icon("external"), "在 AIS 開啟"),
    );
  }

  async function refreshAll() {
    if (matchRoute(location)?.name === "announcements") {
      try {
        await loadAnnouncements(announcementPage, { force: true });
      } catch {}
      render();
      return;
    }
    try {
      await loadOverview({ force: true });
      render();
    } catch (error) {
      main.replaceChildren(errorView(error));
    }
  }

  // ---------------------------------------------------------------------------
  // Shared pieces

  function chip(label, tone = "") {
    return h("span", { class: `chip${tone ? ` ${tone}` : ""}` }, label);
  }

  function metaRow(parts, className = "") {
    return h(
      "div",
      { class: `meta-row${className ? ` ${className}` : ""}` },
      parts
        .filter((part) => part != null && part !== "")
        .map((part, index) =>
          h(
            "span",
            { class: "meta-part" },
            index ? h("span", { class: "dot", "aria-hidden": "true" }) : null,
            part,
          ),
        ),
    );
  }

  function statCard({ label, value, unit, sub, iconName }) {
    return h(
      "div",
      { class: "stat" },
      h("div", { class: "stat-top" }, h("span", null, label), icon(iconName)),
      h("div", { class: "stat-value num" }, value, unit ? h("small", null, unit) : null),
      h("div", { class: "stat-sub" }, sub || ""),
    );
  }

  function emptyBlock(title, text, iconName = "check") {
    return h(
      "div",
      { class: "empty" },
      icon(iconName),
      h("strong", null, title),
      text || null,
    );
  }

  function section(title, content, { id, count, action } = {}) {
    return h(
      "section",
      { class: "section", ...(id ? { id } : {}) },
      h(
        "div",
        { class: "section-head" },
        h("h2", null, title, count != null ? h("span", { class: "count num" }, count) : null),
        action || null,
      ),
      content,
    );
  }

  function pageHead(title, parts, side) {
    return h(
      "div",
      { class: "hero" },
      h("div", null, h("h1", null, title), metaRow(parts)),
      side ? h("div", { class: "hero-side" }, side) : null,
    );
  }

  function footer() {
    return h(
      "div",
      { class: "footer-link" },
      h("a", { href: "/" }, "NUTC Portal"),
      " · ",
      h("a", { href: "/go/ais", target: "_blank", rel: "noopener" }, "在 AIS 開啟"),
    );
  }

  // ---------------------------------------------------------------------------
  // Overview

  function heroFor(data) {
    const profile = data.profile;
    const name = profile?.name || "同學";
    const parts = [
      profile?.studentId,
      [profile?.division, profile?.className].filter(Boolean).join(" ") || null,
      data.progress?.program || null,
    ];
    const hidden = privacyHidden();
    return h(
      "div",
      { class: "hero" },
      h(
        "div",
        null,
        h("h1", null, spark(), " ", hidden ? greeting() : `${greeting()}，${name}`),
        hidden
          ? h("div", { class: "hero-private" }, icon("eye-off"), h("span", null, "個人資訊已隱藏"))
          : metaRow(parts),
      ),
      h(
        "div",
        { class: "hero-side" },
        h("div", { class: "hero-date" }, todayLabel()),
        h("div", { class: "hero-term" }, data.termLabel || "目前學期"),
        h(
          "button",
          {
            class: "hero-privacy",
            type: "button",
            onclick: () => setPrivacyHidden(!hidden),
          },
          icon(hidden ? "eye" : "eye-off"),
          hidden ? "顯示個人資訊" : "隱藏個人資訊",
        ),
      ),
    );
  }

  function overviewStats(data) {
    const periods = todayClasses(data.schedule);
    const blocks = todayBlocks(data.schedule);
    const current = periods.find((item) => item.current);
    const next = current || periods.find((item) => item.start != null && item.start > nowMinutes());
    const progress = data.progress;
    const requirements = progress?.requirements || {};
    const earned = progress?.earned || {};
    const expected = progress?.expected || {};
    const summary = data.absences?.summary || {};
    const grades = data.grades?.semesters?.find((semester) => semester.value === data.grades.activeSemester);
    const average = grades?.rows?.length ? Number(grades.summary?.average) : 0;

    return h(
      "div",
      { class: "stat-grid" },
      statCard({
        label: "今天課程",
        value: blocks.length,
        unit: "門",
        sub: next
          ? current
            ? `現在 ${next.course.name}`
            : `下一堂 ${next.startText} ${next.course.name}`
          : blocks.length
            ? `共 ${periods.length} 節，已結束`
            : "今天沒有課",
        iconName: "calendar",
      }),
      statCard({
        label: "畢業學分",
        value: `${numberOrDash(earned.requiredCredits, { zeroDash: false })}`,
        unit: `/ ${numberOrDash(requirements.requiredCredits)}`,
        sub: `預期可修 ${numberOrDash(expected.requiredCredits)} 學分`,
        iconName: "graduation-cap",
      }),
      statCard({
        label: "缺曠",
        value: numberOrDash(summary.absent),
        unit: "曠課",
        sub: `遲到 ${numberOrDash(summary.late)} · 請假 ${numberOrDash(summary.leaveTotal)}`,
        iconName: "clipboard",
      }),
      statCard({
        label: "學期平均",
        value: average > 0 ? average.toFixed(1).replace(/\.0$/, "") : "—",
        sub: grades?.rows?.length ? `班級排名 ${numberOrDash(grades.summary?.rank)}` : "尚未公布成績",
        iconName: "chart",
      }),
    );
  }

  function todaySection(data) {
    const blocks = todayBlocks(data.schedule);
    let content;
    if (!data.schedule) {
      content = h(
        "div",
        { class: "list" },
        h(
          "div",
          { class: "empty" },
          icon("alert"),
          h("strong", null, "課表暫時無法讀取"),
          data.errors?.schedule || "請稍後重新整理。",
        ),
      );
    } else if (!blocks.length) {
      content = h("div", { class: "list" }, emptyBlock("今天沒有課", "好好休息，或先看看接下來的作業。", "check"));
    } else {
      content = h(
        "div",
        { class: "list" },
        blocks.map((item) =>
          h(
            "button",
            {
              class: `row${item.current ? " today-row current" : ""}`,
              type: "button",
              onclick: () => openCourseDialog(item.course, data),
            },
            h(
              "span",
              { class: "today-time num" },
              h("b", null, item.startText),
              h("span", null, item.endText),
            ),
            h(
              "span",
              { style: "min-width:0" },
              h("div", { class: "row-title" }, item.course.name),
              h("div", { class: "row-sub" }, [item.course.teacher, item.course.room].filter(Boolean).join(" · ") || "—"),
            ),
            h("span", { class: "row-end" }, item.current ? chip("現在", "accent") : chip(blockLabel(item))),
          ),
        ),
      );
    }

    return section("今天的課", content, {
      count: blocks.length || null,
      action: h("a", { class: "btn ghost small", href: hrefFor("schedule") }, "整週課表", icon("right")),
    });
  }

  function announcementRow(item, { compact = false } = {}) {
    const types = String(item.type || "")
      .split(/[,，]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2);
    return h(
      "button",
      { class: "row", type: "button", onclick: () => openAnnouncement(item.id) },
      h("span", { class: "row-icon accent" }, icon("bell")),
      h(
        "span",
        { style: "min-width:0" },
        h("div", { class: "announce-title" }, item.title || "（沒有標題）"),
        h(
          "div",
          { class: "announce-meta" },
          item.unit ? chip(item.unit, "accent") : null,
          types.map((type) => chip(type)),
        ),
      ),
      h("span", { class: "row-end" }, compact ? null : h("span", { class: "chev" }, icon("right"))),
    );
  }

  function announcementsSection(data) {
    const list = data.announcements?.items || [];
    const content = list.length
      ? h("div", { class: "list announce-list" }, list.slice(0, 5).map((item) => announcementRow(item, { compact: true })))
      : h(
          "div",
          { class: "list" },
          h(
            "div",
            { class: "empty" },
            icon("bell"),
            h("strong", null, "目前沒有公告"),
            data.errors?.announcements || "有新公告時會出現在這裡。",
          ),
        );

    return section("最新公告", content, {
      count: data.announcements?.total || null,
      action: h("a", { class: "btn ghost small", href: hrefFor("announcements") }, "所有公告", icon("right")),
    });
  }

  function progressSection(progress, { id } = {}) {
    if (!progress) {
      return section(
        "修業進度",
        h(
          "div",
          { class: "notice" },
          icon("alert"),
          h("span", null, "修業進度暫時無法讀取，稍後重新整理即可。"),
        ),
        { id },
      );
    }

    const requirements = progress.requirements || {};
    const earned = progress.earned || {};
    const expected = progress.expected || {};
    const rows = [
      ["必修學分", earned.requiredCredits, requirements.requiredCredits, "", expected.requiredCredits],
      ["選修學分", earned.electiveCredits, requirements.electiveCredits, "honey", expected.electiveCredits],
      ["跨系選修", earned.crossDepartmentCredits, requirements.crossDepartmentCredits, "success", expected.crossDepartmentCredits],
    ];

    const card = h(
      "div",
      { class: "progress-card" },
      h(
        "div",
        { class: "progress-grid" },
        rows.map(([label, value, target, tone, expectedValue]) => {
          const current = creditNumber(value);
          const total = creditNumber(target);
          const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
          return h(
            "div",
            { class: "progress-item" },
            h(
              "div",
              { class: "progress-label" },
              h("span", null, label),
              h("b", null, `${current} / ${total || "—"}`),
            ),
            h(
              "span",
              { class: "bar-track", role: "img", "aria-label": `${label} ${pct}%` },
              h("span", { class: `bar-fill${tone ? ` ${tone}` : ""}`, style: `width:${pct}%` }),
            ),
            h("div", { class: "meta", style: "margin-top:5px;font-size:11.5px" }, `預期 ${numberOrDash(expectedValue)} 學分`),
          );
        }),
      ),
      h(
        "div",
        { class: "progress-foot" },
        chip(`語言門檻 ${earned.languageThreshold || "—"}`),
        chip(`系定門檻 ${earned.departmentThreshold || "—"}`),
        chip(earned.generalEducation || "博雅通識 —"),
      ),
    );

    return section(
      "修業進度",
      card,
      { id },
    );
  }

  function quickLinks() {
    const items = [
      ["schedule", "課表", "這一週的教室與時間", "calendar"],
      ["grades", "成績", "分數、學分與排名", "chart"],
      ["absences", "缺曠", "曠課、遲到與請假", "clipboard"],
      ["announcements", "公告", "學校與系辦的最新消息", "bell"],
      ["profile", "個人資料", "學籍與聯絡資訊", "user"],
      ["services", "更多服務", "抵免、申請、社團與健康", "grid"],
    ];
    return section(
      "快速前往",
      h(
        "div",
        { class: "quick-grid" },
        items.map(([name, title, sub, iconName]) =>
          h(
            "a",
            { class: "quick", href: hrefFor(name) },
            h("span", { class: "quick-icon" }, icon(iconName)),
            h("span", { style: "min-width:0" }, h("div", { class: "quick-title" }, title), h("div", { class: "quick-sub" }, sub)),
            h("span", { class: "chev" }, icon("right")),
          ),
        ),
      ),
    );
  }

  async function viewHome() {
    setTitle("總覽");
    const data = await loadOverview();
    renderMenu();

    return [
      heroFor(data),
      overviewStats(data),
      h("div", { class: "home-grid" }, todaySection(data), announcementsSection(data)),
      progressSection(data.progress, { id: "progress" }),
      quickLinks(),
    ];
  }

  // ---------------------------------------------------------------------------
  // Schedule

  function weekSchedule(schedule, data) {
    const dayLabels = schedule.dayLabels || ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
    const periods = schedule.periods || [];
    const today = todayIndex();
    const activeDays = dayLabels
      .map((_, index) => index)
      .filter((index) => index < 5 || periods.some((period) => period.days?.[index]?.name));
    const used = periods
      .map((period, index) => ({ period, index }))
      .filter(({ period }) => activeDays.some((day) => period.days?.[day]?.name));
    const lastPeriod = Math.max(8, (used[used.length - 1]?.index ?? 7) + 1);
    const shown = periods.slice(0, lastPeriod);

    const grid = h("div", {
      class: "week",
      style: `grid-template-columns:74px repeat(${activeDays.length},minmax(112px,1fr));min-width:${74 + activeDays.length * 112}px`,
    });
    grid.append(h("div", { class: "week-head corner" }, "節次"));
    for (const day of activeDays) {
      grid.append(h("div", { class: `week-head${day === today ? " today" : ""}` }, dayLabels[day]));
    }

    const sameCourse = (a, b) => Boolean(a?.name) && a?.name === b?.name && a?.room === b?.room;

    shown.forEach((period, rowIndex) => {
      grid.append(
        h(
          "div",
          { class: "week-time" },
          h("b", null, period.slot),
          h("span", null, String(period.time || "").split("~")[0]),
          h("span", null, String(period.time || "").split("~")[1]),
        ),
      );

      for (const day of activeDays) {
        const course = period.days?.[day];
        const cell = h("div", { class: `week-cell${day === today ? " today" : ""}` });
        if (course?.name) {
          const before = shown[rowIndex - 1]?.days?.[day];
          const after = shown[rowIndex + 1]?.days?.[day];
          const first = !sameCourse(before, course);
          const last = !sameCourse(after, course);
          const span = first && !last ? " span-start" : !first && !last ? " span-mid" : !first && last ? " span-end" : "";
          cell.append(
            h(
              "button",
              {
                class: `course-block${span}`,
                type: "button",
                style: courseTone(course.name),
                title: `${course.name}${course.room ? ` · ${course.room}` : ""}`,
                onclick: () => openCourseDialog(course, data),
              },
              h("span", { class: "course-name" }, course.name),
              h("span", { class: "course-meta" }, [course.room, course.teacher].filter(Boolean).join(" · ")),
            ),
          );
        }
        grid.append(cell);
      }
    });

    return h(
      "div",
      { class: "week-wrap" },
      h("div", { class: "week-scroll" }, grid),
      h("div", { class: "week-hint" }, "左右滑動查看整週課表"),
    );
  }

  function courseCards(schedule) {
    const courses = schedule.courses?.length
      ? schedule.courses
      : [...new Map(
          schedule.periods
            .flatMap((period) => period.days || [])
            .filter((course) => course?.name)
            .map((course) => [course.name, course]),
        ).values()].map((course) => ({ ...course, credits: "" }));

    if (!courses.length) return h("div", { class: "list" }, emptyBlock("這學期沒有課程", "", "book"));
    return h(
      "div",
      { class: "course-cards" },
      courses.map((course) =>
        h(
          "div",
          { class: "course-card" },
          h(
            "div",
            { class: "course-card-top" },
            h("span", { class: "course-card-name" }, course.name),
            course.credits ? chip(`${course.credits} 學分`) : null,
          ),
          h("div", { class: "course-card-meta" }, [course.teacher, course.timeRoom].filter(Boolean).join(" · ") || "—"),
          course.required ? h("div", { class: "meta", style: "font-size:12px" }, course.required === "必" ? "必修" : "選修") : null,
        ),
      ),
    );
  }

  async function viewSchedule() {
    setTitle("課表");
    const data = await loadOverview();
    renderMenu();
    const schedule = data.schedule;
    if (!schedule) {
      return [
        pageHead("課表", [data.termLabel, "課表暫時無法讀取"]),
        h(
          "div",
          { class: "notice" },
          icon("alert"),
          h("span", null, data.errors?.schedule || "AIS 課表暫時沒有回應，請稍後重新整理。"),
        ),
      ];
    }

    const credits = (schedule.courses || []).reduce((sum, course) => sum + creditNumber(course.credits), 0);
    return [
      pageHead("課表", [schedule.termLabel || data.termLabel, `${schedule.courses?.length || 0} 門課`, credits ? `${credits} 學分` : null]),
      h("div", { class: "section" }, weekSchedule(schedule, data)),
      section("本學期課程", courseCards(schedule), { count: schedule.courses?.length || null }),
    ];
  }

  function courseCopy(label, text) {
    return h(
      "div",
      { class: "course-copy" },
      h("h3", null, label),
      h("p", { class: "course-text" }, text),
    );
  }

  async function viewCourse(route) {
    const data = await loadOverview();
    renderMenu();
    const info =
      (data.schedule?.courses || []).find(
        (course) => Number(course.ccid) === Number(route.ccid),
      ) || null;
    const termMatch = String(data.termLabel || "").match(
      /(\d{2,3})年\(([上下])\)/,
    );
    const sem =
      route.sem ||
      (termMatch
        ? `${termMatch[1]}${termMatch[2] === "上" ? 1 : 2}`
        : "");
    const detailPath = `/student/courses/course_details.aspx?sem=${encodeURIComponent(sem)}&ccid=${route.ccid}`;
    const back = h(
      "a",
      { class: "back", href: hrefFor("schedule") },
      icon("left"),
      "回課表",
    );

    let detail = null;
    let error = null;
    try {
      detail = await getJson(
        `/api/ais/course/${route.ccid}?sem=${encodeURIComponent(sem)}`,
      );
    } catch (loadError) {
      error = loadError;
    }

    const courseName = detail?.name || info?.name || "課程詳情";
    setTitle(courseName);

    if (!detail) {
      return [
        back,
        pageHead(courseName, [data.termLabel]),
        h(
          "div",
          { class: "notice" },
          icon("alert"),
          h("span", null, error?.message || "課程資料暫時無法讀取。"),
        ),
        h(
          "div",
          { class: "actions" },
          h(
            "a",
            {
              class: "btn",
              href: "/go/ais",
              target: "ais-page",
              onclick: (event) => openAisPage(event, detailPath),
            },
            icon("external"),
            "在 AIS 開啟",
          ),
          h("a", { class: "btn ghost", href: hrefFor("schedule") }, "回課表"),
        ),
      ];
    }

    const required =
      info?.required === "必"
        ? "必修"
        : info?.required === "選"
          ? "選修"
          : info?.required || "—";
    const facts = [
      ["教師", detail.teacher || info?.teacher || "—"],
      [
        "學分",
        info?.credits
          ? `${info.credits} 學分${info.hours && info.hours !== info.credits ? ` · ${info.hours} 小時` : ""}`
          : "—",
      ],
      ["修別", required],
      ["上課時間", info?.timeRoom || "—"],
      [
        "開課班級",
        detail.className || info?.className || data.profile?.className || "—",
      ],
      ["學期", data.termLabel || "—"],
    ];

    const intro = [];
    if (detail.outline) intro.push(courseCopy("課程說明", detail.outline));
    if (detail.objective) intro.push(courseCopy("具體教學目標", detail.objective));
    if (!intro.length) {
      intro.push(emptyBlock("尚未填寫課程簡介", "AIS 還沒有這門課的介紹。", "book"));
    }

    const books = [];
    if (detail.books?.length) {
      books.push(
        h(
          "div",
          { class: "list" },
          detail.books.map((book) =>
            h(
              "div",
              { class: "row" },
              h("span", { class: "row-icon accent" }, icon("book")),
              h(
                "span",
                { style: "min-width:0" },
                h("div", { class: "row-title" }, book.title),
                h(
                  "div",
                  { class: "row-sub" },
                  [book.author, book.publisher, book.year, book.edition, book.place]
                    .filter(Boolean)
                    .join(" · "),
                ),
              ),
            ),
          ),
        ),
      );
    }
    if (detail.reference) books.push(courseCopy("參考資料", detail.reference));
    if (!books.length) {
      books.push(emptyBlock("未指定教科書", "AIS 沒有列出這門課的用書。", "book"));
    }

    const assessment = [];
    if (detail.assessment?.items?.length) {
      assessment.push(
        h(
          "div",
          { class: "assessment-list" },
          detail.assessment.items.map((item) => {
            const percent = Math.max(
              0,
              Math.min(
                100,
                Number(String(item.weight).replace(/[^\d.]/g, "")) || 0,
              ),
            );
            return h(
              "div",
              { class: "assessment-row" },
              h(
                "div",
                { class: "assessment-head" },
                h("span", null, item.label),
                h("b", { class: "num" }, item.weight || "—"),
              ),
              h(
                "div",
                { class: "assessment-bar", "aria-hidden": "true" },
                h("i", { style: `width:${percent}%` }),
              ),
            );
          }),
        ),
      );
    }
    if (detail.assessment?.midtermWarning) {
      assessment.push(
        h(
          "div",
          { class: "leave-chips" },
          chip(`期中預警 ${detail.assessment.midtermWarning}`, "soon"),
        ),
      );
    }
    if (!assessment.length) {
      assessment.push(emptyBlock("尚未公布評分方式", "", "chart"));
    }

    const weeks = detail.weeks?.length
      ? h(
          "div",
          { class: "week-list" },
          detail.weeks.map((week) =>
            h(
              "div",
              { class: "week-item" },
              h("span", { class: "week-no num" }, week.week || "—"),
              h(
                "div",
                { class: "week-body" },
                h("div", { class: "week-topic" }, week.topic || "—"),
                week.note ? h("div", { class: "week-note" }, week.note) : null,
              ),
            ),
          ),
        )
      : emptyBlock("尚未公布授課進度", "", "calendar");

    return [
      back,
      pageHead(
        courseName,
        [detail.englishName, detail.className || info?.className, data.termLabel],
        h(
          "a",
          {
            class: "btn ghost",
            href: "/go/ais",
            target: "ais-page",
            onclick: (event) => openAisPage(event, detailPath),
          },
          icon("external"),
          "在 AIS 開啟",
        ),
      ),
      h(
        "dl",
        { class: "profile-facts course-facts" },
        facts.map(([label, value]) =>
          h(
            "div",
            { class: "profile-fact" },
            h("dt", null, label),
            h("dd", null, value || "—"),
          ),
        ),
      ),
      section("課程簡介", h("div", { class: "course-copy-stack" }, intro)),
      section("用書資訊", h("div", { class: "course-copy-stack" }, books)),
      section("評分方式", h("div", { class: "course-copy-stack" }, assessment)),
      section("授課進度", weeks, { count: detail.weeks?.length || null }),
    ];
  }

  function openCourseDialog(course, data) {
    const info =
      (data.schedule?.courses || []).find(
        (item) => item.name === course.name && (!course.teacher || item.teacher === course.teacher),
      ) || null;
    const termMatch = String(data.termLabel || "").match(/(\d{2,3})年\(([上下])\)/);
    const termCode = termMatch ? `${termMatch[1]}${termMatch[2] === "上" ? 1 : 2}` : "";
    const detailPath =
      info?.ccid && termCode
        ? `/student/courses/course_details.aspx?sem=${termCode}&ccid=${info.ccid}`
        : null;
    const detailHref =
      info?.ccid && termCode ? courseHref(info.ccid, termCode) : null;

    const facts = [
      ["教師", course.teacher || info?.teacher || "—"],
      ["修別", info?.required || "—"],
      ["學分", info?.credits ? `${info.credits} 學分` : "—"],
      ["上課時間", info?.timeRoom || "—"],
      ["開課班級", info?.className || data.profile?.className || "—"],
    ];

    return openDialog({
      title: course.name,
      body: h(
        "div",
        null,
        h(
          "dl",
          { class: "profile-facts", style: "margin-top:0" },
          facts.map(([label, value]) =>
            h("div", { class: "profile-fact" }, h("dt", null, label), h("dd", null, value || "—")),
          ),
        ),
        h(
          "div",
          { class: "actions" },
          detailHref
            ? h(
                "a",
                { class: "btn", href: detailHref },
                icon("book"),
                "課程詳情",
              )
            : null,
          detailPath
            ? h(
                "a",
                {
                  class: "btn ghost",
                  href: "/go/ais",
                  target: "ais-page",
                  onclick: (event) => openAisPage(event, detailPath),
                },
                icon("external"),
                "在 AIS 開啟",
              )
            : null,
          h("button", { class: "btn ghost", type: "button", onclick: () => closeDialog() }, "關閉"),
        ),
      ),
    });
  }

  // ---------------------------------------------------------------------------
  // Grades

  function gradeBody(grades) {
    const semester = grades.semesters?.find((item) => item.value === gradesSemester) || grades.semesters?.[0];
    if (!semester) {
      return h("div", { class: "list" }, emptyBlock("還沒有成績資料", "", "chart"));
    }
    const rows = semester.rows || [];
    const summary = semester.summary || {};
    const average = Number(summary.average);

    const stats = h(
      "div",
      { class: "grade-summary" },
      statCard({ label: "總修習學分", value: numberOrDash(summary.totalCredits), sub: "含學年課" , iconName: "book" }),
      statCard({ label: "實得學分", value: numberOrDash(summary.earnedCredits), sub: "通過與抵免" , iconName: "award" }),
      statCard({ label: "學期平均", value: rows.length && average > 0 ? average.toFixed(1).replace(/\.0$/, "") : "—", sub: "以 AIS 公布為準" , iconName: "chart" }),
      statCard({ label: "班級排名", value: rows.length ? numberOrDash(summary.rank) : "—", sub: "同班排名" , iconName: "users" }),
    );

    const list = rows.length
      ? h(
          "div",
          { class: "list grade-list" },
          rows.map((row) =>
            h(
              "div",
              { class: "row grade-row" },
              h(
                "span",
                { class: "course", style: "min-width:0" },
                h("div", { class: "row-title" }, row.course || "—"),
                h(
                  "div",
                  { class: "row-sub" },
                  [row.required === "必" ? "必修" : row.required === "選" ? "選修" : row.required, row.group && row.group !== "---" ? row.group : null]
                    .filter(Boolean)
                    .join(" · "),
                ),
              ),
              h("span", { class: "class-name" }, row.className || "—"),
              h("span", { class: "credits" }, `${row.credits || "0"} 學分`),
              gradePill(row.gradeInfo),
            ),
          ),
        )
      : h("div", { class: "list" }, emptyBlock("這學期還沒有成績", "成績公布後會自動出現在這裡。", "chart"));

    return [stats, list];
  }

  async function viewGrades() {
    setTitle("成績");
    const data = await loadOverview();
    renderMenu();
    const grades = data.grades || { semesters: [] };
    const semesters = grades.semesters || [];
    if (gradesSemester && !semesters.some((semester) => semester.value === gradesSemester)) gradesSemester = null;
    if (!gradesSemester) gradesSemester = grades.activeSemester || semesters[0]?.value || "";

    const body = h("div");
    const segments = semesters.map((semester) =>
      h(
        "button",
        {
          type: "button",
          "aria-pressed": String(semester.value === gradesSemester),
          onclick: () => {
            gradesSemester = semester.value;
            for (const button of segments) {
              button.setAttribute("aria-pressed", String(button.dataset.value === gradesSemester));
            }
            body.replaceChildren(...gradeBody(grades));
          },
        },
        semester.label || semester.value,
      ),
    );
    segments.forEach((button, index) => {
      button.dataset.value = semesters[index].value;
    });
    body.replaceChildren(...gradeBody(grades));

    const controls = semesters.length
      ? h("div", { class: "toolbar" }, h("div", { class: "seg", role: "group", "aria-label": "學期" }, segments))
      : null;

    return [
      pageHead("成績", [data.progress?.program, data.termLabel, semesters.length ? `${semesters.length} 個學期` : null]),
      controls,
      body,
      progressSection(data.progress, { id: "progress" }),
      checklistSection(data.progress),
      h(
        "div",
        { class: "notice", style: "margin-top:20px" },
        icon("alert"),
        h("span", null, "成績與修業進度以 AIS 公告為準；如果有差異，請以原系統為準。"),
      ),
    ];
  }

  function checklistSection(progress) {
    const courses = progress?.courses || [];
    if (!courses.length) return null;

    const groups = new Map();
    for (const course of courses) {
      const key = String(course.year || "").charAt(0) || "其";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(course);
    }
    const labels = { 一: "一年級", 二: "二年級", 三: "三年級", 四: "四年級", 其: "其他" };

    const passed = (course) => {
      const codes = [course.statusUp, course.statusDown].filter((code) => code && code !== "-");
      return codes.length > 0 && codes.every((code) => /^[PT]/.test(code));
    };

    return section(
      "課程標準",
      h(
        "div",
        { class: "checklist" },
        [...groups.entries()].map(([key, list], index) =>
          h(
            "details",
            { class: "check-year", ...(index === 0 ? { open: true } : {}) },
            h(
              "summary",
              null,
              h("span", null, labels[key] || `${key}年級`),
              h("span", { class: "count num" }, `已通過 ${list.filter(passed).length} / ${list.length}`),
              h("span", { class: "chev" }, icon("right")),
            ),
            h(
              "div",
              { class: "check-year-body" },
              h(
                "div",
                { class: "check-row", style: "color:var(--faint);font-size:11.5px;min-height:32px" },
                h("span", null, "課程"),
                h("span", { class: "check-credit" }, "學分"),
                h("span", { style: "text-align:center" }, "上"),
                h("span", { style: "text-align:center" }, "下"),
              ),
              list.map((course) =>
                h(
                  "div",
                  { class: "check-row" },
                  h(
                    "span",
                    { class: "check-name" },
                    course.name,
                    course.note ? h("small", null, course.note) : null,
                  ),
                  h("span", { class: "check-credit" }, course.credits || "0"),
                  statusDot(course.statusUp),
                  statusDot(course.statusDown),
                ),
              ),
            ),
          ),
        ),
        h(
          "div",
          { class: "legend" },
          h("span", null, h("i", { class: "pass" }), "P 通過 / T 抵免"),
          h("span", null, h("i", { class: "doing" }), "? 修業中"),
          h("span", null, h("i", { class: "fail" }), "F 不及格"),
          h("span", null, h("i"), "N 尚未修習 / — 不須修習"),
        ),
      ),
    );
  }

  function statusDot(code) {
    const status = statusCode(code);
    return h(
      "span",
      { class: `status-dot ${status.key}`, title: status.full || status.label, style: "justify-self:center" },
      status.label,
    );
  }

  // ---------------------------------------------------------------------------
  // Absences

  function absenceSummary(data) {
    const summary = data.absences?.summary || {};
    const leaveTypes = summary.leaveTypes || {};
    const leaveEntries = Object.entries(leaveTypes).filter(([, value]) => Number(value) > 0);
    const conduct = summary.conduct && summary.conduct !== "---" ? summary.conduct : "";
    const chips = [
      ...leaveEntries.map(([label, value]) => chip(`${label} ${value}`, "soon")),
      conduct ? chip(`操行 ${conduct}`, "done") : null,
    ].filter(Boolean);

    return [
      h(
        "div",
        { class: "absence-summary" },
        statCard({ label: "曠課", value: numberOrDash(summary.absent), unit: "節", sub: "每 1 節扣操行 1 分" , iconName: "alert" }),
        statCard({ label: "遲到", value: numberOrDash(summary.late), unit: "節", sub: "每 1 節扣 0.5 分" , iconName: "clock" }),
        statCard({ label: "早退", value: numberOrDash(summary.earlyLeave), unit: "節", sub: "每 1 節扣 0.5 分" , iconName: "clock" }),
        statCard({ label: "請假", value: numberOrDash(summary.leaveTotal), unit: "節", sub: conduct ? `操行 ${conduct}` : "本學期累計" , iconName: "clipboard" }),
      ),
      chips.length ? h("div", { class: "leave-chips" }, chips) : null,
    ].filter(Boolean);
  }

  async function viewAbsences() {
    setTitle("缺曠");
    const data = await loadOverview();
    renderMenu();
    const absences = data.absences;

    if (!absences) {
      return [
        pageHead("缺曠", [data.termLabel]),
        h(
          "div",
          { class: "notice" },
          icon("alert"),
          h("span", null, data.errors?.absences || "缺曠紀錄暫時無法讀取，請稍後重新整理。"),
        ),
      ];
    }

    const items = absences.items || [];
    const list = items.length
      ? h(
          "div",
          { class: "list" },
          items.map((item) =>
            h(
              "div",
              { class: "row" },
              h("span", { class: "row-icon danger" }, icon("clipboard")),
              h(
                "span",
                { style: "min-width:0" },
                h("div", { class: "row-title" }, item.course || "—"),
                h("div", { class: "row-sub" }, [item.className, item.teacher].filter(Boolean).join(" · ") || "—"),
              ),
              h("span", { class: "row-end" }, chip(item.status || "缺曠", /曠課|扣考/.test(item.status) ? "urgent" : "soon")),
            ),
          ),
        )
      : h(
          "div",
          { class: "list" },
          emptyBlock("這學期沒有缺曠紀錄", "目前沒有曠課、遲到或早退紀錄，繼續保持。", "check"),
        );

    return [
      pageHead("缺曠", [absences.termLabel || data.termLabel, `共 ${items.length} 筆紀錄`]),
      ...absenceSummary(data),
      section("缺曠紀錄", list, { count: items.length || null }),
      h(
        "div",
        { class: "notice", style: "margin-top:20px" },
        icon("alert"),
        h("span", null, "曠課 16 節以上會通知家長；操行未達 60 分或曠課超過 45 節，依學則及操行成績考查辦法辦理。"),
      ),
    ];
  }

  // ---------------------------------------------------------------------------
  // Announcements

  let announcementPage = 1;

  function announceList(data, page) {
    const items = data.items || [];
    if (!items.length) {
      return h("div", { class: "list" }, emptyBlock("這一頁沒有公告", "", "bell"));
    }
    return h(
      "div",
      { class: "list announce-list" },
      items.map((item) => announcementRow(item)),
    );
  }

  function pager(data, page, onPage) {
    const pages = Math.max(1, data.pages || 1);
    return h(
      "div",
      { class: "pager" },
      h(
        "button",
        { class: "btn small", type: "button", disabled: page <= 1, onclick: () => onPage(page - 1) },
        icon("left"),
        "上一頁",
      ),
      h("span", { class: "meta num" }, `${page} / ${pages}`),
      h(
        "button",
        { class: "btn small", type: "button", disabled: page >= pages, onclick: () => onPage(page + 1) },
        "下一頁",
        icon("right"),
      ),
    );
  }

  async function viewAnnouncements() {
    setTitle("公告");
    renderMenu();
    const listBox = h("div", { "aria-live": "polite" }, h("div", { class: "list" }, h("div", { class: "empty" }, "正在載入公告…")));
    const pagerBox = h("div");
    const countEl = h("span", { id: "announce-count" });

    const load = async (page, { force = false } = {}) => {
      announcementPage = page;
      listBox.replaceChildren(h("div", { class: "list" }, h("div", { class: "empty" }, "正在載入公告…")));
      try {
        const data = await loadAnnouncements(page, { force });
        listBox.replaceChildren(announceList(data, page));
        pagerBox.replaceChildren(pager(data, page, (next) => void load(next)));
        countEl.textContent = data.total ? `${data.total} 筆` : "";
      } catch (error) {
        listBox.replaceChildren(
          h(
            "div",
            { class: "list" },
            h(
              "div",
              { class: "empty" },
              icon("alert"),
              h("strong", null, "公告暫時無法讀取"),
              error.message || "請稍後重新整理。",
            ),
          ),
        );
        pagerBox.replaceChildren();
      }
    };

    void load(announcementPage);
    return [
      pageHead("公告", ["學校與系辦的最新消息", countEl]),
      listBox,
      pagerBox,
    ];
  }

  async function openAnnouncement(id) {
    const dialog = openDialog({
      title: "公告",
      wide: true,
      body: h("div", { class: "empty" }, "正在載入公告…"),
    });
    try {
      const detail = await getJson(`/api/ais/announcements/${id}`);
      dialog.titleEl.textContent = detail.title || "公告";
      const body = [];
      body.push(metaRow([detail.unit, detail.dateRange]));
      if (detail.bodyHtml) {
        body.push(richText(detail.bodyHtml));
      } else if (detail.bodyText) {
        body.push(h("p", null, detail.bodyText));
      } else {
        body.push(h("p", null, "這則公告沒有內文。"));
      }
      if (detail.attachments?.length) {
        body.push(
          h(
            "div",
            { class: "list", style: "margin-top:16px" },
            detail.attachments.map((attachment) =>
              h(
                "a",
                { class: "row", href: attachment.url, target: "_blank", rel: "noopener" },
                h("span", { class: "row-icon" }, icon("file")),
                h("span", { style: "min-width:0" }, h("div", { class: "row-title" }, attachment.name || "附件"), h("div", { class: "row-sub" }, "附件")),
                h("span", { class: "row-end" }, icon("external")),
              ),
            ),
          ),
        );
      }
      body.push(
        h(
          "p",
          { class: "meta", style: "margin-top:16px" },
          "附件由 AIS 提供；若開啟時需要登入，請直接以 AIS 帳號登入。",
        ),
      );
      dialog.bodyEl.replaceChildren(...body);
    } catch (error) {
      dialog.bodyEl.replaceChildren(
        h(
          "div",
          { class: "empty" },
          icon("alert"),
          h("strong", null, "公告暫時無法讀取"),
          error.message || "請稍後再試。",
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Profile

  function profileFacts(profile, data) {
    const facts = [
      ["學號", profile.studentId || "—", false],
      ["生日", profile.birthday || "—", false],
      ["英文姓名", profile.englishName || "—", false],
      ["性別", profile.gender || "—", false],
      ["行動電話", profile.mobile || "—", false],
      ["聯絡電話", profile.phone || "—", false],
      ["戶籍地址", profile.registeredAddress || "—", true],
      ["郵寄地址", profile.mailingAddress || "—", true],
      ["身分證號", profile.nationalIdMasked || "已隱藏", true, true],
    ];
    return h(
      "dl",
      { class: "profile-facts" },
      facts.map(([label, value, wide, privateValue]) =>
        h(
          "div",
          { class: `profile-fact${wide ? " wide" : ""}` },
          h("dt", null, label),
          h("dd", null, privateValue ? icon("lock") : null, value),
        ),
      ),
    );
  }

  async function viewProfile() {
    setTitle("個人資料");
    const data = await loadOverview();
    renderMenu();
    const profile = data.profile;
    if (!profile) {
      return [
        pageHead("個人資料", [data.termLabel]),
        h(
          "div",
          { class: "notice" },
          icon("alert"),
          h("span", null, data.errors?.profile || "個人資料暫時無法讀取，請稍後重新整理。"),
        ),
      ];
    }

    if (privacyHidden()) {
      return [
        pageHead("個人資料", ["隱私模式已開啟"]),
        h(
          "div",
          { class: "notice" },
          icon("eye-off"),
          h("span", null, "個人資料已隱藏。需要查看時再顯示。"),
        ),
        h(
          "div",
          { class: "actions" },
          h(
            "button",
            { class: "btn primary", type: "button", onclick: () => setPrivacyHidden(false) },
            icon("eye"),
            "顯示個人資料",
          ),
        ),
      ];
    }

    return [
      pageHead("個人資料", [profile.division, profile.className, data.progress?.program]),
      h(
        "div",
        { class: "profile-card" },
        h("div", { class: "profile-avatar" }, String(profile.name || "?").slice(0, 1)),
        h(
          "div",
          { style: "min-width:0" },
          h("div", { class: "profile-name" }, profile.name || "—"),
          metaRow(
            [profile.studentId, profile.division, profile.className],
            "profile-meta",
          ),
        ),
        profile.gender ? chip(profile.gender, "accent") : null,
      ),
      profileFacts(profile, data),
      h(
        "div",
        { class: "notice", style: "margin-top:16px" },
        icon("lock"),
        h("span", null, "基於隱私，身分證號只顯示部分字元；其他資料只會出現在這個頁面，不會寫入紀錄。"),
      ),
      h(
        "div",
        { class: "actions" },
        h("a", { class: "btn primary", href: "/go/ais", target: "_blank", rel: "noopener" }, icon("external"), "在 AIS 編輯資料"),
        h("a", { class: "btn ghost", href: hrefFor("home") }, "回到總覽"),
      ),
    ];
  }

  // ---------------------------------------------------------------------------
  // Services

  const SERVICES = [
    ["課程抵免", "抵免與免修申請紀錄", "/student/transfer/transfer_list.aspx", "book"],
    ["各項申請", "假單、失物協尋、兵役與申請進度", "/student/apps/online_application.aspx", "clipboard"],
    ["獎懲查詢", "獎懲紀錄與操行相關資訊", "/student/discipline/rp_list.aspx", "award"],
    ["工讀賃居", "住宿、工讀與緊急聯絡資訊", "/student/personal_info.aspx", "home"],
    ["健康管理", "衛生保健、諮商與自主管理", "/student/health/index.aspx", "shield"],
    ["社團資訊", "全校社團、我的社團與活動", "/student/stu_club/club_list.aspx", "users"],
    ["問卷調查", "學校問卷與學習適應調查", "/student/ir/ex_questionnaire.aspx", "list"],
    ["獎助生", "獎助生與兼任助理聘僱紀錄", "/student/apps/stu_pt_list.aspx", "graduation-cap"],
    ["外部連結", "WebMail、教學資源與其他服務", "/student/apps/ex_services.aspx", "external"],
  ];

  function openAisPage(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // The anchor itself opens the named AIS tab, so the browser's own
    // navigation is never treated as a blocked popup. Keep that tab's handle,
    // wait for the SSO handoff, then send it to the requested AIS page.
    setTimeout(() => {
      const popup = window.open("", "ais-page");
      if (!popup) return;

      try {
        if (popup.location.href === "about:blank") popup.location.href = "/go/ais";
      } catch {
        // A previous AIS page is already cross-origin; the navigation from the
        // anchor is still replacing it with the launch page.
      }

      const target = `${AIS}${path}`;
      const started = Date.now();
      let crossOriginAt = 0;
      const timer = setInterval(() => {
        if (popup.closed || Date.now() - started > 30_000) {
          clearInterval(timer);
          return;
        }

        let onPortal = true;
        try {
          // Reading the location of a same-origin launch page succeeds; AIS
          // is cross-origin, so the throw marks the completed SSO handoff.
          void popup.location.href;
        } catch {
          onPortal = false;
        }
        if (onPortal) return;

        if (!crossOriginAt) crossOriginAt = Date.now();
        if (Date.now() - crossOriginAt < 3_000) return;

        clearInterval(timer);
        try {
          popup.location.replace(target);
        } catch {
          // The handoff tab keeps the new AIS session from the SSO redirect.
          popup.location.href = target;
        }
      }, 400);
    }, 0);
  }

  async function viewServices() {
    setTitle("服務");
    renderMenu();
    return [
      pageHead("服務", ["抵免、申請、社團與其他學生服務"]),
      section(
        "更多 AIS 功能",
        h(
          "div",
          { class: "service-grid" },
          SERVICES.map(([title, sub, path, iconName]) =>
            h(
              "a",
              {
                class: "service",
                href: "/go/ais",
                target: "ais-page",
                onclick: (event) => openAisPage(event, path),
              },
              h("span", { class: "service-icon" }, icon(iconName)),
              h("span", { class: "service-title" }, title),
              h("span", { class: "service-sub" }, sub),
              h("span", { class: "service-foot" }, "在 AIS 開啟", icon("external")),
            ),
          ),
        ),
      ),
      h(
        "div",
        { class: "notice", style: "margin-top:20px" },
        icon("alert"),
        h("span", null, "這些功能仍由原 AIS 提供；首次開啟會先完成 ePortal 登入，再前往所選功能。"),
      ),
    ];
  }

  // ---------------------------------------------------------------------------
  // Dialog

  let dialog = null;
  let dialogReturnFocus = null;
  let lockScrollY = 0;

  function syncScrollLock() {
    const html = document.documentElement;
    if (dialog) {
      lockScrollY = window.scrollY || html.scrollTop || 0;
      const gap = Math.max(0, window.innerWidth - html.clientWidth);
      html.style.setProperty("--scroll-lock", `${gap}px`);
      html.classList.add("modal-open");
    } else {
      html.classList.remove("modal-open");
      html.style.removeProperty("--scroll-lock");
      const restore = lockScrollY;
      lockScrollY = 0;
      if (restore) window.scrollTo(0, restore);
    }
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.modal.remove();
    dialog = null;
    for (const element of document.querySelectorAll("body > header, body > main")) element.inert = false;
    syncScrollLock();
    const target = dialogReturnFocus;
    dialogReturnFocus = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }

  function openDialog({ title, body, wide = false }) {
    closeDialog();
    dialogReturnFocus = document.activeElement;
    const titleEl = h("h2", { class: "dialog-title", id: "ais-dialog-title" }, title || "");
    const bodyEl = h("div", { class: "dialog-body" }, body || "");
    const closeButton = h(
      "button",
      { class: "dialog-close", type: "button", "aria-label": "關閉", onclick: () => closeDialog() },
      icon("close"),
    );
    const panel = h(
      "div",
      {
        class: `dialog${wide ? " wide" : ""}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "ais-dialog-title",
      },
      h("div", { class: "dialog-head" }, titleEl, closeButton),
      bodyEl,
    );
    const modal = h(
      "div",
      {
        class: "modal",
        onclick: (event) => {
          if (event.target === modal) closeDialog();
        },
      },
      panel,
    );
    document.body.append(modal);
    for (const element of document.querySelectorAll("body > header, body > main")) element.inert = true;
    dialog = { modal, titleEl, bodyEl };
    syncScrollLock();
    closeButton.focus();
    return dialog;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog) {
      event.preventDefault();
      closeDialog();
    }
  });

  // ---------------------------------------------------------------------------
  // Error view

  function errorView(error) {
    const auth = error?.status === 401 || error?.code === "EPORTAL_LOGIN_REQUIRED";
    const busy = error?.status === 409 || error?.code === "EPORTAL_PROFILE_BUSY";
    return h(
      "div",
      { class: "error", role: "alert" },
      icon("alert"),
      h("h1", null, auth ? "需要重新登入" : busy ? "AIS 正在忙碌" : "這頁沒有載入"),
      h(
        "p",
        null,
        auth
          ? "Server ePortal 的登入已逾期，請重新登入後再開啟學生管理。"
          : busy
            ? "AIS 正在處理另一個請求，請稍等幾秒再試一次。"
            : error?.message || "發生未預期的錯誤，請再試一次。",
      ),
      h(
        "div",
        { class: "actions" },
        auth
          ? h("a", { class: "btn primary", href: "/server-login/" }, "登入 Server ePortal")
          : h("button", { class: "btn primary", type: "button", onclick: () => render() }, icon("refresh"), "重試"),
        h("a", { class: "btn ghost", href: "/go/ais", target: "_blank", rel: "noopener" }, "在 AIS 開啟"),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Render

  let renderToken = 0;
  const VIEWS = {
    home: viewHome,
    schedule: viewSchedule,
    grades: viewGrades,
    absences: viewAbsences,
    announcements: viewAnnouncements,
    profile: viewProfile,
    services: viewServices,
    course: viewCourse,
  };

  function setTitle(...parts) {
    document.title = [...parts.filter(Boolean), "學生管理", "NUTC Portal"].join(" · ");
  }

  async function render() {
    const token = ++renderToken;
    closeDialog();
    menu.hidden = true;
    renderMenu();

    const route = matchRoute(location) || { name: "home" };
    if (location.pathname === `${BASE}/`) history.replaceState(null, "", BASE);
    const navName = route.name === "course" ? "schedule" : route.name;
    for (const [name, link] of navLinks) {
      if (navName === name) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const currentLink = navLinks.get(navName);
    if (currentLink) {
      const left = currentLink.offsetLeft;
      if (left < nav.scrollLeft || left + currentLink.offsetWidth > nav.scrollLeft + nav.clientWidth) {
        nav.scrollLeft = Math.max(0, left - 8);
      }
    }

    main.classList.remove("enter");
    main.replaceChildren(h("div", { class: "loading", role: "progressbar", "aria-label": "載入中" }));
    window.scrollTo(0, 0);

    try {
      const content = await VIEWS[route.name](route, token);
      if (token !== renderToken) return;
      main.replaceChildren(...[content].flat(Infinity).filter(Boolean), footer());
    } catch (error) {
      if (token !== renderToken) return;
      main.replaceChildren(errorView(error));
    }
    void main.offsetWidth;
    main.classList.add("enter");
  }

  window.NutcTheme?.init?.().catch(() => {});
  render();
})();
