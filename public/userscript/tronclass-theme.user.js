// ==UserScript==
// @name         NUTC Portal TronClass Theme
// @namespace    https://github.com/Rynowastaken/Personal-NUTC-Eportal
// @version      0.1.1
// @description  Restyle NUTC TronClass (tc.nutc.edu.tw) in the NUTC Portal dark tile look, exam pages included.
// @author       Rynowastaken
// @match        https://tc.nutc.edu.tw/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Rynowastaken/Personal-NUTC-Eportal/main/public/userscript/tronclass-theme.user.js
// @downloadURL  https://raw.githubusercontent.com/Rynowastaken/Personal-NUTC-Eportal/main/public/userscript/tronclass-theme.user.js
// ==/UserScript==

(() => {
  "use strict";

  // Purely visual: this script only adds a stylesheet and marker classes on
  // TronClass's own chrome. It never reads, sends or changes course data, and
  // it never edits rich-text content (so nothing it does can be saved back).
  const STYLE_ID = "nutc-portal-tronclass-theme";
  const FONT_URL =
    "https://cdn.jsdelivr.net/gh/Rynowastaken/Personal-NUTC-Eportal@main/public/fonts/albert-sans.woff2";

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
  --tcx-bg: #141018;
  --tcx-surface: #1c1720;
  --tcx-raised: #261f2b;
  --tcx-sunken: #110d14;
  --tcx-edge: rgba(255, 255, 255, .10);
  --tcx-edge-strong: rgba(255, 255, 255, .18);
  --tcx-text: #f4eef3;
  --tcx-soft: #d9cfd7;
  --tcx-muted: #b9aeb7;
  --tcx-faint: #948996;
  --tcx-primary: #f0a8c8;
  --tcx-primary-hover: #f6c2da;
  --tcx-on-primary: #2a1620;
  --tcx-primary-soft: rgba(240, 168, 200, .14);
  --tcx-primary-ring: rgba(240, 168, 200, .38);
  --tcx-honey: #e8b86d;
  --tcx-danger: #f4a0a5;
  --tcx-success: #8fd8ad;
  --tcx-radius: 6px;
  --tcx-radius-sm: 4px;
  --tcx-font: "Albert Sans", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;

  /* TronClass's own design tokens, remapped onto the dark palette. */
  --primary-brand-color: var(--tcx-primary);
  --primary-brand-color-darkened-1: #e595ba;
  --primary-brand-color-darkened-2: #d982ab;
  --primary-brand-color-darkened-3: #b9668d;
  --primary-brand-color-lightened-1: #f4bcd5;
  --primary-brand-color-lightened-2: #f7cfe1;
  --primary-brand-color-lightened-3: #4a3442;
  --primary-brand-color-lightened-4: #2c2030;
  --primary-brand-color-lightened-5: var(--tcx-honey);
  --primary-brand-color-lightened-6: #2a2219;
  --primary-brand-color-lightened-7: var(--tcx-honey);
  --primary-button-bg-color: var(--tcx-primary);
  --primary-button-bg-hover-color: var(--tcx-primary-hover);
  --primary-text-color: var(--tcx-text);
  --secondary-text-color: var(--tcx-muted);
  --third-text-color: var(--tcx-soft);
  --standard-black: var(--tcx-text);
  --link-color: var(--tcx-primary);
  --nprogress-color: var(--tcx-primary);
  --nav-bg-color: #100c13;
  --nav-color: var(--tcx-muted);
  --nav-active-color: var(--tcx-text);
  --nav-avatar-color: var(--tcx-primary);
  --highlight-color: var(--tcx-honey);
  --tag-primary-border-color: var(--tcx-primary-ring);
  --state-success-color-lightened-3: #16261d;
  --state-error-color-lightened-3: #2c1719;
  --state-warning-color-lightened-3: #2a2219;
  --state-info-color-lightened-3: #161f2c;
}

html, body {
  background: var(--tcx-bg) !important;
  color: var(--tcx-soft) !important;
}
body {
  background:
    radial-gradient(1200px 600px at 12% -10%, rgba(240, 168, 200, .07), transparent 60%),
    radial-gradient(900px 500px at 100% 0%, rgba(232, 184, 109, .05), transparent 55%),
    var(--tcx-bg) !important;
  background-attachment: fixed !important;
}
body, button, input, select, textarea,
.ivu-btn, .ivu-input, .ivu-select, .select2-container {
  font-family: var(--tcx-font) !important;
}
::selection { background: var(--tcx-primary-ring); color: var(--tcx-text); }
* { scrollbar-color: rgba(255, 255, 255, .22) transparent; }
h1, h2, h3, h4, h5, h6, .title, .course-name, .exam-title { color: var(--tcx-text) !important; }
a { color: var(--tcx-primary); }
a:hover { color: var(--tcx-primary-hover); }
hr { border-color: var(--tcx-edge) !important; }

/* App chrome: navigation bar and footer. */
.header {
  background: rgba(16, 12, 19, .88) !important;
  border-bottom: 1px solid var(--tcx-edge) !important;
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}
.header .header-item, .header .entry, .header a { color: var(--tcx-muted) !important; }
.header .header-item:hover, .header a:hover { color: var(--tcx-text) !important; }
.sites-menu-entry a { background: rgba(255, 255, 255, .06) !important; }
/* The school logo is dark ink on transparent: keep it as is on a light chip. */
.header img.logo { background: rgba(255, 255, 255, .92); border-radius: var(--tcx-radius-sm); padding: 3px 6px; box-sizing: content-box; }
.footer {
  position: static !important;
  background: transparent !important;
  border-top: 1px solid var(--tcx-edge) !important;
  color: var(--tcx-faint) !important;
}
.footer * { color: var(--tcx-faint) !important; }
.wrapper, .main-content, .main-content-container, .content-under-nav-1, .content-under-nav-2 {
  background: transparent !important;
}

/* Panels: one flat surface, one hairline, 6px corners. No sheen, no shadow. */
.card, .user-menu, .paper-content, .answer-card, .teaching-class-header, .user-courses,
.notification-t-item, .latest-visit-course, .activity-content-box, .module-container,
.exam-activity-box,
.reveal-modal, .popup-content-wrapper, .ivu-modal-content, .ivu-card {
  background: var(--tcx-surface) !important;
  border: 1px solid var(--tcx-edge) !important;
  border-radius: var(--tcx-radius) !important;
  box-shadow: none !important;
  color: var(--tcx-soft) !important;
}
.card .card, .user-menu .menu, .exam-activity-box .card { border: 0 !important; background: transparent !important; }
.course-header-container, .course-activity-tabs-container, .course-info {
  background: transparent !important;
  border-color: var(--tcx-edge) !important;
}
.course-header-container { border-bottom: 1px solid var(--tcx-edge) !important; }
.exam-basic-info, .subjects-summary-box, .function-bar, .card-header, .card-footer,
.popup-header, .popup-footer, .ivu-modal-header, .ivu-modal-footer {
  background: transparent !important;
  border-color: var(--tcx-edge) !important;
}
.exam-basic-info {
  background: var(--tcx-raised) !important;
  border-radius: var(--tcx-radius-sm) !important;
}
/* Anything else TronClass painted white goes transparent over the dark page
   (no new boxes), and its own hairlines are re-inked. */
.tcx-light-surface { background-color: transparent !important; border-color: var(--tcx-edge) !important; }
.tcx-light-layer { background-color: var(--tcx-raised) !important; }
.tcx-light-border { border-color: var(--tcx-edge) !important; }
.tcx-dark-ink { color: var(--tcx-soft) !important; }

/* Text tiers. */
.user-role, .course-klass-header, .summary-sub-title, .block-label, .card .secondary,
.notification-item .time, .course .course-code, .estimate-item { color: var(--tcx-muted) !important; }

/* Left menu: quiet rows, a soft primary pill for the current page. */
.user-menu .group-name { color: var(--tcx-faint) !important; font-size: 12px !important; letter-spacing: .02em; }
.user-menu .menu a {
  color: var(--tcx-soft) !important;
  border-radius: var(--tcx-radius-sm) !important;
  transition: background-color .15s ease, color .15s ease;
}
.user-menu .menu a:hover { background: rgba(255, 255, 255, .05) !important; color: var(--tcx-text) !important; }
.user-menu .menu a.active {
  background: var(--tcx-primary-soft) !important;
  color: var(--tcx-primary) !important;
}
.user-menu .menu a.active * { color: var(--tcx-primary) !important; }
.user-name { color: var(--tcx-text) !important; font-weight: 500 !important; }
.user-info { border-color: var(--tcx-edge) !important; }

/* Home feed tab: a 2px underline instead of the white pointer image. */
.dashboard-tab .icon-notification-tab-arrow { display: none !important; }
.dashboard-tab.active { box-shadow: inset 0 -2px 0 var(--tcx-primary); }

/* To-do list: drop the blue bracket stripe; each item is a quiet row. */
.todo-list .font-bracket-left { display: none !important; }
.todo-list { border: 1px solid var(--tcx-edge) !important; border-radius: var(--tcx-radius-sm) !important; background: var(--tcx-raised) !important; }
.todo-list:hover { border-color: var(--tcx-edge-strong) !important; }

/* Tabs: text tabs with a 2px primary underline on the current one. */
.dashboard-tab, .course-activity-tabs a, .course-activity-tabs li, .ivu-tabs-tab { color: var(--tcx-muted) !important; }
.dashboard-tab.active, .dashboard-tab.active *, .course-activity-tabs .active, .course-activity-tabs .active a,
.ivu-tabs-tab-active { color: var(--tcx-text) !important; }
.ivu-tabs-ink-bar, .course-activity-tabs .active::after { background: var(--tcx-primary) !important; }
.course-menu-container a, .course-menu-container span { color: var(--tcx-muted) !important; }
.course-menu-container a:hover, .course-menu-container a:hover span { color: var(--tcx-text) !important; }

/* Course progress: dark track, primary fill. */
.study-completeness-bar { background: rgba(255, 255, 255, .08) !important; border-radius: 99px !important; overflow: hidden; }
.study-completeness-bar .completed-part { background: var(--tcx-primary) !important; border-radius: 99px !important; }
.activity-summary .completeness { border-radius: 99px !important; }
.activity-summary .completeness:not(.full) { background: rgba(255, 255, 255, .10) !important; }

/* Course list and recent courses: rows that lift their tint on hover. */
li.course, .visited-course {
  border-color: var(--tcx-edge) !important;
  border-radius: var(--tcx-radius-sm);
  transition: background-color .15s ease;
}
li.course:hover, .visited-course:hover { background: rgba(255, 255, 255, .035) !important; }
li.course .course-name, li.course .course-name a, .visited-course .name { color: var(--tcx-text) !important; font-weight: 500; }
.course-cover, li.course img, .visited-course img {
  border-radius: var(--tcx-radius-sm) !important;
  filter: brightness(.86) saturate(.9);
}
.notification-t-item { transition: border-color .15s ease; }
.notification-t-item:hover { border-color: var(--tcx-edge-strong) !important; }

/* Buttons. */
.button, .ivu-btn, button.button {
  background: var(--tcx-raised) !important;
  border: 1px solid var(--tcx-edge-strong) !important;
  border-radius: 5px !important;
  color: var(--tcx-text) !important;
  box-shadow: none !important;
  transition: background-color .15s ease, border-color .15s ease;
}
.button:hover, .ivu-btn:hover { border-color: rgba(255, 255, 255, .28) !important; background: #2f2735 !important; }
.button-green, .button.primary, .ivu-btn-primary, .button-blue, .full-screen-header-button {
  background: var(--tcx-primary) !important;
  border-color: var(--tcx-primary) !important;
  color: var(--tcx-on-primary) !important;
  font-weight: 600 !important;
}
.button-green:hover, .button.primary:hover, .ivu-btn-primary:hover, .full-screen-header-button:hover {
  background: var(--tcx-primary-hover) !important;
  border-color: var(--tcx-primary-hover) !important;
}
.button-green *, .button.primary *, .ivu-btn-primary *, .button-blue *, .full-screen-header-button * { color: inherit !important; }
.button-red, .ivu-btn-error { background: #3a1c21 !important; border-color: rgba(244, 160, 165, .35) !important; color: var(--tcx-danger) !important; }
.button[disabled], .button.disabled, .ivu-btn[disabled] { opacity: .45 !important; }
.button:focus-visible, .ivu-btn:focus-visible, a:focus-visible {
  outline: 2px solid var(--tcx-primary) !important;
  outline-offset: 2px;
}

/* Form controls. */
input[type="text"], input[type="search"], input[type="number"], input[type="password"], input[type="email"],
input:not([type]), textarea, select, .keyword,
.select2-container .select2-choice, .select2-container .select2-choices, .ivu-input, .ivu-select-selection,
.ivu-input-number, .ivu-date-picker-editor {
  background: var(--tcx-sunken) !important;
  border: 1px solid var(--tcx-edge-strong) !important;
  border-radius: 5px !important;
  color: var(--tcx-text) !important;
  box-shadow: none !important;
}
input::placeholder, textarea::placeholder { color: var(--tcx-faint) !important; }
input:focus, textarea:focus, select:focus, .select2-container-active .select2-choice, .ivu-input:focus {
  border-color: var(--tcx-primary) !important;
  box-shadow: 0 0 0 3px var(--tcx-primary-ring) !important;
  outline: none !important;
}
.select2-container .select2-choice > .select2-chosen, .select2-arrow { color: var(--tcx-text) !important; background: transparent !important; border: 0 !important; }
input[type="radio"], input[type="checkbox"] { accent-color: var(--tcx-primary); }

/* Floating layers: dropdowns, menus, tooltips. */
.f-dropdown, .dropdown-menu, .select2-drop, .select2-results, .ivu-select-dropdown, .ivu-dropdown-menu,
.ivu-poptip-inner, .ivu-tooltip-inner, .autocollapse-more ul, .header .dropdown,
.ui-multiselect-menu, .ui-menu, .ui-autocomplete, .ui-datepicker, .ui-dialog, .tcx-light-layer {
  background: var(--tcx-raised) !important;
  border: 1px solid var(--tcx-edge-strong) !important;
  border-radius: var(--tcx-radius) !important;
  box-shadow: 0 18px 50px rgba(0, 0, 0, .45) !important;
  color: var(--tcx-soft) !important;
}
.f-dropdown li a, .dropdown-menu li a, .select2-results li, .ivu-select-item, .ivu-dropdown-item { color: var(--tcx-soft) !important; }
.f-dropdown li:hover, .f-dropdown li a:hover, .select2-results .select2-highlighted, .ivu-select-item:hover,
.ivu-select-item-focus, .ivu-dropdown-item:hover { background: rgba(255, 255, 255, .06) !important; color: var(--tcx-text) !important; }
.ivu-select-item-selected { color: var(--tcx-primary) !important; }
/* jQuery UI widgets (filters, date pickers) used across TronClass. */
.ui-widget-content, .ui-widget-header, .ui-multiselect-header, .ui-multiselect-checkboxes, .ui-multiselect-filter {
  background: transparent !important;
  border-color: var(--tcx-edge) !important;
  color: var(--tcx-soft) !important;
}
.ui-multiselect-menu, .ui-datepicker, .ui-dialog { background: var(--tcx-raised) !important; }
.ui-multiselect-checkboxes label, .ui-menu-item, .ui-datepicker td a { color: var(--tcx-soft) !important; border-radius: var(--tcx-radius-sm); }
.ui-state-hover, .ui-state-focus, .ui-multiselect-checkboxes label:hover, .ui-menu-item:hover {
  background: rgba(255, 255, 255, .06) !important;
  border-color: transparent !important;
  color: var(--tcx-text) !important;
}
.ui-state-active, .ui-state-highlight, .ui-datepicker .ui-state-active {
  background: var(--tcx-primary-soft) !important;
  border-color: var(--tcx-primary-ring) !important;
  color: var(--tcx-primary) !important;
}
.ui-multiselect, button.ui-multiselect { background: var(--tcx-sunken) !important; border: 1px solid var(--tcx-edge-strong) !important; color: var(--tcx-text) !important; border-radius: 5px !important; }
.reveal-modal-bg, .ivu-modal-mask { background: rgba(8, 6, 10, .72) !important; }

/* Tables. */
table, .ivu-table, .ivu-table-wrapper { background: transparent !important; color: var(--tcx-soft) !important; border-color: var(--tcx-edge) !important; }
th, .ivu-table th { background: var(--tcx-raised) !important; color: var(--tcx-muted) !important; border-color: var(--tcx-edge) !important; }
td, .ivu-table td, tr { background: transparent !important; border-color: var(--tcx-edge) !important; }
tr:hover td { background: rgba(255, 255, 255, .03) !important; }

/* Pager. */
.list-pager li, .list-pager a { color: var(--tcx-muted) !important; border-color: var(--tcx-edge) !important; background: transparent !important; border-radius: var(--tcx-radius-sm); }
.list-pager li.active, .list-pager li.active a, .list-pager .current { background: var(--tcx-primary-soft) !important; color: var(--tcx-primary) !important; }

/* Rich text written by teachers: re-ink black/white inline colours only, keep
   intentional ones (red, blue highlights). CSS only, so nothing is ever saved. */
.simditor-viewer, .rich-edited, .activity-description { color: var(--tcx-soft) !important; }
.simditor-viewer [style*="color: rgb(0, 0, 0)"], .simditor-viewer [style*="color:rgb(0,0,0)"],
.simditor-viewer [style*="color: #000"], .simditor-viewer [style*="color:#000"],
.simditor-viewer [style*="color: black"], .simditor-viewer [style*="color: rgb(51, 51, 51)"],
.simditor-viewer [style*="color: windowtext"], .simditor-viewer font[color="#000000"],
.simditor-viewer [style*="color:#000000"], .simditor-viewer [style*="color: rgb(34, 34, 34)"],
.rich-edited [style*="color: rgb(0, 0, 0)"], .rich-edited [style*="color: #000"],
.rich-edited [style*="color: black"], .rich-edited [style*="color: rgb(51, 51, 51)"],
.rich-edited font[color="#000000"] {
  color: var(--tcx-soft) !important;
}
.simditor-viewer [style*="background-color: rgb(255, 255, 255)"], .simditor-viewer [style*="background-color: #fff"],
.simditor-viewer [style*="background: rgb(255, 255, 255)"], .simditor-viewer [style*="background-color: white"],
.rich-edited [style*="background-color: rgb(255, 255, 255)"], .rich-edited [style*="background-color: #fff"],
.rich-edited [style*="background-color: white"] {
  background-color: transparent !important;
}
.simditor-viewer [style*="background-color: rgb(255, 255, 0)"], .rich-edited [style*="background-color: rgb(255, 255, 0)"],
.simditor-viewer [style*="background-color: yellow"], .rich-edited [style*="background-color: yellow"] {
  background-color: rgba(232, 184, 109, .28) !important;
  color: var(--tcx-text) !important;
}
.simditor-viewer img, .rich-edited img { border-radius: var(--tcx-radius-sm); background: #fff; }
.simditor-viewer table td, .rich-edited table td { border: 1px solid var(--tcx-edge-strong) !important; }
.simditor .simditor-body, [contenteditable="true"] { background: var(--tcx-sunken) !important; color: var(--tcx-text) !important; }
.simditor .simditor-toolbar { background: var(--tcx-raised) !important; border-color: var(--tcx-edge) !important; }
.simditor .simditor-toolbar a { color: var(--tcx-muted) !important; }

/* ── Exams ─────────────────────────────────────────────────────────────── */

/* Overview: an info grid and one clear start button. */
.exam-basic-info { padding: 14px 18px !important; }
.exam-basic-info * { color: var(--tcx-soft) !important; }
.exam-button-container .button { display: inline-flex !important; align-items: center; justify-content: center; min-height: 40px; height: auto !important; padding: 0 20px !important; }

/* Rules dialog: the time-window line is a warning, not a yellow marker. */
.confirmation-popup .main-area > div:first-child, .confirmation-popup .rules, .confirmation-popup ol, .confirmation-popup ul {
  background: var(--tcx-raised) !important;
  border-radius: var(--tcx-radius-sm) !important;
  color: var(--tcx-soft) !important;
}
.confirmation-popup [style*="background"], .confirmation-popup .highlight, .confirmation-popup mark {
  background: rgba(232, 184, 109, .16) !important;
  color: var(--tcx-honey) !important;
  border-radius: 3px;
}
.confirmation-popup [style*="color: red"], .confirmation-popup [style*="color:red"], .confirmation-popup .red { color: var(--tcx-honey) !important; }

/* Taking an exam: calm reading column, sticky answer card. */
.exam-activity-container > .hd {
  background: rgba(16, 12, 19, .92) !important;
  border-bottom: 1px solid var(--tcx-edge) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.exam-activity-container > .hd .exam-title { font-weight: 300 !important; letter-spacing: -.02em; }
.answer-card .title { color: var(--tcx-text) !important; font-weight: 500; }
.answer-card .progress-info, .answer-card .progress-info * { color: var(--tcx-muted) !important; font-variant-numeric: tabular-nums; }
.answer-card .progress-info .answered, .answer-card .progress-info span:first-child { color: var(--tcx-primary) !important; }
.answer-card .progress { background: rgba(255, 255, 255, .08) !important; border-radius: 99px !important; overflow: hidden; }
.answer-card .progress .meter { background: var(--tcx-primary) !important; border-radius: 99px !important; }
.answer-card .card-header, .answer-card .card-footer { border-color: var(--tcx-edge) !important; }
.answer-card .card-footer .icon { border-radius: 2px !important; border: 1px solid var(--tcx-edge-strong) !important; }
.answer-card .card-footer .icon.answered { background: var(--tcx-primary-soft) !important; border-color: var(--tcx-primary-ring) !important; }
.answer-card .card-footer .icon.unanswered { background: var(--tcx-raised) !important; }
.subjects-list .subject-item {
  background: var(--tcx-raised) !important;
  border: 1px solid var(--tcx-edge) !important;
  border-radius: var(--tcx-radius-sm) !important;
  color: var(--tcx-muted) !important;
  font-variant-numeric: tabular-nums;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease;
}
.subjects-list .subject-item:hover { border-color: var(--tcx-edge-strong) !important; color: var(--tcx-text) !important; }
.subjects-list .subject-item.answered, .subjects-list .subject-item.active.answered {
  background: var(--tcx-primary-soft) !important;
  border-color: var(--tcx-primary-ring) !important;
  color: var(--tcx-primary) !important;
}
.subjects-list .subject-item.active, .subjects-list .subject-item.current { border-color: var(--tcx-primary) !important; color: var(--tcx-text) !important; }
.subjects-list .subject-item.marked, .subjects-list .subject-item.flagged { box-shadow: inset 0 -2px 0 var(--tcx-honey) !important; }

.exam-description { background: transparent !important; border: 0 !important; border-bottom: 1px solid var(--tcx-edge) !important; border-radius: 0 !important; }
.exam-subjects ol.subjects-jit-display > li.subject {
  padding: 22px 0 !important;
  border-bottom: 1px solid var(--tcx-edge) !important;
}
.exam-subjects ol.subjects-jit-display > li.subject:last-child { border-bottom: 0 !important; }
.exam-paper .subject-head .summary-title, .exam-paper .subject-description,
.exam-paper .subject-description *, .exam-paper .option-content, .exam-paper .option-content * {
  font-family: var(--tcx-font) !important;
}
.exam-paper .subject-head .summary-title { color: var(--tcx-text) !important; font-size: 16px !important; line-height: 1.6 !important; }
.exam-paper .subject-resort-index { color: var(--tcx-primary) !important; font-weight: 600; font-variant-numeric: tabular-nums; }
.exam-paper .summary-sub-title, .exam-paper .summary-sub-title * { color: var(--tcx-faint) !important; font-size: 12.5px !important; }

/* Options become full-width choice rows with a clear selected state. */
.exam-paper .subject-options { margin-top: 12px !important; }
.exam-paper .subject-options > li.option { margin: 0 0 8px !important; }
.exam-paper .subject-options > li.option > label {
  display: flex !important;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px !important;
  border: 1px solid var(--tcx-edge) !important;
  border-radius: var(--tcx-radius) !important;
  background: rgba(255, 255, 255, .02) !important;
  color: var(--tcx-soft) !important;
  cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease;
}
.exam-paper .subject-options > li.option > label:hover { border-color: var(--tcx-edge-strong) !important; background: rgba(255, 255, 255, .045) !important; }
.exam-paper .subject-options > li.option > label:has(input:checked) {
  border-color: var(--tcx-primary) !important;
  background: var(--tcx-primary-soft) !important;
  color: var(--tcx-text) !important;
}
.exam-paper .subject-options > li.option > label:has(input:focus-visible) { outline: 2px solid var(--tcx-primary); outline-offset: 2px; }
.exam-paper .subject-options .left { display: inline-flex !important; align-items: center; gap: 8px; float: none !important; flex-shrink: 0; }
.exam-paper .subject-options input { margin: 0 !important; width: 16px; height: 16px; position: static !important; top: auto !important; vertical-align: middle !important; }
.exam-paper .option-index { color: var(--tcx-muted) !important; font-weight: 600; font-variant-numeric: tabular-nums; }
.exam-paper .subject-options > li.option > label:has(input:checked) .option-index { color: var(--tcx-primary) !important; }
.exam-paper .option-content { flex: 1; min-width: 0; color: inherit !important; }
.exam-paper .option-content * { color: inherit !important; }

/* Results and review: keep the right/wrong meaning, in the portal's colours. */
[class*="correct-answer"], .option.correct > label, .subject.correct .subject-resort-index, .is-correct {
  border-color: rgba(143, 216, 173, .55) !important;
  color: var(--tcx-success) !important;
}
.option.correct > label { background: rgba(143, 216, 173, .10) !important; }
.option.wrong > label, .option.incorrect > label, .is-wrong {
  border-color: rgba(244, 160, 165, .55) !important;
  background: rgba(244, 160, 165, .10) !important;
  color: var(--tcx-danger) !important;
}
.answer-analysis, .subject-explanation, .correct-answer-box {
  background: var(--tcx-raised) !important;
  border: 1px solid var(--tcx-edge) !important;
  border-radius: var(--tcx-radius-sm) !important;
  color: var(--tcx-soft) !important;
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
@media (max-width: 640px) {
  .exam-paper .subject-options > li.option > label { padding: 12px !important; }
}
`;

  // The script runs before TronClass's stylesheets arrive, and those reset the
  // same tokens and panels, so this sheet must stay the last one in <head> to
  // win the cascade.
  let headObserver = null;
  let observedHead = null;
  function injectStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
    }
    const parent = document.head || document.documentElement;
    if (parent.lastElementChild !== style) parent.append(style);
    if (document.head && observedHead !== document.head) {
      headObserver?.disconnect();
      observedHead = document.head;
      headObserver = new MutationObserver(() => injectStyle());
      headObserver.observe(observedHead, { childList: true });
    }
  }

  // TronClass hard-codes white panels and near-black text all over its many
  // screens. Rather than chase every class, mark TronClass's own chrome that
  // still renders white or near-black after the stylesheet, so CSS can re-ink
  // it. Rich-text and editable content is skipped: it belongs to teachers or
  // to the student's answers and must never be touched.
  const SKIP = "img, video, canvas, iframe, svg, picture, water-mark, .simditor-viewer, .rich-edited, [contenteditable], .simditor, .mathjax-process, #nutc-portal-tronclass-theme";
  const channels = (value) => (value.match(/[\d.]+/g) || []).map(Number);

  function classify(element) {
    if (element.closest(SKIP)) return;
    const style = getComputedStyle(element);
    const [r, g, b, a = 1] = channels(style.backgroundColor);
    if (a > 0.85 && r >= 232 && g >= 232 && b >= 232) {
      const box = element.getBoundingClientRect();
      // Floating panels need a solid fill; in-flow ones can just go clear.
      const floating = style.position === "absolute" || style.position === "fixed";
      if (box.width > 24 && box.height > 16) {
        element.classList.add(floating ? "tcx-light-layer" : "tcx-light-surface");
      }
    }
    for (const side of ["Top", "Bottom", "Left", "Right"]) {
      if (parseFloat(style[`border${side}Width`]) <= 0) continue;
      const [br, bg, bb, ba = 1] = channels(style[`border${side}Color`]);
      if (ba > 0.5 && br >= 200 && bg >= 200 && bb >= 200) {
        element.classList.add("tcx-light-border");
        break;
      }
    }
    const [cr, cg, cb] = channels(style.color);
    if (cr <= 110 && cg <= 110 && cb <= 120 && Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < 30) {
      element.classList.add("tcx-dark-ink");
    }
  }

  const pending = new Set();
  let scheduled = false;
  function flush() {
    scheduled = false;
    for (const root of pending) {
      if (!root.isConnected) continue;
      classify(root);
      root.querySelectorAll("*").forEach(classify);
    }
    pending.clear();
  }
  function queue(root) {
    if (!(root instanceof Element)) return;
    pending.add(root);
    if (scheduled) return;
    scheduled = true;
    setTimeout(flush, 120);
  }

  injectStyle();
  // Angular can replace <head>; keep the stylesheet present.
  new MutationObserver(() => injectStyle()).observe(document.documentElement, { childList: true });

  const start = () => {
    injectStyle();
    queue(document.body);
    new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(queue);
    }).observe(document.body, { childList: true, subtree: true });
    // Late stylesheets change what still renders white; sweep once more.
    window.addEventListener("load", () => queue(document.body), { once: true });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
