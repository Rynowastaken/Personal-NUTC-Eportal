// NUTC Portal TronClass: the rebuilt student interface for TronClass, served
// by the portal under /tronclass.
//
// Pages mirror TronClass's own addresses under /tronclass (TronClass's
// /course/1/content is /tronclass/course/1/content here), and every API call
// goes through the portal's server, which holds the TronClass session it got
// from ePortal. Anything not rebuilt, including exam taking with its
// anti-cheat checks, opens on TronClass itself.
(() => {
  "use strict";

  const BASE = "/tronclass";
  const TRONCLASS = "https://tc.nutc.edu.tw";
  const USER_KEY = "tcx-user";
  const STYLE_ID = "tcx-app-style";
  const FONT_URL = "/fonts/albert-sans.woff2";
  // Time the school's SSO chain is given after the handoff starts before the
  // requested TronClass page replaces it in the tab. Too early would cut the
  // handoff off before TronClass's cookies are set.
  const TRONCLASS_SSO_SETTLE_MS = 7000;

  // ---------------------------------------------------------------------------
  // Routing

  // A TronClass path ("/course/1/content") as a page of this app.
  const P = (path) => BASE + path;
  // The same page on TronClass itself.
  const tcHref = (href) => {
    const url = new URL(href, location.origin);
    const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || "/user/index" : url.pathname;
    return TRONCLASS + path + url.search + url.hash;
  };
  const classicHref = () => tcHref(location.href);

  function matchRoute(url) {
    if (url.pathname !== BASE && !url.pathname.startsWith(BASE + "/")) return null;
    const path = url.pathname.slice(BASE.length).replace(/\/+$/, "") || "/user/index";
    const hash = url.hash;
    if (path === "/user/index") return { name: "home" };
    if (path === "/user/courses") return { name: "courses" };
    let m = path.match(/^\/course\/(\d+)(?:\/content)?$/);
    if (m) return { name: "course", courseId: +m[1] };
    m = path.match(/^\/course\/(\d+)\/learning-activity$/);
    if (m) {
      const courseId = +m[1];
      if (!hash || hash === "#" || hash === "#/") return { name: "course", courseId };
      let h = hash.match(/^#\/exam\/(\d+)\/?(?:[?#].*)?$/);
      if (h) return { name: "exam", courseId, examId: +h[1] };
      h = hash.match(/^#\/(\d+)\/?(?:[?#].*)?$/);
      if (h) return { name: "activity", courseId, activityId: +h[1] };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Styles

  const CSS = String.raw`
@font-face {
  font-family: "Albert Sans";
  src: url("${FONT_URL}") format("woff2");
  font-weight: 100 900;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
:root {
  color-scheme: dark;
  /* --primary, --primary-soft, --primary-ring, --accent, --foreground, --muted,
     --faint, --danger and --control-* come from the dashboard theme (theme.js),
     so this page takes the colours of the user's background like the dashboard.
     The background image itself stays on the dashboard; the page and panels
     are tinted with the palette's dark colour (--secondary) instead. */
  --bg: color-mix(in srgb, var(--secondary) 34%, #0c0a0e);
  --surface: color-mix(in srgb, var(--secondary) 44%, #141117);
  --raised: color-mix(in srgb, var(--secondary) 54%, #1a161d);
  --sunken: color-mix(in srgb, var(--secondary) 26%, #09070b);
  --hover: color-mix(in srgb, var(--secondary) 64%, #201b24);
  --edge: rgba(255, 255, 255, .10);
  --edge-strong: rgba(255, 255, 255, .18);
  --text: var(--foreground);
  --soft: color-mix(in srgb, var(--foreground) 84%, transparent);
  --primary-hover: var(--control-hover-bg);
  --on-primary: var(--control-text);
  --honey: var(--accent);
  --honey-soft: color-mix(in srgb, var(--accent) 14%, transparent);
  --danger-soft: color-mix(in srgb, var(--danger) 14%, transparent);
  --success: #8fd8ad;
  --success-soft: rgba(143, 216, 173, .14);
  --radius: 6px;
  --radius-sm: 4px;
  --font: "Albert Sans", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
  --ease: cubic-bezier(.16, 1, .3, 1);
}
* { box-sizing: border-box; }
html { background: var(--bg); scrollbar-color: rgba(255,255,255,.18) transparent; }
body {
  margin: 0; min-height: 100vh; color: var(--text); font: 15px/1.6 var(--font);
  background:
    radial-gradient(1200px 600px at 85% -10%, color-mix(in srgb, var(--primary) 7%, transparent), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, color-mix(in srgb, var(--accent) 4%, transparent), transparent 60%),
    var(--bg);
  -webkit-font-smoothing: antialiased; caret-color: var(--primary);
}
::selection { background: color-mix(in srgb, var(--primary) 45%, transparent); color: var(--foreground); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 99px; border: 2px solid var(--bg); }
::-webkit-scrollbar-track { background: transparent; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--radius-sm); }
.num { font-variant-numeric: tabular-nums; }
svg.i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }

/* Top bar */
.bar {
  position: sticky; top: 0; z-index: 20; height: 56px;
  background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(16px) saturate(160%);
  border-bottom: 1px solid var(--edge);
}
.bar-in { max-width: 1120px; height: 100%; margin: 0 auto; padding: 0 16px; display: flex; align-items: center; gap: 4px; }
.brand { display: flex; align-items: center; gap: 10px; margin-right: 16px; font-weight: 600; letter-spacing: -.01em; }
.brand-mark { display: grid; grid-template-columns: repeat(2, 7px); gap: 2px; }
.brand-mark i { width: 7px; height: 7px; border-radius: 2px; background: var(--primary); }
.brand-mark i:nth-child(2), .brand-mark i:nth-child(3) { background: color-mix(in srgb, var(--primary) 45%, transparent); }
.nav a { display: inline-flex; align-items: center; height: 36px; padding: 0 12px; border-radius: var(--radius); color: var(--muted); font-weight: 500; transition: color .15s, background .15s; }
.nav a:hover { color: var(--text); background: rgba(255,255,255,.05); }
.nav a[aria-current="page"] { color: var(--text); background: var(--primary-soft); }
.bar-end { margin-left: auto; position: relative; }
.user-btn { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 5px; border: 0; border-radius: var(--radius); background: transparent; cursor: pointer; color: var(--soft); }
.user-btn:hover { background: rgba(255,255,255,.05); }
.avatar { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 700; }
.avatar svg { width: 15px; height: 15px; }
.menu {
  position: absolute; right: 0; top: 44px; min-width: 220px; padding: 6px;
  background: var(--raised); border: 1px solid var(--edge-strong); border-radius: var(--radius);
  box-shadow: 0 12px 32px rgba(0,0,0,.45);
}
.menu[hidden] { display: none; }
.menu a, .menu button { display: flex; width: 100%; align-items: center; gap: 10px; padding: 9px 10px; border: 0; border-radius: var(--radius-sm); background: none; text-align: left; color: var(--soft); cursor: pointer; }
.menu a:hover, .menu button:hover { background: rgba(255,255,255,.06); color: var(--text); }
.menu-note { padding: 8px 10px 6px; color: var(--faint); font-size: 12px; }

/* Page */
main { max-width: 1120px; margin: 0 auto; padding: 32px 16px 96px; }
main.enter { animation: enter .32s var(--ease); }
@keyframes enter { from { opacity: .4; transform: translateY(6px); } to { opacity: 1; transform: none; } }
h1 { margin: 0; font-size: clamp(24px, 3.2vw, 32px); font-weight: 300; line-height: 1.2; letter-spacing: -.025em; text-wrap: balance; }
h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; letter-spacing: -.01em; }
.section { margin-top: 40px; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-head h2 { margin: 0; }
.count { color: var(--faint); font-weight: 500; margin-left: 6px; }
.meta { color: var(--muted); font-size: 13px; }
.meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 8px; color: var(--muted); font-size: 13px; }
.back { display: inline-flex; align-items: center; gap: 4px; margin: 0 0 14px -6px; padding: 4px 8px 4px 4px; border-radius: var(--radius-sm); color: var(--muted); font-size: 13px; }
.back:hover { color: var(--text); background: rgba(255,255,255,.05); }
.back .i { width: 16px; height: 16px; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 16px;
  border: 1px solid var(--edge-strong); border-radius: var(--radius); background: var(--raised);
  font-weight: 600; font-size: 14px; color: var(--text); cursor: pointer; white-space: nowrap;
  transition: background .15s, border-color .15s, transform .15s;
}
.btn:hover { background: var(--hover); border-color: rgba(255,255,255,.28); }
.btn:active { transform: translateY(1px); }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.btn.primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.btn.ghost { background: transparent; border-color: transparent; color: var(--muted); }
.btn.ghost:hover { background: rgba(255,255,255,.06); color: var(--text); }
.btn.small { min-height: 32px; padding: 0 10px; font-size: 13px; }
.btn[disabled] { opacity: .45; cursor: default; pointer-events: none; }

/* Rows: one list primitive shared by to-dos, outlines, files and scores */
.list { border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); overflow: hidden; }
.row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px;
  min-height: 60px; padding: 12px 16px; border-top: 1px solid var(--edge);
  transition: background .15s;
}
.row:first-child { border-top: 0; }
a.row:hover, button.row:hover { background: rgba(255,255,255,.035); }
button.row { width: 100%; border: 0; border-top: 1px solid var(--edge); background: none; text-align: left; cursor: pointer; }
button.row:first-child { border-top: 0; }
.row-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius); background: rgba(255,255,255,.05); color: var(--soft); }
.row-icon.exam { background: var(--primary-soft); color: var(--primary); }
.row-icon.homework { background: var(--honey-soft); color: var(--honey); }
.row-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-sub { color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-end { display: flex; align-items: center; gap: 10px; color: var(--faint); white-space: nowrap; flex-shrink: 0; }
.row-end .chev { opacity: .6; }

.chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 99px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,.06); color: var(--muted); white-space: nowrap; }
.chip.urgent { background: var(--danger-soft); color: var(--danger); }
.chip.soon { background: var(--honey-soft); color: var(--honey); }
.chip.done { background: var(--success-soft); color: var(--success); }
.chip.accent { background: var(--primary-soft); color: var(--primary); }

.status { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--edge-strong); color: transparent; }
.status .i { width: 13px; height: 13px; stroke-width: 2.5; }
.status.full { border-color: var(--success); background: var(--success); color: #14301f; }
.status.part { border-color: var(--honey); background: conic-gradient(var(--honey) 0 50%, transparent 50% 100%); }

/* Course tiles */
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.tile {
  display: flex; flex-direction: column; gap: 4px; min-height: 112px; padding: 16px;
  border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface);
  transition: background .15s, border-color .15s, transform .2s var(--ease);
}
.tile:hover { background: var(--raised); border-color: var(--edge-strong); transform: translateY(-2px); }
.tile-name { font-size: 17px; font-weight: 600; letter-spacing: -.01em; line-height: 1.35; }
.tile-foot { margin-top: auto; padding-top: 14px; display: flex; align-items: center; gap: 10px; }
.bar-track { display: block; flex: 1; height: 4px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 99px; background: var(--primary); }
.pct { color: var(--muted); font-size: 12px; font-weight: 600; min-width: 34px; text-align: right; }

/* Controls */
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 24px; }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--sunken); }
.seg button { height: 32px; padding: 0 12px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--muted); font-weight: 500; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--raised); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.3); }
.search { position: relative; flex: 1; min-width: 200px; max-width: 360px; }
.search .i { position: absolute; left: 11px; top: 11px; color: var(--faint); width: 16px; height: 16px; }
.search input {
  width: 100%; height: 40px; padding: 0 12px 0 34px; border: 1px solid var(--edge); border-radius: var(--radius);
  background: var(--sunken); color: var(--text); font: inherit; font-size: 14px;
}
.search input::placeholder { color: var(--faint); }
.search input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }

.tabs { display: flex; gap: 4px; margin-top: 28px; border-bottom: 1px solid var(--edge); }
.tabs button { position: relative; height: 42px; padding: 0 14px; border: 0; background: none; color: var(--muted); font-weight: 500; cursor: pointer; }
.tabs button:hover { color: var(--text); }
.tabs button[aria-selected="true"] { color: var(--text); }
.tabs button[aria-selected="true"]::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; border-radius: 2px; background: var(--primary); }

/* Course header */
.course-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: end; }
.progress { display: flex; align-items: center; gap: 12px; margin-top: 18px; max-width: 520px; }
.progress .meta { white-space: nowrap; }
.module + .module { margin-top: 28px; }
.module h2 { color: var(--soft); }

/* Detail pages */
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1px; margin-top: 24px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); overflow: hidden; }
.fact { padding: 14px 16px; box-shadow: -1px -1px 0 var(--edge); }
.fact.wide { grid-column: span 2; }
@media (max-width: 640px) { .fact.wide { grid-column: auto; } }
.fact dt { color: var(--faint); font-size: 12px; }
.fact dd { margin: 2px 0 0; font-weight: 600; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.note { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; border-radius: var(--radius); background: var(--honey-soft); color: color-mix(in srgb, var(--accent) 70%, #fff); font-size: 14px; max-width: 72ch; }
.note .i { color: var(--honey); margin-top: 2px; }
.prose { max-width: 72ch; color: var(--soft); overflow-wrap: anywhere; }
.prose a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
.prose img { max-width: 100%; height: auto; border-radius: var(--radius-sm); }
.prose table { border-collapse: collapse; }
.prose td, .prose th { border: 1px solid var(--edge); padding: 6px 8px; }
.viewer { margin-top: 16px; border: 1px solid var(--edge); border-radius: var(--radius); overflow: hidden; background: var(--sunken); }
.viewer-head { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--edge); }
.viewer-head .row-title { flex: 1; }
.viewer iframe { display: block; width: 100%; height: min(78vh, 900px); border: 0; background: var(--sunken); }
.video { position: relative; aspect-ratio: 16 / 9; margin-top: 24px; border-radius: var(--radius); overflow: hidden; background: #000; }
.video iframe, .video > div { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pager { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 48px; }
.pager a { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); min-width: 0; }
.pager a:hover { background: var(--raised); }
.pager a.next { text-align: right; grid-column: 2; }
.pager small { color: var(--faint); font-size: 12px; }
.pager span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* States */
.empty { padding: 28px 16px; text-align: center; color: var(--muted); }
.empty strong { display: block; color: var(--soft); font-weight: 600; margin-bottom: 2px; }
.loading { height: 2px; margin: -32px -16px 30px; background: linear-gradient(90deg, transparent, var(--primary), transparent); background-size: 40% 100%; background-repeat: no-repeat; animation: load 1s linear infinite; }
@keyframes load { from { background-position: -40% 0; } to { background-position: 140% 0; } }
.error { max-width: 520px; margin: 48px auto; padding: 24px; text-align: center; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); }
.error .i { width: 28px; height: 28px; color: var(--danger); }
.error h1 { font-size: 22px; margin: 10px 0 6px; }
.error p { margin: 0 0 18px; color: var(--muted); }
.error .actions { justify-content: center; margin-top: 0; }
.footer-link { margin-top: 56px; text-align: center; }

@media (max-width: 640px) {
  main { padding-top: 24px; }
  .brand-text { display: none; }
  .course-head { grid-template-columns: 1fr; }
  .row { gap: 12px; padding: 12px; }
  .hide-sm { display: none !important; }
  .pager { grid-template-columns: 1fr; }
  .pager a.next { grid-column: 1; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);

  // ---------------------------------------------------------------------------
  // Small DOM helpers

  function h(tag, attrs, ...children) {
    if (attrs && attrs["data-classic"] != null) {
      attrs.target = "_blank";
      attrs.rel = "noopener";
    }
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
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    play: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    homework: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    exam: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  };

  function icon(name) {
    const span = document.createElement("span");
    span.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
    return span.firstChild;
  }

  // Teacher-written rich text: keep structure and links, drop scripts, inline
  // styles (Word colours that vanish on dark) and event handlers.
  function richText(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const badUrl = (name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value);
        if (name.startsWith("on") || name === "style" || name === "class" || badUrl) el.removeAttribute(attr.name);
        else if ((name === "href" || name === "src") && /^\/api\//.test(attr.value)) el.setAttribute(attr.name, BASE + attr.value);
        else if ((name === "href" || name === "src") && /^\/(?!\/)/.test(attr.value)) el.setAttribute(attr.name, TRONCLASS + attr.value);
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
  // Dates

  const TZ = "Asia/Taipei";
  const dateTime = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const monthDay = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric" });

  const toDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const when = (iso) => (toDate(iso) ? dateTime.format(toDate(iso)) : "");
  const day = (iso) => (toDate(iso) ? monthDay.format(toDate(iso)) : "");

  function span(ms) {
    const abs = Math.abs(ms);
    const hours = abs / 36e5;
    if (hours < 1) return `${Math.max(1, Math.round(abs / 6e4))} 分鐘`;
    if (hours < 48) return `${Math.round(hours)} 小時`;
    return `${Math.round(hours / 24)} 天`;
  }

  function dueChip(iso, { done = false } = {}) {
    const d = toDate(iso);
    if (done) return h("span", { class: "chip done" }, icon("check"), "已完成");
    if (!d) return null;
    const ms = d - Date.now();
    if (ms < 0) return h("span", { class: "chip" }, "已截止");
    const level = ms < 864e5 ? "urgent" : ms < 3 * 864e5 ? "soon" : "";
    return h("span", { class: `chip num ${level}`, title: when(iso) }, `剩 ${span(ms)}`);
  }

  // ---------------------------------------------------------------------------
  // API

  class ApiError extends Error {
    constructor(message, kind) {
      super(message);
      this.kind = kind;
    }
  }

  // The portal answers 401 with EPORTAL_LOGIN_REQUIRED when its own ePortal
  // sign-in has lapsed; that is the only sign-in the student has to redo.
  async function failure(res) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "EPORTAL_LOGIN_REQUIRED") return new ApiError("Portal 的 ePortal 登入已過期，重新登入後就能回到這裡。", "auth");
    if (res.status === 401 || res.status === 403) return new ApiError("TronClass 拒絕了這次的登入，請稍後再試。", "http");
    return new ApiError(data.error || `TronClass 回應錯誤（${res.status}），請稍後再試。`, "http");
  }

  async function request(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError("連不上 TronClass，請檢查網路後再試一次。", "network");
    }
    if (!res.ok) throw await failure(res);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("json")) throw new ApiError("TronClass 回傳了無法讀取的內容，請稍後再試。", "http");
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  // GETs are cached briefly so moving between a course and its items is instant.
  const cache = new Map();
  function get(path) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < 90e3) return hit.promise;
    const promise = request(path).catch((error) => {
      cache.delete(path);
      throw error;
    });
    cache.set(path, { at: Date.now(), promise });
    return promise;
  }
  const soft = (promise, fallback) => promise.catch((error) => (error.kind === "auth" ? Promise.reject(error) : fallback));

  // Record that a material was opened or a stretch of video was played,
  // exactly as TronClass's own pages do.
  function logRead(activityId, data) {
    return request(`/api/course/activities-read/${activityId}`, { method: "POST", body: data }).catch(() => {});
  }

  // The signed-in user is only published inside TronClass's HTML, near the
  // top of the page; read just enough of it and keep it for the session.
  let userPromise = null;
  function currentUser() {
    if (userPromise) return userPromise;
    try {
      const saved = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
      if (saved && saved.id) return (userPromise = Promise.resolve(saved));
    } catch {}
    userPromise = (async () => {
      const res = await fetch(P("/me"), { credentials: "same-origin" });
      if (!res.ok) throw await failure(res);
      const { user } = await res.json();
      if (!user || !user.id) throw new ApiError("讀不到 TronClass 帳號。", "http");
      try {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {}
      return user;
    })();
    userPromise.catch(() => (userPromise = null));
    return userPromise;
  }

  const COURSE_FIELDS =
    "id,name,course_code,start_date,end_date,credit,compulsory,instructors(id,name),course_attributes(teaching_class_name),study_completeness";

  async function myCourses() {
    const key = "my-courses";
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 90e3) return hit.promise;
    const promise = request("/api/my-courses", {
      method: "POST",
      body: { page: 1, page_size: 200, conditions: {}, fields: COURSE_FIELDS },
    }).then((data) => (data.courses || []).map(normalizeCourse));
    promise.catch(() => cache.delete(key));
    cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  function normalizeCourse(course) {
    const today = new Date().toISOString().slice(0, 10);
    let status = "ongoing";
    if (course.start_date && course.start_date > today) status = "notStarted";
    else if (course.end_date && course.end_date < today) status = "closed";
    const completeness = course.study_completeness;
    const pct = typeof completeness === "number" ? completeness : completeness && typeof completeness === "object" ? completeness.study_completeness ?? completeness.completeness ?? null : null;
    return {
      ...course,
      status,
      progress: pct == null ? null : Math.max(0, Math.min(100, Math.round(pct))),
      teachers: [...new Set((course.instructors || []).map((t) => t.name).filter(Boolean))].join("、"),
      klass: course.course_attributes?.teaching_class_name || "",
    };
  }

  // Everything a course page and its item pages share, loaded once.
  async function courseBundle(courseId) {
    const [course, modules, activities, exams, reads, completeness, submitted] = await Promise.all([
      get(`/api/courses/${courseId}?fields=id,name,course_code,credit,start_date,end_date,instructors(id,name),course_attributes(teaching_class_name)`),
      soft(get(`/api/courses/${courseId}/modules`), { modules: [] }),
      soft(get(`/api/courses/${courseId}/activities`), { activities: [] }),
      soft(get(`/api/courses/${courseId}/exams`), { exams: [] }),
      soft(get(`/api/course/${courseId}/activity-reads-for-user`), { activity_reads: [] }),
      soft(get(`/api/course/${courseId}/my-completeness`), {}),
      soft(get(`/api/courses/${courseId}/submitted-exams?no-intercept=true`), { exam_ids: [] }),
    ]);

    const readMap = new Map((reads.activity_reads || []).map((r) => [r.activity_id, r.completeness]));
    const submittedIds = new Set(submitted.exam_ids || []);
    const items = [
      ...(activities.activities || []).map((a) => ({
        kind: a.type,
        id: a.id,
        title: a.title,
        moduleId: a.module_id,
        sort: a.sort ?? 0,
        start: a.start_time,
        end: a.end_time,
        state: readMap.get(a.id) || "none",
        raw: a,
      })),
      ...(exams.exams || []).map((e) => ({
        kind: "exam",
        id: e.id,
        title: e.title,
        moduleId: e.module_id,
        sort: e.sort ?? 0,
        start: e.start_time,
        end: e.end_time,
        state: submittedIds.has(e.id) ? "full" : "none",
        raw: e,
      })),
    ].filter((item) => item.raw.published !== false);

    const visibleModules = (modules.modules || []).filter((m) => !m.is_hidden).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const groups = visibleModules.map((m) => ({
      id: m.id,
      name: m.name,
      items: items.filter((i) => i.moduleId === m.id).sort((a, b) => a.sort - b.sort),
    }));
    const known = new Set(visibleModules.map((m) => m.id));
    const loose = items.filter((i) => !known.has(i.moduleId)).sort((a, b) => a.sort - b.sort);
    if (loose.length) groups.push({ id: 0, name: "其他", items: loose });
    const ordered = groups.flatMap((g) => g.items);

    const result = completeness.completed_result || {};
    const last = completeness.last_activity;
    return {
      course: normalizeCourse(course),
      groups: groups.filter((g) => g.items.length),
      ordered,
      done: result.total_completed ?? ordered.filter((i) => i.state === "full").length,
      total: result.total_activities ?? ordered.length,
      lastItem: last ? ordered.find((i) => i.id === (last.activity_id ?? last.id)) : null,
    };
  }

  const itemHref = (courseId, item) =>
    item.kind === "exam" ? `${BASE}/course/${courseId}/learning-activity#/exam/${item.id}` : `${BASE}/course/${courseId}/learning-activity#/${item.id}`;

  const KIND = {
    material: { label: "教材", icon: "file" },
    online_video: { label: "影片", icon: "play" },
    homework: { label: "作業", icon: "homework" },
    exam: { label: "測驗", icon: "exam" },
  };
  const kindOf = (kind) => KIND[kind] || { label: "活動", icon: "external" };

  // ---------------------------------------------------------------------------
  // Navigation

  // Pages that are not rebuilt open on TronClass itself.
  function openClassic(href) {
    location.assign(tcHref(href));
  }

  function navigate(href, { replace = false } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) return location.assign(url.href);
    history[replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search + url.hash);
    render();
  }

  // ---------------------------------------------------------------------------
  // Opening TronClass itself
  //
  // The rebuilt pages read TronClass through the server, which keeps the
  // TronClass session it got from ePortal. That session never reaches this
  // browser, so a plain link to tc.nutc.edu.tw lands on the school's SSO
  // login. Pages we have not rebuilt (taking an exam with its anti-cheat,
  // submitting homework) open there all the same, so send the browser through
  // ePortal's one-time handoff first and put the requested page in front of
  // the user once the handoff has set TronClass's cookies.

  // The waiting UI is the portal's own launch page (/go/tronclass), so the
  // handoff looks and behaves like every other ePortal module launch. That
  // page reports when the one-time handoff starts; this page then lands the
  // requested TronClass page once the school's redirects have set the
  // browser's cookies. Must be called from a click handler so the tab is not
  // blocked.
  function openOnTronclass(url) {
    // A fresh tab per click: reusing a named tab would navigate an exam or
    // homework that is already open there away from what the student is doing.
    const popup = window.open(
      new URL(`/go/tronclass?to=${encodeURIComponent(url.href)}`, location.origin).href,
    );
    if (!popup) {
      location.assign(url.href);
      return;
    }

    const stopListening = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(giveUpTimer);
    };

    const onMessage = (event) => {
      if (event.origin !== location.origin) return;
      if (!event.data || event.data.type !== "nutc-launch-continue") return;
      if (popup.closed || event.source !== popup) return;
      stopListening();
      // The launch page is about to hand this tab ePortal's one-time SSO
      // handoff. Once the school's redirects have set TronClass's cookies,
      // replace the handoff with the requested page through the hop that
      // drops this tab's handle on the portal.
      window.setTimeout(() => {
        try {
          if (!popup.closed) {
            popup.location = new URL(
              `/tronclass-open.html?to=${encodeURIComponent(url.href)}`,
              location.origin,
            ).href;
          }
        } catch {
          // The tab was closed; nothing left to open.
        }
      }, TRONCLASS_SSO_SETTLE_MS);
    };

    window.addEventListener("message", onMessage);
    // Launch jobs are forgotten after two minutes; stop listening then even
    // if the popup never reached the handoff (failed job or closed tab).
    const giveUpTimer = window.setTimeout(stopListening, 3 * 60_000);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.dataset.classic != null) {
      const classic = new URL(link.href, location.origin);
      if (classic.origin === TRONCLASS) {
        event.preventDefault();
        openOnTronclass(classic);
        return;
      }
    }
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin || !matchRoute(url)) return;
    event.preventDefault();
    navigate(url.href);
  });
  window.addEventListener("popstate", () => render());
  window.addEventListener("hashchange", () => render());

  // ---------------------------------------------------------------------------
  // Shell

  const menu = h("div", { class: "menu", hidden: true, role: "menu" });
  // The account button shows an icon only, never the student's name.
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

  const navHome = h("a", { href: P("/user/index") }, "首頁");
  const navCourses = h("a", { href: P("/user/courses") }, "課程");
  const main = h("main", { id: "main" });

  document.body.append(
    h(
      "header",
      { class: "bar" },
      h(
        "div",
        { class: "bar-in" },
        h("a", { class: "brand", href: P("/user/index"), "aria-label": "TronClass 首頁" }, h("span", { class: "brand-mark", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), h("span", { class: "brand-text" }, "TronClass")),
        h("nav", { class: "nav", "aria-label": "主要" }, navHome, navCourses),
        h("div", { class: "bar-end" }, userButton, menu),
      ),
    ),
    main,
  );

  function renderMenu() {
    menu.replaceChildren(
      h("div", { class: "menu-note" }, "這是 Portal 重新設計的 TronClass。"),
      h("a", { href: "/", role: "menuitem" }, icon("home"), "回到 Portal"),
      h("a", { href: classicHref(), "data-classic": "", role: "menuitem" }, icon("external"), "在 TronClass 開啟此頁"),
    );
  }

  // ---------------------------------------------------------------------------
  // Views

  let renderToken = 0;
  let cleanup = [];

  async function render() {
    const token = ++renderToken;
    cleanup.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    cleanup = [];
    menu.hidden = true;
    renderMenu();

    const route = matchRoute(location);
    if (!route) return openClassic(location.href);
    if (location.pathname === BASE || location.pathname === BASE + "/") history.replaceState(null, "", P("/user/index"));
    for (const [link, name] of [[navHome, "home"], [navCourses, "courses"]]) {
      if (route.name === name) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }

    main.classList.remove("enter");
    main.replaceChildren(h("div", { class: "loading", role: "progressbar", "aria-label": "載入中" }));
    window.scrollTo(0, 0);

    const views = { home: viewHome, courses: viewCourses, course: viewCourse, activity: viewActivity, exam: viewExam };
    try {
      const content = await views[route.name](route);
      // A view that hands the page back to TronClass returns nothing.
      if (token !== renderToken || content == null) return;
      main.replaceChildren(...[content].flat().filter(Boolean));
    } catch (error) {
      if (token !== renderToken) return;
      main.replaceChildren(errorView(error));
    }
    void main.offsetWidth;
    main.classList.add("enter");
  }

  function errorView(error) {
    const auth = error && error.kind === "auth";
    return h(
      "div",
      { class: "error", role: "alert" },
      icon("alert"),
      h("h1", null, auth ? "需要重新登入" : "這頁沒有載入"),
      h("p", null, (error && error.message) || "發生未預期的錯誤，請再試一次。"),
      h(
        "div",
        { class: "actions" },
        auth
          ? h("a", { class: "btn primary", href: "/server-login/" }, "登入 Server ePortal")
          : h("button", { class: "btn primary", type: "button", onclick: () => render() }, icon("refresh"), "重試"),
        h("a", { class: "btn ghost", href: classicHref(), "data-classic": "" }, "在 TronClass 開啟"),
      ),
    );
  }

  function setTitle(...parts) {
    document.title = [...parts.filter(Boolean), "TronClass"].join(" · ");
  }

  // Home: what is due, then courses in the order they were last opened.
  async function viewHome() {
    setTitle("首頁");
    const [todos, courses, recent] = await Promise.all([
      get("/api/todos?exclude_questionnaire=true"),
      myCourses(),
      soft(get("/api/user/recently-visited-courses"), { visited_courses: [] }),
    ]);

    const due = (todos.todo_list || []).filter((t) => t.is_student !== false).sort((a, b) => (toDate(a.end_time) || Infinity) - (toDate(b.end_time) || Infinity));
    const order = new Map((recent.visited_courses || []).map((c, i) => [c.id, i]));
    const current = courses.filter((c) => c.status === "ongoing").sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

    const todoList = due.length
      ? h(
          "div",
          { class: "list" },
          due.map((t) => {
            const kind = kindOf(t.type);
            const href = t.type === "exam" ? `${BASE}/course/${t.course_id}/learning-activity#/exam/${t.id}` : `${BASE}/course/${t.course_id}/learning-activity#/${t.id}`;
            return h(
              "a",
              { class: "row", href },
              h("span", { class: `row-icon ${t.type}` }, icon(kind.icon)),
              h("span", { style: "min-width:0" }, h("div", { class: "row-title" }, t.title), h("div", { class: "row-sub" }, `${kind.label} · ${t.course_name}`)),
              h("span", { class: "row-end" }, h("span", { class: "meta num hide-sm" }, when(t.end_time)), dueChip(t.end_time), h("span", { class: "chev" }, icon("right"))),
            );
          }),
        )
      : h("div", { class: "list" }, h("div", { class: "empty" }, h("strong", null, "沒有待辦事項"), "作業和測驗開放後會出現在這裡。"));

    const today = new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "long", day: "numeric", weekday: "long" }).format(new Date());
    return [
      h("h1", { class: "num" }, today),
      h("section", { class: "section", "aria-labelledby": "due-h" }, h("div", { class: "section-head" }, h("h2", { id: "due-h" }, "待辦", due.length ? h("span", { class: "count num" }, due.length) : null)), todoList),
      h(
        "section",
        { class: "section", "aria-labelledby": "courses-h" },
        h("div", { class: "section-head" }, h("h2", { id: "courses-h" }, "本學期課程", h("span", { class: "count num" }, current.length)), h("a", { class: "btn ghost small", href: P("/user/courses") }, "所有課程", icon("arrow"))),
        current.length ? h("div", { class: "tiles" }, current.map(courseTile)) : h("div", { class: "list" }, h("div", { class: "empty" }, h("strong", null, "目前沒有進行中的課程"))),
      ),
    ];
  }

  function courseTile(course) {
    return h(
      "a",
      { class: "tile", href: `${BASE}/course/${course.id}/content` },
      h("span", { class: "tile-name" }, course.name),
      h("span", { class: "meta" }, [course.teachers, course.klass].filter(Boolean).join(" · ")),
      course.progress == null
        ? null
        : h("span", { class: "tile-foot" }, h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${course.progress}%` })), h("span", { class: "pct num" }, `${course.progress}%`)),
    );
  }

  // All courses: one list with a status switch and search.
  async function viewCourses() {
    setTitle("課程");
    const courses = await myCourses();
    const filters = [
      ["ongoing", "進行中"],
      ["notStarted", "未開始"],
      ["closed", "已結束"],
      ["all", "全部"],
    ];
    let filter = "ongoing";
    let query = "";
    const list = h("div", { class: "list" });

    const draw = () => {
      const q = query.trim().toLowerCase();
      const shown = courses.filter((c) => (filter === "all" || c.status === filter) && (!q || `${c.name} ${c.course_code} ${c.teachers}`.toLowerCase().includes(q)));
      list.replaceChildren(
        ...(shown.length
          ? shown.map((c) =>
              h(
                "a",
                { class: "row", href: `${BASE}/course/${c.id}/content` },
                h("span", { class: "row-icon" }, icon("book")),
                h("span", { style: "min-width:0" }, h("div", { class: "row-title" }, c.name), h("div", { class: "row-sub" }, [c.teachers, c.klass, c.course_code].filter(Boolean).join(" · "))),
                h(
                  "span",
                  { class: "row-end" },
                  c.progress == null ? null : h("span", { class: "chip num hide-sm" }, `${c.progress}%`),
                  h("span", { class: "meta num hide-sm" }, `${day(c.start_date)} – ${day(c.end_date)}`),
                  h("span", { class: "chev" }, icon("right")),
                ),
              ),
            )
          : [h("div", { class: "empty" }, h("strong", null, q ? "找不到符合的課程" : "這裡沒有課程"), q ? "換個關鍵字試試。" : null)]),
      );
    };

    const seg = h(
      "div",
      { class: "seg", role: "group", "aria-label": "課程狀態" },
      filters.map(([value, label]) =>
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(value === filter),
            onclick: (event) => {
              filter = value;
              seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === event.currentTarget)));
              draw();
            },
          },
          label,
        ),
      ),
    );
    const search = h("input", {
      type: "search",
      placeholder: "搜尋課程名稱、代碼或老師",
      "aria-label": "搜尋課程",
      oninput: (event) => {
        query = event.target.value;
        draw();
      },
    });
    draw();
    return [h("h1", null, "課程"), h("div", { class: "toolbar" }, seg, h("label", { class: "search" }, icon("search"), search)), h("div", { class: "section", style: "margin-top:16px" }, list)];
  }

  function itemRow(courseId, item) {
    const kind = kindOf(item.kind);
    const deadline = item.kind === "homework" || item.kind === "exam";
    const sub = [kind.label, deadline && item.end ? `截止 ${when(item.end)}` : item.start ? when(item.start) : ""].filter(Boolean).join(" · ");
    const known = Boolean(KIND[item.kind]);
    return h(
      "a",
      { class: "row", href: known ? itemHref(courseId, item) : tcHref(itemHref(courseId, item)), "data-classic": known ? null : "" },
      h("span", { class: `row-icon ${item.kind}` }, icon(kind.icon)),
      h("span", { style: "min-width:0" }, h("div", { class: "row-title" }, item.title), h("div", { class: "row-sub num" }, sub)),
      h(
        "span",
        { class: "row-end" },
        deadline && item.state !== "full" && toDate(item.end) > Date.now() ? h("span", { class: "hide-sm" }, dueChip(item.end)) : null,
        h("span", { class: `status ${item.state}`, title: item.state === "full" ? "已完成" : item.state === "part" ? "進行中" : "未完成" }, icon("check")),
      ),
    );
  }

  // A course: one outline grouped by chapter, plus scores.
  async function viewCourse({ courseId }) {
    const bundle = await courseBundle(courseId);
    const { course } = bundle;
    setTitle(course.name);
    const pct = bundle.total ? Math.round((bundle.done / bundle.total) * 100) : 0;
    const resume = bundle.lastItem || bundle.ordered.find((i) => i.state !== "full");

    const panel = h("div");
    const tabs = h("div", { class: "tabs", role: "tablist" });
    const tabList = [
      ["content", "課程內容", () => outline(courseId, bundle)],
      ["scores", "成績", () => scores(courseId, bundle)],
    ];
    const select = async (key) => {
      tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.key === key)));
      const [, , build] = tabList.find(([k]) => k === key);
      panel.replaceChildren(h("div", { class: "meta", style: "padding:24px 0" }, "載入中…"));
      try {
        panel.replaceChildren(...[await build()].flat());
      } catch (error) {
        panel.replaceChildren(errorView(error));
      }
    };
    tabList.forEach(([key, label]) => tabs.append(h("button", { type: "button", role: "tab", "data-key": key, onclick: () => select(key) }, label)));
    select("content");

    return [
      h("a", { class: "back", href: P("/user/courses") }, icon("left"), "課程"),
      h(
        "div",
        { class: "course-head" },
        h(
          "div",
          null,
          h("h1", null, course.name),
          h("div", { class: "meta-row" }, [course.teachers, course.klass, course.course_code, course.credit ? `${course.credit} 學分` : ""].filter(Boolean).map((t) => h("span", null, t))),
          bundle.total
            ? h("div", { class: "progress" }, h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${pct}%` })), h("span", { class: "meta num" }, `已完成 ${bundle.done} / ${bundle.total}`))
            : null,
        ),
        resume ? h("a", { class: "btn primary", href: itemHref(courseId, resume) }, bundle.lastItem ? "繼續學習" : "開始學習", icon("arrow")) : null,
      ),
      tabs,
      panel,
    ];
  }

  function outline(courseId, bundle) {
    if (!bundle.groups.length) return h("div", { class: "list", style: "margin-top:24px" }, h("div", { class: "empty" }, h("strong", null, "老師還沒有放上課程內容"), "內容開放後會出現在這裡。"));
    return h(
      "div",
      { style: "margin-top:24px" },
      bundle.groups.map((group) => h("section", { class: "module" }, h("h2", null, group.name), h("div", { class: "list" }, group.items.map((item) => itemRow(courseId, item))))),
    );
  }

  async function scores(courseId, bundle) {
    const [homework, exams] = await Promise.all([
      soft(get(`/api/course/${courseId}/homework-scores`), { homework_activities: [], scores: [] }),
      soft(get(`/api/courses/${courseId}/exam-scores?no-intercept=true`), { exam_scores: [] }),
    ]);
    const hwScore = new Map((homework.scores || []).map((s) => [s.activity_id, s.final_score ?? s.score]));
    const examScore = new Map((exams.exam_scores || []).map((s) => [s.activity_id, s.score]));
    const rows = bundle.ordered
      .filter((i) => i.kind === "homework" || i.kind === "exam")
      .map((item) => {
        const score = item.kind === "exam" ? examScore.get(item.id) : hwScore.get(item.id);
        const kind = kindOf(item.kind);
        const pending = item.state === "full" ? "成績未公布" : item.kind === "exam" ? "未作答" : "未繳交";
        return h(
          "a",
          { class: "row", href: itemHref(courseId, item) },
          h("span", { class: `row-icon ${item.kind}` }, icon(kind.icon)),
          h("span", { style: "min-width:0" }, h("div", { class: "row-title" }, item.title), h("div", { class: "row-sub" }, kind.label)),
          h("span", { class: "row-end" }, score == null ? h("span", { class: "meta" }, pending) : h("span", { class: "chip accent num" }, `${score} 分`)),
        );
      });
    return h(
      "div",
      { style: "margin-top:24px" },
      rows.length ? h("div", { class: "list" }, rows) : h("div", { class: "list" }, h("div", { class: "empty" }, h("strong", null, "這門課還沒有作業或測驗"))),
    );
  }

  function itemHeader(courseId, bundle, item, extra) {
    const kind = kindOf(item.kind);
    setTitle(item.title, bundle.course.name);
    return [
      h("a", { class: "back", href: `${BASE}/course/${courseId}/content` }, icon("left"), bundle.course.name),
      h("h1", null, item.title),
      h("div", { class: "meta-row" }, h("span", { class: `chip ${item.kind === "exam" ? "accent" : ""}` }, kind.label), extra),
    ];
  }

  function pager(courseId, bundle, item) {
    const known = bundle.ordered.filter((i) => KIND[i.kind]);
    const index = known.findIndex((i) => i.id === item.id && i.kind === item.kind);
    const prev = known[index - 1];
    const next = known[index + 1];
    if (!prev && !next) return null;
    return h(
      "nav",
      { class: "pager", "aria-label": "上一個與下一個" },
      prev ? h("a", { href: itemHref(courseId, prev) }, h("small", null, "上一個"), h("span", null, prev.title)) : null,
      next ? h("a", { class: "next", href: itemHref(courseId, next) }, h("small", null, "下一個"), h("span", null, next.title)) : null,
    );
  }

  async function viewActivity({ courseId, activityId }) {
    const [bundle, activity] = await Promise.all([courseBundle(courseId), get(`/api/activities/${activityId}`)]);
    const item = bundle.ordered.find((i) => i.id === activityId && i.kind !== "exam") || {
      kind: activity.type,
      id: activity.id,
      title: activity.title,
      start: activity.start_time,
      end: activity.end_time,
      state: "none",
    };
    if (!KIND[item.kind]) return openClassic(location.href);

    const body =
      item.kind === "material"
        ? materialView(activity)
        : item.kind === "online_video"
          ? videoView(activity)
          : await homeworkView(courseId, activity, item);

    const timing = item.start || item.end ? h("span", { class: "num" }, [item.start ? when(item.start) : "", item.end ? `– ${when(item.end)}` : ""].join(" ").trim()) : null;
    return [...itemHeader(courseId, bundle, item, timing), body, pager(courseId, bundle, item), classicFooter()];
  }

  function classicFooter() {
    return h("div", { class: "footer-link" }, h("a", { class: "btn ghost small", href: classicHref(), "data-classic": "" }, icon("external"), "在 TronClass 開啟此頁"));
  }

  function fileSize(bytes) {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    return `${n.toFixed(n < 10 && i ? 1 : 0)} ${units[i]}`;
  }

  function fileRows(activityId, uploads, { onPreview } = {}) {
    return h(
      "div",
      { class: "list" },
      uploads.map((upload) => {
        const ref = upload.reference_id || upload.id;
        const download = upload.allow_download !== false;
        const canPreview = upload.type === "document" && onPreview;
        return h(
          "div",
          { class: "row" },
          h("span", { class: "row-icon" }, icon("file")),
          h("span", { style: "min-width:0" }, h("div", { class: "row-title", title: upload.name }, upload.name), h("div", { class: "row-sub num" }, fileSize(upload.size))),
          h(
            "span",
            { class: "row-end" },
            canPreview ? h("button", { class: "btn small", type: "button", onclick: () => onPreview(upload) }, icon("eye"), "預覽") : null,
            download
              ? h("a", { class: "btn small ghost", href: `${BASE}/api/uploads/reference/${ref}/blob`, download: upload.name, "aria-label": `下載 ${upload.name}`, onclick: () => activityId && logRead(activityId, { upload_id: upload.id }) }, icon("download"), h("span", { class: "hide-sm" }, "下載"))
              : null,
          ),
        );
      }),
    );
  }

  function materialView(activity) {
    const uploads = activity.uploads || [];
    const viewer = h("div");
    const description = activity.data?.description ? richText(activity.data.description) : null;

    const preview = async (upload) => {
      viewer.replaceChildren(h("div", { class: "viewer" }, h("div", { class: "viewer-head" }, h("span", { class: "row-title" }, upload.name), h("span", { class: "meta" }, "載入預覽…"))));
      viewer.scrollIntoView({ behavior: "smooth", block: "start" });
      logRead(activity.id, { upload_id: upload.id });
      // The portal streams TronClass's converted PDF so the browser's own
      // viewer can show it.
      const src = P(`/preview/${upload.reference_id}`);
      try {
        const head = await fetch(src, { method: "HEAD" });
        if (!head.ok) throw new Error();
        viewer.replaceChildren(
          h(
            "div",
            { class: "viewer" },
            h(
              "div",
              { class: "viewer-head" },
              h("span", { class: "row-title" }, upload.name),
              h("a", { class: "btn small ghost", href: src, target: "_blank", rel: "noopener" }, icon("external"), "新分頁"),
              h("button", { class: "btn small ghost", type: "button", "aria-label": "關閉預覽", onclick: () => viewer.replaceChildren() }, icon("close")),
            ),
            h("iframe", { src, title: upload.name, allowfullscreen: true }),
          ),
        );
      } catch {
        viewer.replaceChildren(h("div", { class: "note" }, icon("alert"), h("span", null, "這個檔案目前無法預覽，請直接下載。")));
      }
    };

    if (uploads.length === 1 && uploads[0].type === "document") queueMicrotask(() => preview(uploads[0]));
    return h(
      "div",
      { class: "section", style: "margin-top:28px" },
      description,
      uploads.length ? h("div", { style: description ? "margin-top:20px" : null }, fileRows(activity.id, uploads, { onPreview: preview })) : h("div", { class: "list" }, h("div", { class: "empty" }, h("strong", null, "沒有檔案"))),
      viewer,
    );
  }

  let ytReady = null;
  function loadYouTube() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve(window.YT);
      };
      document.head.append(h("script", { src: "https://www.youtube.com/iframe_api", async: true }));
    });
    return ytReady;
  }

  function videoView(activity) {
    const data = activity.data || {};
    const link = data.link || "";
    const videoId = (link.match(/(?:embed\/|youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/) || [])[1];
    const frame = h("div", { class: "video" });
    const parts = [frame];
    if (data.pause_when_leaving_window) parts.push(h("div", { class: "note" }, icon("alert"), h("span", null, "老師設定離開此頁時影片會暫停。")));
    if (data.description) parts.push(h("div", { style: "margin-top:20px" }, richText(data.description)));

    if (!videoId) {
      if (link) frame.append(h("iframe", { src: link, title: activity.title, allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true }));
      else frame.replaceWith(h("div", { class: "note" }, icon("alert"), h("span", null, "這部影片需要用原版播放。")));
      return h("div", null, parts);
    }

    // Log each stretch that actually played, as TronClass's player does.
    const slot = h("div");
    frame.append(slot);
    let player = null;
    let from = null;
    const flush = () => {
      if (from == null || !player || !player.getCurrentTime) return;
      const start = Math.floor(from);
      const end = Math.floor(player.getCurrentTime());
      from = null;
      if (end > start) logRead(activity.id, { start, end });
    };
    loadYouTube().then((YT) => {
      if (!slot.isConnected) return;
      player = new YT.Player(slot, {
        videoId,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) from = player.getCurrentTime();
            else flush();
          },
        },
      });
    });
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (data.pause_when_leaving_window && player && player.pauseVideo) player.pauseVideo();
      flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    cleanup.push(() => {
      flush();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      if (player && player.destroy) player.destroy();
    });
    return h("div", null, parts);
  }

  async function homeworkView(courseId, activity, item) {
    const user = await currentUser().catch(() => null);
    const list = user ? await soft(get(`/api/activities/${activity.id}/students/${user.id}/submission_list`), { list: [] }) : { list: [] };
    const submissions = (list.list || []).filter((s) => !s.is_draft).sort((a, b) => (toDate(b.submitted_at) || 0) - (toDate(a.submitted_at) || 0));
    const latest = submissions[0];
    const data = activity.data || {};
    const closed = toDate(activity.end_time) && toDate(activity.end_time) < Date.now();
    const score = latest && (latest.final_score ?? latest.score);
    const limit = data.submit_times;

    const facts = h(
      "dl",
      { class: "facts" },
      fact("狀態", latest ? (score != null ? `已評分 · ${score} 分` : "已繳交") : closed ? "未繳交，已截止" : "尚未繳交"),
      fact("截止時間", activity.end_time ? when(activity.end_time) : "不限"),
      fact("繳交次數", limit ? `${submissions.length} / ${limit}` : `${submissions.length} 次`),
      latest ? fact("最後繳交", when(latest.submitted_at)) : null,
    );

    const actions = h(
      "div",
      { class: "actions" },
      !closed || activity.data?.allow_late_submission
        ? h("a", { class: "btn primary", href: classicHref(), "data-classic": "" }, latest ? "重新繳交" : "繳交作業", icon("arrow"))
        : null,
      item.end && !latest && !closed ? dueChip(item.end) : null,
    );

    const sections = [facts, actions];
    if (data.description) sections.push(h("section", { class: "section" }, h("h2", null, "說明"), richText(data.description)));
    if ((activity.uploads || []).length) sections.push(h("section", { class: "section" }, h("h2", null, "老師的附件"), fileRows(null, activity.uploads)));
    if (submissions.length) {
      sections.push(
        h(
          "section",
          { class: "section" },
          h("h2", null, "我的繳交紀錄"),
          h(
            "div",
            { class: "list" },
            submissions.map((s) =>
              h(
                "div",
                { class: "row", style: "align-items:start" },
                h("span", { class: "row-icon" }, icon("clip")),
                h(
                  "div",
                  { style: "min-width:0" },
                  h("div", { class: "row-title num" }, when(s.submitted_at)),
                  (s.uploads || []).map((u) => h("div", null, h("a", { href: `${BASE}/api/uploads/reference/${u.reference_id || u.id}/blob`, download: u.name, style: "color:var(--primary)" }, u.name))),
                  s.instructor_comment ? h("div", { class: "row-sub", style: "white-space:normal" }, `老師評語：${s.instructor_comment}`) : null,
                ),
                h("span", { class: "row-end" }, (s.final_score ?? s.score) != null ? h("span", { class: "chip accent num" }, `${s.final_score ?? s.score} 分`) : h("span", { class: "meta" }, "未評分")),
              ),
            ),
          ),
        ),
      );
    }
    return h("div", null, sections);
  }

  function fact(label, value, { wide = false } = {}) {
    return h("div", { class: wide ? "fact wide" : "fact" }, h("dt", null, label), h("dd", { class: "num" }, value));
  }

  // Exam overview. Taking the exam always happens on TronClass's own page,
  // which runs the rules pledge, qualification and anti-cheat checks.
  async function viewExam({ courseId, examId }) {
    const [bundle, exam, scores] = await Promise.all([
      courseBundle(courseId),
      get(`/api/exams/${examId}`),
      soft(get(`/api/courses/${courseId}/exam-scores?no-intercept=true`), { exam_scores: [] }),
    ]);
    const item = bundle.ordered.find((i) => i.kind === "exam" && i.id === examId) || { kind: "exam", id: exam.id, title: exam.title, end: exam.end_time, state: "none" };
    const now = Date.now();
    const notOpen = toDate(exam.start_time) && toDate(exam.start_time) > now;
    const closed = exam.is_closed || (toDate(exam.end_time) && toDate(exam.end_time) < now);
    const used = exam.submitted_times ?? 0;
    const limit = exam.submit_times || 0;
    const outOfTries = limit > 0 && used >= limit;
    const score = (scores.exam_scores || []).find((s) => s.activity_id === examId)?.score;

    const facts = h(
      "dl",
      { class: "facts" },
      fact("作答期間", `${when(exam.start_time) || "隨時"} – ${when(exam.end_time) || "不限"}`, { wide: true }),
      fact("時間限制", exam.limit_time ? `${exam.limit_time} 分鐘` : "不限時"),
      fact("作答次數", limit ? `${used} / ${limit}` : `${used} 次，不限`),
      fact("題目", `${exam.subjects_count ?? "—"} 題 · ${exam.total_points ?? "—"} 分`),
      score != null ? fact("我的成績", `${score} 分`) : null,
    );

    const guarded = exam.enable_anti_cheat || exam.is_fullscreen_mode || exam.is_leaving_window_constrained || exam.enable_invigilation;
    const startLabel = exam.has_temporary_submission ? "繼續作答" : used > 0 ? "再次作答" : "開始作答";
    const canStart = !notOpen && !closed && !outOfTries;

    const actions = h(
      "div",
      { class: "actions" },
      canStart ? h("a", { class: "btn primary", href: classicHref(), "data-classic": "" }, startLabel, icon("arrow")) : null,
      notOpen ? h("span", { class: "chip" }, icon("clock"), `${when(exam.start_time)} 開放`) : null,
      closed ? h("span", { class: "chip" }, "已結束") : null,
      outOfTries && !closed ? h("span", { class: "chip" }, "作答次數已用完") : null,
      canStart && exam.end_time ? dueChip(exam.end_time) : null,
    );

    const parts = [...itemHeader(courseId, bundle, item, exam.is_practice_mode ? h("span", { class: "chip" }, "練習") : null), facts];
    if (guarded && canStart) {
      parts.push(
        h(
          "div",
          { class: "note" },
          icon("shield"),
          h("span", null, "這份測驗有防作弊設定", exam.is_fullscreen_mode ? "，會以全螢幕作答" : "", "。作答時請不要切換視窗或分頁。按下開始後會進入原版 TronClass 的作答頁。"),
        ),
      );
    }
    parts.push(actions);
    if (exam.description) parts.push(h("section", { class: "section" }, h("h2", null, "說明"), richText(exam.description)));
    parts.push(pager(courseId, bundle, item));
    return parts;
  }

  // Same colours as the dashboard (the page has no #portalBackdrop, so no image).
  window.NutcTheme?.init?.().catch(() => {});
  render();
})();
