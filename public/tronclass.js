// NUTC Portal TronClass: the rebuilt student interface for TronClass, served
// by the portal under /tronclass.
//
// Pages mirror TronClass's own addresses under /tronclass (TronClass's
// /course/1/content is /tronclass/course/1/content here), and every API call
// goes through the portal's server, which holds the TronClass session it got
// from ePortal. Exams are answered here too, with the same anti-cheat rules
// TronClass enforces in the browser; invigilated exams and anything not
// rebuilt keep an explicit link to TronClass itself. Practice exams also offer
// an AI explanation of the current question.
(() => {
  "use strict";

  const BASE = "/tronclass";
  const TRONCLASS = "https://tc.nutc.edu.tw";
  const USER_KEY = "tcx-user";
  const STYLE_ID = "tcx-app-style";
  const FONT_URL = "/fonts/albert-sans.woff2";

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
  const classicHref = () => {
    const route = matchRoute(location);
    if (route?.name === "examTake") return classicExamHref(route.courseId, route.examId);
    return tcHref(location.href);
  };

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
      let h = hash.match(/^#\/exam\/(\d+)\/take\/?(?:[?#].*)?$/);
      if (h) return { name: "examTake", courseId, examId: +h[1] };
      h = hash.match(/^#\/exam\/(\d+)\/?(?:[?#].*)?$/);
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
h1 { margin: 0; font-size: clamp(24px, 3.2vw, 32px); font-weight: 300; line-height: 1.2; letter-spacing: -.025em; text-wrap: balance; overflow-wrap: anywhere; }
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
@media (max-width: 1100px) { .fact.wide { grid-column: auto; } }
.fact dt { color: var(--faint); font-size: 12px; }
.fact dd { margin: 2px 0 0; font-weight: 600; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 24px; }
.note { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; border-radius: var(--radius); background: var(--honey-soft); color: color-mix(in srgb, var(--accent) 70%, #fff); font-size: 14px; max-width: 72ch; }
.note .i { color: var(--honey); margin-top: 2px; }
.prose { max-width: 72ch; color: var(--soft); overflow-wrap: anywhere; }
.prose a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
.prose img { max-width: 100%; height: auto; border-radius: var(--radius-sm); }
.prose table { border-collapse: collapse; max-width: 100%; }
.prose td, .prose th { border: 1px solid var(--edge); padding: 6px 8px; overflow-wrap: anywhere; }
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

/* Exam overview and taking */
.exam-head {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px 24px; align-items: start;
  margin-top: 4px; padding: 16px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface);
}
.exam-head-main { min-width: 0; }
.exam-head h1 { font-size: clamp(22px, 3vw, 28px); }
.exam-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.exam-clock {
  display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px;
  border: 1px solid var(--edge); border-radius: var(--radius); background: var(--sunken);
  font-size: 15px; font-weight: 600; white-space: nowrap;
}
.exam-clock .i { color: var(--muted); }
.exam-clock.low { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, var(--edge)); }
.exam-clock.low .i { color: var(--danger); }
.exam-progress { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0; }
.exam-progress .bar-track { flex: 1; min-width: 120px; max-width: 360px; }
.exam-progress .meta { white-space: nowrap; }
.exam-progress:has(.save-state[data-tone="error"]) .bar-track { min-width: 0; }
.save-state { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; min-height: 24px; color: var(--faint); font-size: 12px; font-weight: 500; white-space: nowrap; }
.save-state .i { width: 14px; height: 14px; }
.save-state[data-tone="saved"] { color: var(--success); }
.save-state[data-tone="error"] { color: var(--danger); }
.save-state .btn.small { min-height: 36px; }

.exam-layout { display: grid; grid-template-columns: minmax(0, 1fr) 248px; gap: 20px; align-items: start; margin-top: 20px; }
.exam-paper { min-width: 0; scroll-margin-top: 72px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); }
.q-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--edge); }
.q-number { color: var(--primary); font-size: 14px; font-weight: 600; }
.q-points { color: var(--muted); font-size: 12px; white-space: nowrap; }
.q-body { padding: 16px; }
.q-prompt { color: var(--text); font-size: 16px; line-height: 1.7; }
.q-prompt .prose, .q-prompt.prose { max-width: none; }
.q-help { margin-top: 8px; color: var(--faint); font-size: 12.5px; }
.choices { display: grid; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
.choice {
  display: flex; align-items: flex-start; gap: 12px; min-height: 44px; padding: 10px 12px;
  border: 1px solid var(--edge); border-radius: var(--radius); background: rgba(255, 255, 255, .02);
  color: var(--soft); cursor: pointer; transition: background .15s, border-color .15s;
}
.choice:hover { background: rgba(255, 255, 255, .045); border-color: var(--edge-strong); }
.choice:has(input:checked) { background: var(--primary-soft); border-color: var(--primary); color: var(--text); }
.choice:has(input:focus-visible) { outline: 2px solid var(--primary); outline-offset: 2px; }
.choice input { flex: none; width: 16px; height: 16px; margin: 3px 0 0; accent-color: var(--primary); }
.choice-index { flex: none; min-width: 18px; color: var(--muted); font-weight: 600; line-height: 1.5; }
.choice:has(input:checked) .choice-index { color: var(--primary); }
.choice-text { flex: 1; min-width: 0; }
.choice-text .prose { max-width: none; }
.choice-text .prose p:first-child { margin-top: 0; }
.choice-text .prose p:last-child { margin-bottom: 0; }
.answer-area { margin-top: 16px; }
.answer-area textarea {
  width: 100%; min-height: 148px; padding: 12px 14px; border: 1px solid var(--edge); border-radius: var(--radius);
  background: var(--sunken); color: var(--text); font: inherit; line-height: 1.7; resize: vertical;
}
.answer-area textarea::placeholder { color: var(--faint); }
.answer-area textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.q-nav { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--edge); }
.q-nav .meta { min-width: 0; text-align: center; white-space: nowrap; }
.q-nav .btn { min-width: 92px; }
.q-nav .btn[disabled] { opacity: .35; }

.exam-side { position: sticky; top: 72px; display: grid; gap: 12px; }
.exam-card { padding: 16px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); }
.exam-card h2 { margin: 0 0 12px; font-size: 14px; }
.qgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 8px; }
.qjump {
  display: grid; place-items: center; min-width: 36px; height: 36px; padding: 3px 0 0;
  border: 1px solid var(--edge); border-radius: var(--radius-sm); background: var(--raised);
  color: var(--muted); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.qjump:hover { border-color: var(--edge-strong); color: var(--text); }
.qjump[data-answered="true"] { background: var(--primary-soft); border-color: var(--primary-ring); color: var(--primary); }
.qjump[aria-current="true"] { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.qjump[data-unsupported="true"] { border-style: dashed; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 12px; color: var(--faint); font-size: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 9px; height: 9px; border-radius: 3px; border: 1px solid var(--edge-strong); background: var(--raised); }
.legend i.now { background: var(--primary); border-color: var(--primary); }
.legend i.done { background: var(--primary-soft); border-color: var(--primary-ring); }

.exam-modal {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px;
  background: color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter: blur(8px);
}
.exam-modal[hidden] { display: none; }
.exam-dialog {
  width: min(440px, 100%); max-height: calc(100dvh - 32px); overflow: auto; padding: 20px;
  border: 1px solid var(--edge-strong); border-radius: var(--radius); background: var(--raised);
  box-shadow: 0 24px 80px rgba(0, 0, 0, .46);
}
.exam-dialog h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }
.exam-dialog p { margin: 0 0 12px; color: var(--muted); }
.exam-dialog .facts { margin-top: 12px; grid-template-columns: 1fr 1fr; }
.exam-dialog .actions { margin-top: 16px; justify-content: flex-end; }
.exam-dialog[data-kind="ai"] { width: min(640px, 100%); }
.ai-settings { width: min(560px, 100%); }
.ai-settings .fields { display: grid; gap: 14px; margin-top: 16px; }
.ai-settings .field { display: grid; gap: 6px; }
.ai-settings .field > span { font-size: 13px; font-weight: 600; color: var(--soft); }
.ai-settings input:not([type="checkbox"]), .ai-settings select {
  width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid var(--edge); border-radius: var(--radius);
  background: var(--sunken); color: var(--text); font: inherit; font-size: 14px;
}
.ai-settings select { cursor: pointer; }
.ai-settings input:focus, .ai-settings select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.ai-settings .check { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: var(--soft); cursor: pointer; }
.ai-settings .check input { width: 16px; height: 16px; flex: none; accent-color: var(--primary); }
.ai-settings .hint { color: var(--faint); font-size: 12px; }
.ai-settings .settings-status { min-height: 18px; margin: 12px 0 0; color: var(--muted); font-size: 12.5px; }
.ai-settings .settings-status[data-tone="error"] { color: var(--danger); }
.ai-settings .settings-status[data-tone="saved"] { color: var(--success); }
.ai-settings .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.ai-chat { position: relative; display: grid; gap: 10px; max-height: 55vh; overflow: auto; padding-right: 2px; }
.ai-answer, .ai-turn { white-space: pre-wrap; line-height: 1.7; color: var(--soft); overflow-wrap: anywhere; }
.ai-turn.user { justify-self: end; max-width: 92%; padding: 9px 12px; border: 1px solid var(--primary-ring); border-radius: var(--radius); background: var(--primary-soft); color: var(--text); }
.ai-turn.ai { padding: 9px 12px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--sunken); }
.ai-turn.error { padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--edge)); border-radius: var(--radius); background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
.ai-followup { display: flex; align-items: flex-end; gap: 8px; margin-top: 14px; }
.ai-followup[hidden] { display: none; }
.ai-followup textarea {
  flex: 1; min-height: 44px; max-height: 120px; padding: 10px 12px; border: 1px solid var(--edge); border-radius: var(--radius);
  background: var(--sunken); color: var(--text); font: inherit; font-size: 14px; line-height: 1.5; resize: none;
}
.ai-followup textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.ai-followup .btn { min-height: 44px; }
.ai-loading { display: flex; align-items: center; gap: 10px; color: var(--muted); }
.ai-loading .i { animation: ai-spin 1.1s linear infinite; }
@keyframes ai-spin { to { transform: rotate(360deg); } }
.q-tools { display: flex; justify-content: flex-end; margin-top: 12px; }
.q-ai { color: var(--primary); }
.q-ai.btn.ghost, .q-ai.btn.ghost:hover { color: var(--primary); }
.blocked { margin-top: 8px; }

@media (max-width: 860px) {
  .exam-head { grid-template-columns: 1fr; }
  .exam-tools { justify-content: flex-start; }
  .exam-layout { grid-template-columns: 1fr; }
  .exam-side { position: static; }
}
@media (max-width: 640px) {
  main { padding-top: 24px; }
  .brand-text { display: none; }
  .course-head { grid-template-columns: 1fr; }
  .row { gap: 12px; padding: 12px; }
  .hide-sm { display: none !important; }
  .pager { grid-template-columns: 1fr; }
  .pager a.next { grid-column: 1; }
  .prose td, .prose th { padding: 5px 4px; font-size: 14px; }
  .q-prompt .prose tr > :first-child { width: 40%; }
}
@media (max-width: 545px) {
  /* Two fact columns: let a trailing odd fact use the full row. */
  .fact:last-child:nth-child(odd) { grid-column: 1 / -1; }
}
@media (max-width: 380px) {
  .q-nav { gap: 8px; }
  .q-nav .btn { min-width: 0; padding: 0 10px; }
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
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
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

  // Teacher-written rich text as plain text for the AI tutor. A parsed (inert)
  // document means no markup, script or image request reaches the page; block
  // boundaries become line breaks so paragraphs stay readable.
  function plainText(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const box = doc.body.firstChild;
    box.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    box.querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6").forEach((node) => node.append("\n"));
    return (box.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
    constructor(message, kind, status = 0) {
      super(message);
      this.kind = kind;
      this.status = status;
    }
  }

  // The portal answers 401 with EPORTAL_LOGIN_REQUIRED when its own ePortal
  // sign-in has lapsed; that is the only sign-in the student has to redo.
  async function failure(res) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "EPORTAL_LOGIN_REQUIRED") return new ApiError("Portal 的 ePortal 登入已過期，重新登入後就能回到這裡。", "auth", res.status);
    if (res.status === 401 || res.status === 403) return new ApiError("TronClass 拒絕了這次的登入，請稍後再試。", "http", res.status);
    return new ApiError(data.error || `TronClass 回應錯誤（${res.status}），請稍後再試。`, "http", res.status);
  }

  async function request(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout?.(20000),
      });
    } catch {
      throw new ApiError("連不上 TronClass，請檢查網路後再試一次。", "network");
    }
    if (!res.ok) throw await failure(res);
    const type = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!text) return {};
    if (!type.includes("json")) {
      // Writes may answer 204 or an empty body; only a read has to be JSON.
      if (method !== "GET") return {};
      throw new ApiError("TronClass 回傳了無法讀取的內容，請稍後再試。", "http");
    }
    return JSON.parse(text);
  }

  // A 404 is a normal answer for "no attempt exists yet"; everything else still
  // fails loudly.
  async function requestMaybe(path, options) {
    try {
      return await request(path, options);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
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

  // A submitted exam changes the course's exam rows, scores and counts; drop
  // the short-lived GET cache so the overview behind the take view is fresh.
  function forgetExam(courseId, examId) {
    for (const key of [...cache.keys()]) {
      if (
        key === `/api/exams/${examId}` ||
        key.startsWith(`/api/courses/${courseId}/exams`) ||
        key.startsWith(`/api/courses/${courseId}/submitted-exams`) ||
        key.startsWith(`/api/courses/${courseId}/exam-scores`) ||
        key.startsWith(`/api/course/${courseId}/my-completeness`) ||
        key.startsWith(`/api/course/${courseId}/activity-reads-for-user`)
      ) {
        cache.delete(key);
      }
    }
  }

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

  const examOverviewHref = (courseId, examId) => `${BASE}/course/${courseId}/learning-activity#/exam/${examId}`;
  const examTakeHref = (courseId, examId) => `${examOverviewHref(courseId, examId)}/take`;
  const classicExamHref = (courseId, examId) => tcHref(examOverviewHref(courseId, examId));

  const itemHref = (courseId, item) =>
    item.kind === "exam" ? examOverviewHref(courseId, item.id) : `${BASE}/course/${courseId}/learning-activity#/${item.id}`;

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

  // Must be called from a click handler so the browser counts it as a user
  // gesture. The take view blocks the paper while an exam requires fullscreen.
  function enterFullscreen() {
    if (document.fullscreenElement) return Promise.resolve();
    const root = document.documentElement;
    if (!root.requestFullscreen) return Promise.reject(new Error("這個瀏覽器不支援全螢幕。"));
    return root.requestFullscreen();
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

  // The waiting UI and the SSO are the portal's own launch page
  // (/go/tronclass), so the handoff looks and behaves like every other ePortal
  // module launch. The launch page points the one-time ticket at the requested
  // TronClass page, so the browser lands there directly instead of on
  // TronClass's home page. Must be called from a click handler so the tab is
  // not blocked.
  function openOnTronclass(url) {
    // A fresh tab per click: reusing a named tab would navigate an exam or
    // homework that is already open there away from what the student is doing.
    const launch = new URL(`/go/tronclass?to=${encodeURIComponent(url.href)}`, location.origin).href;
    const popup = window.open(launch);
    // A blocked popup still has to go through the handoff; opening the classic
    // URL directly would land on the school's login page.
    if (!popup) location.assign(launch);
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
  // Chrome fires both popstate and hashchange for one hash navigation. Coalesce
  // them so a take view never starts two attempts on a single route change.
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
  window.addEventListener("hashchange", scheduleRender);

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
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          onclick: () => {
            menu.hidden = true;
            userButton.setAttribute("aria-expanded", "false");
            userButton.focus();
            openAiSettings();
          },
        },
        icon("sparkles"),
        "AI 助手設定",
      ),
      h("a", { href: classicHref(), "data-classic": "", role: "menuitem" }, icon("external"), "在 TronClass 開啟此頁"),
    );
  }

  // ---------------------------------------------------------------------------
  // AI tutor settings
  //
  // Lives on this page because the tutor is only used here. The server keeps
  // the key; this form only ever sees whether one has been saved.

  let settingsModal = null;
  let settingsReturnFocus = null;
  let settingsEscape = null;
  let aiTutorSettingListener = null;

  function closeAiSettings() {
    settingsModal?.remove();
    settingsModal = null;
    if (settingsEscape) {
      document.removeEventListener("keydown", settingsEscape);
      settingsEscape = null;
    }
    for (const element of document.querySelectorAll("body > header, body > main")) element.inert = false;
    const target = settingsReturnFocus;
    settingsReturnFocus = null;
    if (target && target.isConnected) target.focus({ preventScroll: true });
  }

  function aiSettingsField(label, control, hint) {
    return h(
      "label",
      { class: "field" },
      h("span", null, label),
      control,
      hint ? h("small", { class: "hint" }, hint) : null,
    );
  }

  function openAiSettings() {
    if (settingsModal) return;
    settingsReturnFocus = document.activeElement;
    const status = h("p", { class: "settings-status", id: "tc-ai-status", role: "status", "aria-live": "polite" });
    const enabled = h("input", { type: "checkbox", id: "tc-ai-enabled" });
    const provider = h(
      "select",
      { id: "tc-ai-provider" },
      h("option", { value: "opencode-go" }, "OpenCode Go"),
      h("option", { value: "openai" }, "OpenAI 相容 API"),
    );
    const baseUrl = h("input", {
      type: "url",
      id: "tc-ai-base-url",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "https://opencode.ai/inference/go/openai/v1",
    });
    const model = h("input", {
      type: "text",
      id: "tc-ai-model",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "deepseek-v4.1-flash",
    });
    const apiKey = h("input", {
      type: "password",
      id: "tc-ai-key",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      placeholder: "貼上 API 金鑰",
    });
    const clearKey = h("input", { type: "checkbox", id: "tc-ai-clear-key" });
    const save = h("button", { class: "btn primary", type: "button", id: "tc-ai-save" }, "保存");
    const presets = {
      "opencode-go": { baseUrl: "https://opencode.ai/inference/go/openai/v1", model: "deepseek-v4.1-flash" },
      openai: { baseUrl: "", model: "" },
    };

    const setStatus = (text, tone = "") => {
      status.textContent = text;
      if (tone) status.dataset.tone = tone;
      else delete status.dataset.tone;
    };

    const applyDefaults = () => {
      const preset = presets[provider.value];
      if (!preset) return;
      const otherDefault = (value, key) =>
        Object.entries(presets).some(([id, item]) => id !== provider.value && item[key] && item[key] === value.trim());
      if (preset.baseUrl && (!baseUrl.value.trim() || otherDefault(baseUrl.value, "baseUrl"))) {
        baseUrl.value = preset.baseUrl;
      } else if (!preset.baseUrl && otherDefault(baseUrl.value, "baseUrl")) {
        baseUrl.value = "";
      }
      if (preset.model && (!model.value.trim() || otherDefault(model.value, "model"))) {
        model.value = preset.model;
      } else if (!preset.model && otherDefault(model.value, "model")) {
        model.value = "";
      }
    };

    provider.addEventListener("change", applyDefaults);

    // Keep the form inert until the stored settings arrive so a slow load can
    // never overwrite something the student has already changed.
    const formControls = [enabled, provider, baseUrl, model, apiKey, clearKey, save];
    for (const control of formControls) control.disabled = true;

    save.addEventListener("click", async () => {
      if (save.disabled) return;
      save.disabled = true;
      setStatus("正在儲存…");
      const body = {
        enabled: enabled.checked,
        provider: provider.value,
        baseUrl: baseUrl.value.trim(),
        model: model.value.trim(),
        clearKey: clearKey.checked,
      };
      if (apiKey.value) body.apiKey = apiKey.value;
      try {
        const response = await fetch("/api/preferences/ai", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `儲存失敗（${response.status}）`);
        const ai = data.ai || {};
        enabled.checked = ai.enabled === true;
        provider.value = ai.provider === "openai" ? "openai" : "opencode-go";
        baseUrl.value = ai.baseUrl || baseUrl.value;
        model.value = ai.model || model.value;
        apiKey.value = "";
        apiKey.placeholder = ai.hasKey ? "已設定，留空保留" : "貼上 API 金鑰";
        clearKey.checked = false;
        setStatus("已儲存。", "saved");
        // A take view in the background can add or remove its button in place.
        aiTutorSettingListener?.(ai.enabled === true);
      } catch (error) {
        setStatus("儲存失敗：" + (error?.message || String(error)), "error");
      } finally {
        save.disabled = false;
      }
    });

    const panel = h(
      "div",
      { class: "exam-dialog ai-settings", role: "dialog", "aria-modal": "true", "aria-labelledby": "tc-ai-title", tabindex: "-1" },
      h("h2", { id: "tc-ai-title" }, "AI 助手設定"),
      h("p", null, "練習測驗的「問 AI 這題」按鈕會使用這裡的設定。API 金鑰只會儲存在 Server，不會傳回瀏覽器。"),
      h(
        "div",
        { class: "fields" },
        h("label", { class: "check" }, enabled, h("span", null, "啟用 AI 助手")),
        aiSettingsField("服務提供者", provider),
        aiSettingsField("API 位址", baseUrl),
        aiSettingsField("模型", model),
        aiSettingsField("API 金鑰", apiKey, "留空會保留目前的金鑰。"),
        h("label", { class: "check" }, clearKey, h("span", null, "清除已儲存的金鑰")),
      ),
      status,
      h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", onclick: closeAiSettings }, "關閉"), save),
    );

    settingsModal = h("div", { class: "exam-modal" }, panel);
    settingsModal.addEventListener("click", (event) => {
      if (event.target === settingsModal) closeAiSettings();
    });
    document.body.append(settingsModal);
    for (const element of document.querySelectorAll("body > header, body > main")) element.inert = true;
    settingsEscape = (event) => {
      if (event.key === "Escape") closeAiSettings();
    };
    document.addEventListener("keydown", settingsEscape);

    panel.focus({ preventScroll: true });
    fetch("/api/preferences", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!settingsModal) return;
        const ai = data?.ai || {};
        enabled.checked = ai.enabled === true;
        provider.value = ai.provider === "openai" ? "openai" : "opencode-go";
        baseUrl.value = ai.baseUrl || "";
        model.value = ai.model || "";
        apiKey.value = "";
        apiKey.placeholder = ai.hasKey ? "已設定，留空保留" : "貼上 API 金鑰";
        setStatus("");
        for (const control of formControls) control.disabled = false;
      })
      .catch(() => {
        if (!settingsModal) return;
        setStatus("無法載入 AI 設定。", "error");
        for (const control of formControls) control.disabled = false;
      });
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

    const views = { home: viewHome, courses: viewCourses, course: viewCourse, activity: viewActivity, exam: viewExam, examTake: viewExamTake };
    try {
      const content = await views[route.name](route, token);
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

  // Exam overview. Answering happens in this app; TronClass itself stays one
  // click away for invigilated exams or when the student prefers it.
  function examState(exam) {
    const now = Date.now();
    const start = toDate(exam.start_time);
    const end = toDate(exam.end_time);
    const notOpen = Boolean(start && start > now);
    const closed = Boolean(exam.is_closed || (end && end < now));
    const used = exam.submitted_times ?? 0;
    const limit = exam.submit_times || 0;
    const outOfTries = limit > 0 && used >= limit;
    return { notOpen, closed, used, limit, outOfTries, canStart: !notOpen && !closed && !outOfTries };
  }

  function examStartLink(courseId, examId, exam, label) {
    const wantsFullscreen = exam.is_fullscreen_mode && !exam.enable_invigilation && !exam.check_submit_ip_consistency && !exam.has_audio;
    return h(
      "a",
      {
        class: "btn primary",
        href: examTakeHref(courseId, examId),
        onclick: (event) => {
          // A modified click opens the take page in another tab; fullscreening
          // this one would leave the new tab blocked.
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          if (wantsFullscreen) enterFullscreen().catch(() => {});
        },
      },
      label,
      icon("arrow"),
    );
  }

  function blockedExamView(courseId, examId, title, message) {
    return h(
      "div",
      { class: "blocked" },
      h("a", { class: "back", href: examOverviewHref(courseId, examId) }, icon("left"), "測驗說明"),
      h(
        "div",
        { class: "error", role: "alert" },
        icon("shield"),
        h("h1", null, title),
        h("p", null, message),
        h(
          "div",
          { class: "actions" },
          h("a", { class: "btn primary", href: classicExamHref(courseId, examId), "data-classic": "" }, icon("external"), "在 TronClass 開啟"),
          h("a", { class: "btn ghost", href: examOverviewHref(courseId, examId) }, "回測驗說明"),
        ),
      ),
    );
  }

  async function viewExam({ courseId, examId }) {
    const [bundle, exam, scores] = await Promise.all([
      courseBundle(courseId),
      get(`/api/exams/${examId}`),
      soft(get(`/api/courses/${courseId}/exam-scores?no-intercept=true`), { exam_scores: [] }),
    ]);
    const item = bundle.ordered.find((i) => i.kind === "exam" && i.id === examId) || { kind: "exam", id: exam.id, title: exam.title, end: exam.end_time, state: "none" };
    const state = examState(exam);
    const { notOpen, closed, outOfTries, used, limit, canStart } = state;
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

    const guarded = exam.enable_anti_cheat || exam.is_fullscreen_mode || exam.is_leaving_window_constrained || exam.enable_invigilation || exam.has_audio;
    // These rules only exist in TronClass's own page; offering a start button
    // that would immediately bounce the student is worse than pointing at it.
    const classicOnly = Boolean(exam.enable_invigilation || exam.has_audio || exam.check_submit_ip_consistency);
    const startLabel = exam.has_temporary_submission ? "繼續作答" : used > 0 ? "再次作答" : "開始作答";

    const actions = h(
      "div",
      { class: "actions" },
      canStart && !classicOnly ? examStartLink(courseId, examId, exam, startLabel) : null,
      h("a", { class: classicOnly && canStart ? "btn primary" : "btn", href: classicExamHref(courseId, examId), "data-classic": "" }, icon("external"), "在 TronClass 開啟"),
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
          h(
            "span",
            null,
            "這份測驗有防作弊設定",
            exam.is_fullscreen_mode ? "，會以全螢幕作答" : "",
            exam.enable_invigilation
              ? "，且需要監考，只能在 TronClass 原版頁面作答；原版頁面會記錄作答過程。"
              : exam.check_submit_ip_consistency
                ? "。這份測驗會檢查作答 IP，只能在 TronClass 原版頁面作答。"
                : exam.has_audio
                  ? "。這份測驗有音訊題，需要在 TronClass 原版頁面作答才能播放音檔。"
                  : "。作答時請不要切換視窗或分頁；按下開始後會在這裡作答，需要時仍可在 TronClass 開啟。",
          ),
        ),
      );
    }
    parts.push(actions);
    if (exam.description) parts.push(h("section", { class: "section" }, h("h2", null, "說明"), richText(exam.description)));
    parts.push(pager(courseId, bundle, item));
    return parts;
  }

  // Taking an exam in the rebuilt page. The anti-cheat flags come from the
  // qualification call made with check_status=in_test; TronClass remains the
  // explicit fallback for invigilated exams and unsupported question types.
  const EXAM_TYPES = {
    single_selection: { kind: "radio", label: "單選" },
    true_or_false: { kind: "radio", label: "是非" },
    multiple_selection: { kind: "check", label: "多選" },
    short_answer: { kind: "text", label: "簡答" },
  };

  function examQuestions(subjects) {
    const list = [];
    const walk = (items, parentId) => {
      for (const item of [...(items || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
        // A container (an analysis group) is not a question itself; its
        // sub-questions are the ones the student answers.
        if (item.sub_subjects?.length) {
          walk(item.sub_subjects, item.id);
          continue;
        }
        list.push(parentId == null ? item : { ...item, parent_id: item.parent_id ?? parentId });
      }
    };
    walk(subjects, null);
    return list;
  }

  function formatPoint(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Number(number.toFixed(2))) : String(value);
  }

  async function viewExamTake({ courseId, examId }, token) {
    // Registered before any return: the overview may have entered fullscreen
    // for this route, and every blocked/error path must be able to leave it.
    cleanup.push(() => {
      if (document.fullscreenElement) {
        const exiting = document.exitFullscreen?.();
        if (exiting && exiting.catch) exiting.catch(() => {});
      }
    });
    const qualificationPath = `/api/exam/${examId}/check-exam-qualification?no-intercept=true&check_status=in_test`;
    const storagePath = `/api/exams/${examId}/submissions/storage`;
    const distributePath = `/api/exams/${examId}/distribute`;
    const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));
    const aiStatusRequest = fetch("/api/ai/status", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout?.(5000),
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    const [examResult, qualificationResult, aiStatusResult] = await Promise.all([
      settle(get(`/api/exams/${examId}`)),
      settle(request(qualificationPath)),
      settle(aiStatusRequest),
    ]);

    if (examResult.error) throw examResult.error;
    // A newer route change has already superseded this view; do not start an
    // attempt for a paper the student is no longer looking at.
    if (token !== renderToken) return null;
    const exam = examResult.value;
    setTitle(exam.title || "測驗");
    let aiTutorEnabled = Boolean(exam.is_practice_mode && aiStatusResult.value?.enabled);
    const state = examState(exam);
    const blocked = (title, message) => blockedExamView(courseId, examId, title, message);
    if (state.closed) return blocked("這份測驗已經結束", "測驗已關閉，無法作答。");
    if (state.notOpen) return blocked("這份測驗還沒開放", `測驗將於 ${when(exam.start_time)} 開放。`);
    if (state.outOfTries) return blocked("作答次數已用完", `已作答 ${state.used} / ${state.limit} 次，無法再作答。`);

    if (qualificationResult.error) {
      if (qualificationResult.error.kind === "auth") throw qualificationResult.error;
      return blocked("無法確認作答資格", qualificationResult.error.message);
    }
    const qualification = qualificationResult.value || {};
    if (qualification.is_closed) return blocked("這份測驗已經結束", "測驗已關閉，無法作答。");
    if (qualification.error_code) {
      return blocked("無法開始作答", qualification.error_message || qualification.message || `TronClass 回報：${qualification.error_code}`);
    }
    if (qualification.check_submit_ip_consistency || exam.check_submit_ip_consistency) {
      return blocked("需要在原版頁面作答", "這份測驗會檢查作答 IP 的一致性，只能在 TronClass 原版頁面作答。");
    }
    if (qualification.has_audio || exam.has_audio) {
      return blocked("這份測驗包含音訊題", "這份測驗有音訊題目，需要在 TronClass 原版頁面作答，才能播放題目音檔。");
    }
    if (exam.enable_invigilation || qualification.enable_invigilation) {
      return blocked(
        "這份測驗需要監考",
        "這份測驗啟用了監考，只能在 TronClass 原版頁面作答；原版頁面會記錄作答過程。",
      );
    }

    // Distribute assigns the paper instance, so it only runs after every check
    // that can still send the student back to TronClass.
    const [storageResult, distributeResult] = await Promise.all([
      settle(requestMaybe(storagePath)),
      settle(request(distributePath)),
    ]);
    if (token !== renderToken) return null;
    if (distributeResult.error) throw distributeResult.error;
    if (storageResult.error) throw storageResult.error;

    const paper = distributeResult.value || {};
    const questions = examQuestions(paper.subjects);
    if (!questions.length) return blocked("這份測驗沒有題目", "TronClass 沒有回傳可作答的題目，請使用原版頁面或稍後再試。");
    // For the cases the exam summary does not flag as audio, a single question
    // still can be: its sound must play in the original page. A group container
    // can carry the flag too, so the raw paper is walked, not the leaf list.
    const hasAudio = (items) => (items || []).some((item) => item.has_audio || hasAudio(item.sub_subjects));
    if (hasAudio(paper.subjects)) {
      return blocked("這份測驗包含音訊題", "這份測驗有音訊題目，需要在 TronClass 原版頁面作答，才能播放題目音檔。");
    }
    // Submitting here would hand in the unsupported questions unanswered, so
    // the whole paper stays on TronClass when any question cannot be rendered.
    const unsupported = questions.filter((question) => !EXAM_TYPES[question.type]);
    if (unsupported.length) {
      return blocked(
        "這份測驗要在 TronClass 作答",
        `這份測驗有 ${unsupported.length} 題是 Portal 尚未支援的題型，請使用 TronClass 原版頁面作答。`,
      );
    }
    const optionless = questions.filter((question) => {
      const type = EXAM_TYPES[question.type];
      return type && type.kind !== "text" && !(question.options || []).length;
    });
    if (optionless.length) {
      return blocked(
        "這份測驗的題目資料不完整",
        `這份測驗有 ${optionless.length} 題沒有可顯示的選項，請使用 TronClass 原版頁面作答。`,
      );
    }

    const storageValue = storageResult.value;
    // Only a stored attempt with an id can be saved into; an empty answer
    // (or a 200 with no body) means the student has no temporary attempt yet.
    const storage = storageValue && storageValue.id != null ? storageValue : null;
    let paperInstanceId = storage?.instance_id ?? paper.exam_paper_instance_id;
    if (paperInstanceId == null) return blocked("讀不到試卷", "TronClass 沒有回傳試卷編號，請使用原版頁面作答。");

    const answers = new Map();
    const answerFor = (subjectId) => {
      const key = String(subjectId);
      let answer = answers.get(key);
      if (!answer) {
        answer = { options: [], text: "", attachments: [] };
        answers.set(key, answer);
      }
      return answer;
    };
    if (storage) {
      for (const saved of storage.submission_data?.subjects || []) {
        const answer = answerFor(saved.subject_id);
        if (Array.isArray(saved.answer_option_ids)) answer.options = saved.answer_option_ids.slice();
        if (Array.isArray(saved.attachments)) answer.attachments = saved.attachments.slice();
        if (typeof saved.answer === "string") answer.text = saved.answer;
        else if (typeof saved.answer_text === "string") answer.text = saved.answer_text;
      }
    }

    const total = questions.length;
    const totalPoints = questions.reduce((sum, question) => sum + (Number(question.point) || 0), 0);
    const typeOf = (question) => EXAM_TYPES[question.type];
    const isAnswered = (question) => {
      const type = typeOf(question);
      if (!type) return false;
      const answer = answerFor(question.id);
      return type.kind === "text" ? answer.text.trim().length > 0 : answer.options.length > 0;
    };
    const answeredCount = () => questions.filter(isAnswered).length;

    let submission = storage || null;
    let starting = null;
    let current = 0;
    let left = null;
    let expired = false;
    let submitted = false;
    let submitting = false;
    let locked = false;
    let disposed = false;
    let tickTimer = null;
    let refreshTimer = null;
    let saveTimer = null;
    let saving = null;
    let saveAgain = false;
    let dialog = null;
    let dialogKind = "";
    let dialogDismissible = false;
    let dialogReturnFocus = null;
    let leaves = 0;
    let lastLeaveAt = 0;
    let leaveTimer = null;

    const barFill = h("span", { class: "bar-fill" });
    const progressText = h("span", { class: "meta num" });
    const saveStatus = h("span", { class: "save-state", role: "status", "aria-live": "polite" });
    const clockText = h("span", null, "不限時");
    const clockEl = h("span", { class: "exam-clock num" }, icon("clock"), clockText);
    const submitBtn = h("button", { class: "btn primary", type: "button", onclick: () => openSubmitDialog() }, icon("check"), "交卷");
    const fallback = h("a", { class: "btn", href: classicExamHref(courseId, examId), "data-classic": "" }, icon("external"), "在 TronClass 開啟");

    const head = h(
      "div",
      { class: "exam-head" },
      h(
        "div",
        { class: "exam-head-main" },
        h(
          "div",
          { class: "meta-row" },
          h("span", { class: "chip accent" }, "測驗"),
          exam.is_practice_mode ? h("span", { class: "chip" }, "練習") : null,
        ),
        h("h1", null, exam.title || "測驗"),
        h(
          "div",
          { class: "meta-row" },
          h("span", { class: "num" }, `${total} 題 · ${formatPoint(exam.total_points ?? totalPoints)} 分`),
          exam.limit_time ? h("span", null, `限時 ${exam.limit_time} 分鐘`) : h("span", null, "不限時"),
        ),
      ),
      h("div", { class: "exam-tools" }, clockEl, submitBtn, fallback),
      h("div", { class: "exam-progress" }, h("span", { class: "bar-track" }, barFill), progressText, saveStatus),
    );

    const questionHost = h("div", { id: "exam-question", tabindex: "-1" });
    const position = h("span", { class: "meta num" });
    const prevBtn = h("button", { class: "btn", type: "button", onclick: () => showQuestion(current - 1) }, icon("left"), "上一題");
    const nextBtn = h("button", { class: "btn", type: "button", onclick: () => showQuestion(current + 1) }, "下一題", icon("right"));
    const paperEl = h(
      "section",
      { class: "exam-paper", "aria-label": "試題" },
      questionHost,
      h("div", { class: "q-nav" }, prevBtn, position, nextBtn),
    );

    const navButtons = [];
    const navGrid = h("div", { class: "qgrid", role: "group", "aria-label": "題目導覽" });
    questions.forEach((question, index) => {
      const button = h("button", { class: "qjump num", type: "button", onclick: () => showQuestion(index) }, String(index + 1));
      navButtons.push(button);
      navGrid.append(button);
    });
    const side = h(
      "aside",
      { class: "exam-side", "aria-label": "作答進度" },
      h(
        "div",
        { class: "exam-card" },
        h("h2", null, "題目"),
        navGrid,
        h(
          "div",
          { class: "legend" },
          h("span", null, h("i", { class: "now" }), "目前"),
          h("span", null, h("i", { class: "done" }), "已作答"),
          h("span", null, h("i"), "未作答"),
        ),
      ),
    );

    function closeDialog() {
      dialog?.remove();
      dialog = null;
      dialogKind = "";
      dialogDismissible = false;
      for (const element of document.querySelectorAll("body > header, body > main")) element.inert = false;
      const target = dialogReturnFocus;
      dialogReturnFocus = null;
      if (target && target.isConnected) target.focus({ preventScroll: true });
    }

    function openDialog({ title, message, actions, kind = "info", dismissible = true }) {
      closeDialog();
      dialogReturnFocus = document.activeElement;
      dialogKind = kind;
      dialogDismissible = dismissible;
      const panel = h(
        "div",
        { class: "exam-dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "exam-dialog-title" },
        h("h2", { id: "exam-dialog-title" }, title),
        typeof message === "string" ? h("p", null, message) : message,
        h("div", { class: "actions" }, actions),
      );
      panel.dataset.kind = kind;
      dialog = h(
        "div",
        {
          class: "exam-modal",
          onclick: (event) => {
            if (dismissible && event.target === dialog) closeDialog();
          },
        },
        panel,
      );
      document.body.append(dialog);
      for (const element of document.querySelectorAll("body > header, body > main")) element.inert = true;
      const focusable = panel.querySelector("button, a");
      if (focusable) focusable.focus({ preventScroll: true });
    }

    function setSave(tone, text, title = "") {
      saveStatus.dataset.tone = tone || "";
      saveStatus.title = title;
      saveStatus.setAttribute("aria-label", text ? (title ? `${text}：${title}` : text) : "");
      if (!text) {
        saveStatus.replaceChildren();
        return;
      }
      saveStatus.replaceChildren(icon(tone === "error" ? "alert" : tone === "saved" ? "check" : "refresh"), h("span", null, text));
      if (tone === "error") {
        saveStatus.append(
          h(
            "button",
            { class: "btn small ghost", type: "button", onclick: () => (expired ? submitExam({ auto: true }) : flushSave()) },
            "重試",
          ),
        );
      }
    }

    function answerPayload() {
      const payload = [];
      questions.forEach((question, index) => {
        const type = typeOf(question);
        if (!type) return;
        const answer = answerFor(question.id);
        payload.push({
          index,
          subject_id: question.id,
          parent_id: question.parent_id ?? null,
          answer: type.kind === "text" ? { answer: answer.text, attachments: answer.attachments.slice() } : { answer_option_ids: answer.options.slice() },
        });
      });
      return payload;
    }

    function progressPayload() {
      return { answered_num: answeredCount(), total_subjects: total };
    }

    async function startAttempt() {
      if (token !== renderToken) throw new ApiError("已離開作答頁，這次作答沒有開始。", "cancelled");
      const created = await request(storagePath, {
        method: "POST",
        body: {
          exam_paper_instance_id: paperInstanceId,
          exam_submission_id: null,
          subjects: answerPayload(),
          progress: progressPayload(),
        },
      });
      let fresh = await requestMaybe(storagePath);
      if (!fresh) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        fresh = await requestMaybe(storagePath);
      }
      // The student may have left while the attempt was being created. Start
      // no clock and keep no timers for a detached view.
      if (token !== renderToken || disposed) throw new ApiError("已離開作答頁，這次作答沒有開始。", "cancelled");
      submission = fresh || created || null;
      if (!submission || submission.id == null) throw new ApiError("已建立作答，但讀不到作答編號，請重新整理後再試。", "http");
      paperInstanceId = submission.instance_id ?? paperInstanceId;
      const leftTime = Number(submission.left_time);
      if (Number.isFinite(leftTime)) setLeft(leftTime);
      else if (exam.limit_time) setLeft(exam.limit_time * 60);
      startClock();
      return submission;
    }

    async function performSave() {
      if (!submission) {
        if (starting) {
          await starting;
        } else {
          await startAttempt();
          return;
        }
      }
      if (!submission) throw new ApiError("無法開始作答，請重新整理後再試。", "http");
      await request(`/api/exams/submissions/${submission.id}/multiple-subjects`, {
        method: "PUT",
        body: {
          exam_paper_instance_id: paperInstanceId,
          exam_submission_id: submission.id,
          subjects_answers: answerPayload(),
          progress: progressPayload(),
        },
      });
    }

    function flushSave() {
      if (submitted || expired || submitting || locked) return Promise.resolve();
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (saving) {
        saveAgain = true;
        return saving;
      }
      setSave("saving", "儲存中…");
      saving = performSave()
        .then(() => setSave("saved", "已儲存"))
        .catch((error) => setSave("error", "儲存失敗", error.message))
        .finally(() => {
          saving = null;
          if (saveAgain) {
            saveAgain = false;
            flushSave();
          }
        });
      return saving;
    }

    function scheduleSave() {
      if (submitted || expired || submitting || locked) return;
      setSave("saving", "儲存中…");
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        flushSave();
      }, 600);
    }

    function paintClock() {
      clockText.textContent = left == null ? "不限時" : left <= 0 ? "時間到" : formatLeft(left);
      clockEl.classList.toggle("low", left != null && left <= 300);
    }

    function formatLeft(seconds) {
      const totalSeconds = Math.max(0, Math.ceil(seconds));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const rest = totalSeconds % 60;
      return hours
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
        : `${minutes}:${String(rest).padStart(2, "0")}`;
    }

    function setLeft(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      left = Math.max(0, number);
      paintClock();
      if (left <= 0) expire();
    }

    async function refreshLeftTime() {
      if (!submission || expired || submitted || locked) return;
      try {
        const data = await request(`/api/exams/${submission.id}/left_time`);
        if (token !== renderToken || disposed) return;
        const leftTime = Number(data.left_time);
        if (Number.isFinite(leftTime)) setLeft(leftTime);
      } catch {}
    }

    function startClock() {
      if (disposed || tickTimer || left == null) return;
      tickTimer = setInterval(() => {
        if (disposed || expired || submitted || left == null) return;
        left = Math.max(0, left - 1);
        paintClock();
        if (left <= 0) expire();
      }, 1000);
      refreshTimer = setInterval(refreshLeftTime, 30000);
    }

    function paintProgress() {
      const done = answeredCount();
      progressText.textContent = `已作答 ${done} / ${total}`;
      barFill.style.width = `${total ? (done / total) * 100 : 0}%`;
      navButtons.forEach((button, index) => {
        const question = questions[index];
        const answered = isAnswered(question);
        const supported = Boolean(typeOf(question));
        button.dataset.answered = String(answered);
        button.dataset.unsupported = String(!supported);
        button.setAttribute("aria-current", index === current ? "true" : "false");
        button.setAttribute("aria-label", `第 ${index + 1} 題${answered ? "，已作答" : ""}${supported ? "" : "，需要在 TronClass 作答"}`);
      });
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;
      position.textContent = `第 ${current + 1} / ${total} 題`;
    }

    function setPaperDisabled(disabled) {
      for (const control of paperEl.querySelectorAll("input, textarea, .qjump, .q-nav button, .q-ai")) control.disabled = disabled;
    }

    function unsupportedNotice(question, detail = "") {
      return h(
        "div",
        null,
        h(
          "div",
          { class: "note" },
          icon("alert"),
          h("span", null, `${detail ? `${detail}；` : ""}這種題型（${question.type || "未知"}）需要在 TronClass 作答。`),
        ),
        h(
          "div",
          { class: "actions", style: "margin-top:12px" },
          h("a", { class: "btn", href: classicExamHref(courseId, examId), "data-classic": "" }, icon("external"), "在 TronClass 作答"),
        ),
      );
    }

    function aiTools(question) {
      return h(
        "div",
        { class: "q-tools" },
        h(
          "button",
          { class: "btn small ghost q-ai", type: "button", onclick: () => openAiDialog(question) },
          icon("sparkles"),
          "問 AI 這題",
        ),
      );
    }

    // The settings dialog can be opened from the header while an attempt is on
    // screen; add or remove the button without re-rendering (and without
    // touching the student's text or cursor).
    function applyAiTutor(enabled) {
      aiTutorEnabled = Boolean(enabled && exam.is_practice_mode);
      if (disposed) return;
      const host = questionHost.querySelector(".q-body");
      const existing = host?.querySelector(".q-tools");
      if (aiTutorEnabled && host && !existing) host.append(aiTools(questions[current]));
      else if (!aiTutorEnabled && existing) existing.remove();
    }

    function drawQuestion() {
      const question = questions[current];
      const answer = answerFor(question.id);
      const type = typeOf(question);
      const options = [...(question.options || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      const prompt = h("div", { class: "q-prompt" });
      prompt.append(question.description ? richText(question.description) : h("p", null, "這題沒有題目內容。"));
      const body = h("div", { class: "q-body" }, prompt);
      questionHost.replaceChildren(
        h(
          "div",
          { class: "q-head" },
          h("span", { class: "q-number num" }, `第 ${current + 1} 題`),
          h("span", { class: "meta" }, type ? type.label : "需在 TronClass 作答"),
          h("span", { class: "q-points num" }, question.point != null ? `${formatPoint(question.point)} 分` : ""),
        ),
        body,
      );

      if (!type) {
        body.append(unsupportedNotice(question));
      } else if (type.kind === "text") {
        const area = h("textarea", { placeholder: "輸入你的答案…", "aria-label": `第 ${current + 1} 題答案` });
        area.value = answer.text;
        area.addEventListener("input", () => {
          answer.text = area.value;
          scheduleSave();
          paintProgress();
        });
        body.append(
          h("div", { class: "answer-area" }, area),
          h("div", { class: "q-help" }, "附件只能上傳到 TronClass 原版頁面；在這裡作答的內容不含附件。"),
        );
      } else if (options.length) {
        const list = h("ul", { class: "choices" });
        options.forEach((option, index) => {
          const input = h("input", {
            type: type.kind === "radio" ? "radio" : "checkbox",
            name: `q-${question.id}`,
            value: String(option.id),
          });
          input.checked = answer.options.some((id) => String(id) === String(option.id));
          input.addEventListener("change", () => {
            if (type.kind === "radio") {
              answer.options = [option.id];
            } else if (input.checked) {
              if (!answer.options.some((id) => String(id) === String(option.id))) answer.options.push(option.id);
            } else {
              answer.options = answer.options.filter((id) => String(id) !== String(option.id));
            }
            scheduleSave();
            paintProgress();
          });
          list.append(
            h(
              "li",
              null,
              h(
                "label",
                { class: "choice" },
                input,
                h("span", { class: "choice-index num" }, String(index + 1)),
                h("div", { class: "choice-text" }, option.content ? richText(option.content) : h("span", null, "（空白選項）")),
              ),
            ),
          );
        });
        body.append(list);
      } else {
        body.append(unsupportedNotice(question, "這題沒有可顯示的選項"));
      }
      // The setting can turn the tutor off; the server checks the practice
      // flag again for /api/ai/ask.
      if (aiTutorEnabled) {
        body.append(aiTools(question));
      }
      paintProgress();
    }

    function openAiDialog(question) {
      if (submitted || expired || submitting || locked) return;
      const type = typeOf(question);
      const answer = answerFor(question.id);
      const options = [...(question.options || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      const payload = {
        examId,
        courseId,
        question: {
          type: question.type,
          stem: plainText(question.description),
          options: options.map((option, index) => ({ index: index + 1, text: plainText(option.content) })),
          // The server's question validator reads selected answers as
          // strings; keep the 1-based option numbers the tutor prompt prints.
          selected: options
            .map((option, index) => (answer.options.some((id) => String(id) === String(option.id)) ? String(index + 1) : null))
            .filter((index) => index != null),
        },
      };
      if (type && type.kind === "text") payload.question.text = answer.text;

      const chat = h("div", { class: "ai-chat" });
      const input = h("textarea", {
        rows: "2",
        placeholder: "追問這題…（Enter 送出，Shift+Enter 換行）",
        "aria-label": "追問 AI",
      });
      const send = h("button", { class: "btn primary small", type: "submit" }, "送出");
      const follow = h("form", { class: "ai-followup", hidden: true }, input, send);
      const loading = h("div", { class: "ai-loading" }, icon("refresh"), h("span", null, "正在請 AI 看這題…"));
      chat.append(loading);
      openDialog({
        kind: "ai",
        title: "AI 解說",
        dismissible: true,
        message: h("div", null, chat, follow),
        actions: [h("button", { class: "btn ghost", type: "button", onclick: closeDialog }, "關閉")],
      });

      const live = () => dialogKind === "ai" && chat.isConnected;
      const scrollTo = (node) => {
        chat.scrollTop = Math.max(0, node.offsetTop - 8);
      };
      const turn = (role, text) => {
        const node = h("div", { class: `ai-turn ${role}` });
        node.textContent = text;
        chat.append(node);
        return node;
      };
      const history = [];
      // Keep the follow-up request small enough for the server's history
      // validator and for the provider's context window.
      const trimHistory = (messages) => {
        const kept = [];
        let total = 0;
        for (let index = messages.length - 1; index >= 0 && kept.length < 6; index -= 1) {
          const content = String(messages[index].content || "").slice(0, 12000);
          if (!content) continue;
          if (total + content.length > 20000) break;
          kept.unshift({ role: messages[index].role, content });
          total += content.length;
        }
        return kept;
      };

      const requestTurn = async (withHistory) => {
        let res;
        let data = null;
        try {
          res = await fetch("/api/ai/ask", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(withHistory ? { ...payload, history: trimHistory(history) } : payload),
            signal: AbortSignal.timeout?.(60000),
          });
          data = await res.json().catch(() => null);
        } catch {
          return { error: "連不上 AI，請檢查網路後再試一次。" };
        }
        if (res.ok && data && typeof data.answer === "string") return { answer: data.answer };
        const code = data && data.code;
        if (res.status === 403 || code === "AI_PRACTICE_ONLY") {
          return { error: "AI 助手只適用於練習測驗。" };
        }
        if (code === "AI_NOT_CONFIGURED") {
          return { error: "AI 助手還沒設定。請從右上角選單 →「AI 助手設定」填入供應商與 API 金鑰後再試一次。" };
        }
        if (res.ok) return { error: "AI 沒有回傳內容，請稍後再試一次。" };
        return { error: (data && data.error) || "AI 沒有回應，請稍後再試一次；若持續發生，請到「AI 助手設定」檢查 API 金鑰與模型。" };
      };

      void (async () => {
        const result = await requestTurn(false);
        if (!live()) return;
        loading.remove();
        if (result.answer) {
          const node = turn("ai", result.answer);
          history.push({ role: "assistant", content: result.answer });
          follow.hidden = false;
          input.focus({ preventScroll: true });
          scrollTo(node);
        } else {
          scrollTo(turn("error", result.error));
        }
      })();

      follow.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text || send.disabled) return;
        send.disabled = true;
        input.disabled = true;
        input.value = "";
        const userNode = turn("user", text);
        const bubble = h("div", { class: "ai-loading" }, icon("refresh"), h("span", null, "正在回答…"));
        chat.append(bubble);
        scrollTo(userNode);
        history.push({ role: "user", content: text });
        const result = await requestTurn(true);
        if (!live()) return;
        bubble.remove();
        send.disabled = false;
        input.disabled = false;
        if (result.answer) {
          turn("ai", result.answer);
          history.push({ role: "assistant", content: result.answer });
          input.focus({ preventScroll: true });
          // Keep the follow-up question in view; the answer starts beneath it.
          scrollTo(userNode);
        } else {
          history.pop();
          scrollTo(userNode);
          turn("error", result.error);
          input.value = text;
          input.focus({ preventScroll: true });
        }
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          follow.requestSubmit();
        }
      });
    }

    function showQuestion(index) {
      if (index < 0 || index >= total) return;
      current = index;
      drawQuestion();
      questionHost.focus({ preventScroll: true });
      if (window.innerWidth <= 860) paperEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function openSubmitDialog() {
      if (submitted || expired) return;
      const done = answeredCount();
      const unanswered = total - done;
      openDialog({
        title: "確定要交卷嗎？",
        message: h(
          "div",
          null,
          h("p", null, unanswered ? `還有 ${unanswered} 題未作答。交卷後不能修改答案。` : "所有題目都已作答。交卷後不能修改答案。"),
          h(
            "dl",
            { class: "facts" },
            h("div", { class: "fact" }, h("dt", null, "已作答"), h("dd", { class: "num" }, `${done} / ${total}`)),
            h("div", { class: "fact" }, h("dt", null, "剩下時間"), h("dd", { class: "num" }, left == null ? "不限" : left <= 0 ? "時間到" : formatLeft(left))),
          ),
        ),
        actions: [
          h("button", { class: "btn ghost", type: "button", onclick: closeDialog }, "繼續作答"),
          h(
            "button",
            {
              class: "btn primary",
              type: "button",
              onclick: () => {
                closeDialog();
                submitExam();
              },
            },
            "確認交卷",
          ),
        ],
        kind: "submit",
      });
    }

    async function submitExam({ auto = false, reason = null, label = null } = {}) {
      if (submitting || submitted) return;
      submitting = true;
      submitBtn.disabled = true;
      setPaperDisabled(true);
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      // Let an in-flight autosave finish first; the submit body already carries
      // every answer, but a write must not land after the paper is handed in.
      if (saving) {
        try {
          await saving;
        } catch {}
      }
      if (!submission && starting) {
        try {
          await starting;
        } catch {}
      }
      if (token !== renderToken || disposed) {
        submitting = false;
        return;
      }
      setSave("saving", "交卷中…");
      try {
        await request(`/api/exams/${examId}/submissions`, {
          method: "POST",
          body: {
            exam_paper_instance_id: paperInstanceId,
            exam_submission_id: submission?.id ?? null,
            subjects: answerPayload(),
            progress: progressPayload(),
            reason: reason || (auto ? "time is up" : "user"),
          },
        });
        if (token !== renderToken || disposed) {
          // The paper is handed in even though this view is gone; drop the
          // cached exam so the next page sees the new state.
          forgetExam(courseId, examId);
          submitting = false;
          return;
        }
        submitted = true;
        clearInterval(tickTimer);
        clearInterval(refreshTimer);
        forgetExam(courseId, examId);
        // Replace the take entry so Back cannot reopen a submitted paper.
        navigate(examOverviewHref(courseId, examId), { replace: true });
      } catch (error) {
        submitting = false;
        if (token !== renderToken || disposed) return;
        const outOfFullscreen = guards.fullscreen && !document.fullscreenElement;
        const closedBook = expired || locked;
        submitBtn.disabled = closedBook || outOfFullscreen;
        if (!closedBook && !outOfFullscreen) {
          setPaperDisabled(false);
          paintProgress();
        }
        setSave("error", "交卷失敗", error.message);
        openDialog({
          title: label ? `${label}，交卷失敗` : auto || expired ? "時間到，交卷失敗" : "交卷失敗",
          message: h("p", null, error.message),
          actions: [
            outOfFullscreen
              ? h("button", { class: "btn primary", type: "button", onclick: resumeAfterFailedSubmit }, "回到全螢幕")
              : closedBook
                ? null
                : h("button", { class: "btn ghost", type: "button", onclick: closeDialog }, "繼續作答"),
            h(
              "button",
              {
                class: outOfFullscreen ? "btn" : "btn primary",
                type: "button",
                onclick: () => {
                  closeDialog();
                  submitExam({ auto, reason, label });
                },
              },
              "重新交卷",
            ),
            h("a", { class: "btn", href: classicExamHref(courseId, examId), "data-classic": "" }, icon("external"), "在 TronClass 開啟"),
          ],
          kind: "submit-error",
          dismissible: !(auto || closedBook || outOfFullscreen),
        });
      }
    }

    function expire() {
      if (disposed || expired || submitted || locked) return;
      expired = true;
      left = 0;
      paintClock();
      setPaperDisabled(true);
      submitBtn.disabled = true;
      openDialog({
        title: "作答時間已結束",
        message: h("p", null, "時間到，正在自動交卷。若交卷失敗，請按重新交卷或使用 TronClass 原版頁面。"),
        actions: [
          h(
            "button",
            {
              class: "btn primary",
              type: "button",
              onclick: () => {
                closeDialog();
                submitExam({ auto: true });
              },
            },
            "重新交卷",
          ),
          h("a", { class: "btn", href: classicExamHref(courseId, examId), "data-classic": "" }, icon("external"), "在 TronClass 開啟"),
        ],
        kind: "expired",
        dismissible: false,
      });
      void submitExam({ auto: true });
    }

    function ensureSubmission() {
      if (submission) return Promise.resolve(submission);
      if (starting) return starting;
      setSave("saving", "開始作答…");
      starting = startAttempt()
        .then(() => setSave("saved", "已開始作答"))
        .catch((error) => {
          setSave("error", "無法開始作答", error.message);
          throw error;
        })
        .finally(() => {
          starting = null;
        });
      return starting;
    }

    if (storage) {
      const leftTime = Number(storage.left_time);
      if (Number.isFinite(leftTime)) left = Math.max(0, leftTime);
      else if (exam.limit_time) left = exam.limit_time * 60;
      if (answeredCount()) setSave("saved", "已載入作答");
    }

    paintClock();
    paintProgress();
    drawQuestion();
    startClock();

    const detach = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      detach.push(() => target.removeEventListener(type, handler, options));
    };

    const leaveLimit = Number(qualification.leaving_window_limit ?? exam.leaving_window_limit ?? 0) || 0;
    const leaveTimeout = Number(qualification.leaving_window_timeout ?? exam.leaving_window_timeout ?? 0) || 0;
    const guards = {
      fullscreen: Boolean(qualification.is_fullscreen_mode || exam.is_fullscreen_mode),
      leaving: Boolean(qualification.is_leaving_window_constrained || exam.is_leaving_window_constrained),
      leavingTimeout: Boolean(qualification.is_leaving_window_timeout || exam.is_leaving_window_timeout),
      copy: Boolean(qualification.disable_copy_paste || exam.disable_copy_paste),
      right: Boolean(qualification.disable_right_click || exam.disable_right_click),
    };

    function resumeFullscreen() {
      if (document.fullscreenElement) {
        if (dialogKind === "fullscreen") closeDialog();
        return;
      }
      enterFullscreen()
        .then(() => {
          if (document.fullscreenElement && dialogKind === "fullscreen") closeDialog();
        })
        .catch(() => {});
    }

    function resumeAfterFailedSubmit() {
      enterFullscreen()
        .then(() => {
          if (!expired && !locked) {
            setPaperDisabled(false);
            paintProgress();
            submitBtn.disabled = false;
          }
          closeDialog();
        })
        .catch(() => {});
    }

    function showFullscreenBlock() {
      if (disposed || submitted || expired || locked) return;
      openDialog({
        title: "回到全螢幕",
        message: h("p", null, "這份測驗必須在全螢幕中作答。請回到全螢幕後繼續；離開全螢幕時作答不會暫停。"),
        actions: [
          h("button", { class: "btn primary", type: "button", onclick: resumeFullscreen }, "回到全螢幕"),
          h(
            "button",
            {
              class: "btn",
              type: "button",
              onclick: () => {
                closeDialog();
                submitExam();
              },
            },
            "交卷",
          ),
          fallback.cloneNode(true),
        ],
        kind: "fullscreen",
        dismissible: false,
      });
    }

    if (guards.fullscreen) {
      listen(document, "fullscreenchange", () => {
        if (disposed || submitted || expired) return;
        if (!document.fullscreenElement) showFullscreenBlock();
        else {
          if (dialogKind === "fullscreen") closeDialog();
          if (!submitting && !locked) {
            setPaperDisabled(false);
            paintProgress();
            submitBtn.disabled = false;
          }
        }
      });
      if (!document.fullscreenElement) queueMicrotask(() => {
        if (!disposed && !submitted && !expired && !document.fullscreenElement) showFullscreenBlock();
      });
    }

    function stopLeaveCountdown() {
      if (leaveTimer) {
        clearInterval(leaveTimer);
        leaveTimer = null;
      }
    }

    function enforceLeaveSubmit(reason, label) {
      if (disposed || submitted || expired || submitting) return;
      locked = true;
      stopLeaveCountdown();
      closeDialog();
      setPaperDisabled(true);
      submitBtn.disabled = true;
      void submitExam({ auto: true, reason, label });
    }

    function noteLeave() {
      if (disposed || submitted || expired || locked || (!guards.leaving && !guards.leavingTimeout)) return;
      if (dialogKind === "fullscreen") return;
      const now = Date.now();
      if (now - lastLeaveAt < 800) return;
      lastLeaveAt = now;
      leaves += 1;
      if (guards.leaving && leaveLimit > 0 && leaves > leaveLimit) {
        enforceLeaveSubmit("leave_window_limit", "已離開作答視窗太多次");
        return;
      }
      stopLeaveCountdown();
      const countdown = h("span", { class: "num" });
      const message = h(
        "p",
        null,
        `系統偵測到你離開作答視窗 ${leaves} 次${guards.leaving && leaveLimit > 0 ? `（上限 ${leaveLimit} 次）` : ""}。`,
      );
      if (guards.leavingTimeout && leaveTimeout > 0) {
        countdown.textContent = String(leaveTimeout);
        message.append("若 ", countdown, " 秒內沒有回到這個分頁，系統會自動交卷。");
        let remaining = leaveTimeout;
        leaveTimer = setInterval(() => {
          remaining -= 1;
          countdown.textContent = String(Math.max(0, remaining));
          if (remaining <= 0) {
            stopLeaveCountdown();
            enforceLeaveSubmit("leave_window_timeout", "已離開作答視窗太久");
          }
        }, 1000);
      } else {
        message.append("請留在這個分頁完成測驗。");
      }
      openDialog({
        title: "已離開作答視窗",
        message,
        actions: [
          h(
            "button",
            {
              class: "btn primary",
              type: "button",
              onclick: () => {
                stopLeaveCountdown();
                closeDialog();
              },
            },
            "繼續作答",
          ),
          h(
            "button",
            {
              class: "btn",
              type: "button",
              onclick: () => {
                stopLeaveCountdown();
                closeDialog();
                submitExam();
              },
            },
            "交卷",
          ),
          h("a", { class: "btn ghost", href: classicExamHref(courseId, examId), "data-classic": "" }, "在 TronClass 開啟"),
        ],
        kind: "leave",
        dismissible: !(guards.leavingTimeout && leaveTimeout > 0),
      });
    }

    if (guards.leaving || guards.leavingTimeout) {
      listen(document, "visibilitychange", () => {
        if (document.visibilityState === "hidden") noteLeave();
        else stopLeaveCountdown();
      });
      listen(window, "blur", noteLeave);
      listen(window, "focus", stopLeaveCountdown);
      // Any interaction with the page means the student is back.
      listen(document, "pointerdown", stopLeaveCountdown);
      listen(document, "keydown", stopLeaveCountdown, true);
    }
    // Background tabs throttle timers; ask TronClass for the real remaining
    // time as soon as the student comes back.
    listen(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") refreshLeftTime();
    });

    if (guards.copy) {
      const block = (event) => event.preventDefault();
      listen(document, "copy", block);
      listen(document, "cut", block);
      listen(document, "paste", block);
    }
    if (guards.right) {
      listen(document, "contextmenu", (event) => event.preventDefault());
    }

    listen(document, "keydown", (event) => {
      if (event.key === "Escape" && dialog && dialogDismissible) closeDialog();
    });

    aiTutorSettingListener = applyAiTutor;
    cleanup.push(() => {
      disposed = true;
      if (aiTutorSettingListener === applyAiTutor) aiTutorSettingListener = null;
      detach.forEach((fn) => fn());
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (!submitted && !expired && !submitting) void flushSave();
      }
      clearInterval(tickTimer);
      clearInterval(refreshTimer);
      stopLeaveCountdown();
      closeDialog();
    });

    if (!storage) void ensureSubmission().catch(() => {});
    if (left != null && left <= 0) expire();

    return [
      h("a", { class: "back", href: examOverviewHref(courseId, examId) }, icon("left"), "測驗說明"),
      head,
      h("div", { class: "exam-layout" }, paperEl, side),
    ];
  }

  // Same colours as the dashboard (the page has no #portalBackdrop, so no image).
  window.NutcTheme?.init?.().catch(() => {});
  render();
})();
