# Phase 1 Design: All ePortal Subsystems & Complete AIS Services

Date: 2026-11-23
Repository: `Personal-NUTC-Eportal`
Status: Proposed (Phase 1 of 2 — Phase 2 covers ePortal 公告欄, 共用/個人行事曆, 個人訊息 & 我的帳戶)

## 1. Goal & Scope

Make every subsystem exposed on the official NUTC ePortal dashboard (`eportal.nutc.edu.tw/nutc_dashboard/`) one-tap launchable from `Personal-NUTC-Eportal`, and fill in the missing top-level AIS menu items under `/ais/services`, without cluttering the dashboard's default first viewport.

### In scope (Phase 1)
1. **Curated 16-module ePortal catalog** (5 existing primary subsystems + 11 newly mapped official subsystems) with clean Traditional Chinese labels, verified Lucide 1.24.0 icons, and stable `/go/<id>` launch paths.
2. **Passive live dashboard discovery** so future modules added by NUTC to the user's ePortal account appear automatically with zero extra Chromium launches.
3. **Server-persisted module pinning** (`pinnedModules` in `data/dashboard-preferences.json` + `PUT /api/preferences/pinned-modules`) so the user can promote any of the 16+ subsystems into the default resting row.
4. **Inline progressive disclosure on the dashboard** (`顯示全部 (N)` ↔ `收合` right on the `校務系統` header) adhering strictly to `DESIGN.md` ("The Tinted Glass Wall"), Impeccable `Operate` mode, and zero unnecessary helper copy.
5. **SSO handoff hardening** for the 11 new `/ext_module/` targets (stateless public HTTPS passthrough, NUTC campus legacy HTTP hop following for server-side discovery, and a direct official-ePortal fallback button on `/go/<id>` errors).
6. **Complete AIS `服務` links** on `/ais/services` (adding `選課系統`, `通識與運動調查`, and `班級資訊`).
7. **Public demo mirror** (`demo/`) mirroring the expand toggle and localStorage-backed pinning with static sample data and zero university URLs or auth.

### Out of scope (deferred to Phase 2)
- Official ePortal dashboard widgets: 公告欄 (`bulletin`), 共用/個人行事曆 (`scal`/`pcal`), 個人訊息 (`dashboard_user_msg.php`), and 我的帳戶 (`personalsetting_v3`).
- Rebuilding native in-portal web apps for the 11 additional subsystems (they launch through `/go/<id>` SSO handoff, just like WebMail, Activity, and EP).

---

## 2. Backend Architecture & Data Flow

### 2.1 Curated 16-Module Catalog (`src/eportal.js`)

Keep the existing 5 modules unchanged in `id`, `uuid`, `path`, and `appPath`, adding `defaultPinned: true`. Add the 11 additional subsystems captured from `eportal.nutc.edu.tw/nutc_dashboard/` with `defaultPinned: false`:

| id | shortName | name | description | icon (Lucide 1.24.0) | path / uuid |
|---|---|---|---|---|---|
| `ais` | `學生管理` | `學生管理系統` | `課表、學籍與學生資訊` | `graduation-cap` | `/?app_id=NUTC_6401` · `8a782d88-721c-4545-a5b7-c6a986158c64` (appPath `/ais`, `defaultPinned: true`) |
| `webmail` | `WebMail` | `WebMail郵件系統` | `校務信箱與通知` | `mail` | `/ext_module/ext_set_param.php?mod_id=_OSL256_lPGpV8f9YqQ8qgA9cyn8QA` · `26645edb-4114-4322-a3f1-96d569928b6d` (`defaultPinned: true`) |
| `activity` | `活動報名` | `活動報名暨投票系統` | `活動、報名與投票` | `clipboard-check` | `/ext_module/ext_set_param.php?mod_id=_OSL256_PI9bsUzimpCHrDSTPoMVcQ` · `e407696e-de54-429a-8e5a-93bdd3c2586e` (`defaultPinned: true`) |
| `ep` | `學習歷程` | `學生學習歷程(EP)跨平台整合系統` | `EP 學習歷程與成果` | `route` | `/ext_module/ext_set_param.php?mod_id=_OSL256_pmabVqSXTYna294Vl9JLJg` · `21b57b37-4685-490d-b127-05f5eefe6735` (`defaultPinned: true`) |
| `tronclass` | `TronClass` | `TronClass創新教學平台` | `課程、教材、作業與測驗` | `book-open-check` | `/ext_module/ext_set_param.php?mod_id=_OSL256_OBbFAusuXIjtGB-G8RS4gQ` · `d54250aa-edce-4fa2-8cdc-9d708537cccb` (appPath `/tronclass`, `defaultPinned: true`) |
| `library` | `圖書館系統` | `圖書館資訊系統暨電子期刊資料庫` | `館藏查詢與電子期刊` | `library` | `/ext_module/ext_set_param.php?mod_id=_OSL256_WiHvt1-PFCvu-PsKfEIn8w` · `ee517564-07f6-4c80-a5e8-ef1af4762ece` |
| `code-judger` | `Code Judger` | `Code Judger平臺` | `程式解題與線上評測` | `code-2` | `/ext_module/ext_set_param.php?mod_id=_OSL256_hdfNE_erDoXVO3Pg-NLy7Q` · `b17ecaca-f030-4a5f-a7fa-3f26cbd6efd4` |
| `learning-outcomes` | `教學品保` | `教學品保暨學習成效系統` | `教學評量與學習成效` | `bar-chart-3` | `/ext_module/ext_set_param.php?mod_id=_OSL256_d__gzNdbk65pxiOeFQ4csg` · `c9bfe024-777b-4f18-a542-e61f09bdb3b6` |
| `ucan` | `UCAN 職能` | `UCAN大專校院就業職能平台` | `職能診斷與職涯探索` | `compass` | `/ext_module/ext_set_param.php?mod_id=_OSL256_u_S1I969H1Gcb8RFQuVy-Q` · `b55a9f5f-b084-4a6b-980e-b036abbbecef` |
| `language-center` | `外語自學` | `語言中心外語自學軟體` | `外語學習資源與軟體` | `languages` | `/ext_module/ext_set_param.php?mod_id=_OSL256_rqNJbdZBerH70SYfFWHwgg` · `9bb09c39-c3e2-446b-a0b5-3d00658d855c` |
| `campus-card` | `IC 卡掛失` | `校園IC卡線上掛失作業` | `學生證與 IC 卡掛失` | `credit-card` | `/ext_module/ext_set_param.php?mod_id=_OSL256_-r8UUjj2Cbe570UBliaF7w` · `96b12096-dae8-426c-93a4-d41378215fec` |
| `general-affairs` | `總務報修` | `總務系統(設備報修系統)` | `校園設備與場地報修` | `wrench` | `/ext_module/ext_set_param.php?mod_id=_OSL256_2h5NfoGoOQ4YVWULckFmhw` · `aa2e1c26-987d-4c4b-8c6e-9cf1de818ec9` |
| `counseling` | `諮商系統` | `諮商e化系統` | `心理諮商預約與服務` | `message-circle-heart` | `/ext_module/ext_set_param.php?mod_id=_OSL256_CF-M6podfqKD4cowl4XM5Q` · `381aef0d-e91d-41ff-bb8c-bb486fd439b2` |
| `epidemic-report` | `自主回報` | `防疫-自主回報系統（學生）` | `健康與自主回報登記` | `heart-pulse` | `/ext_module/ext_set_param.php?mod_id=_OSL256_gO4d-m5Avjkelcxddj367w` · `c793f033-8c8e-45f8-bd3a-34ff0122e8d4` |
| `rd-service` | `研發整合` | `研發整合服務系統` | `研發計畫與相關服務` | `flask-conical` | `/ext_module/ext_set_param.php?mod_id=_OSL256_hGYZutzRjQWeiydMjvjLig` · `f9e57f7a-4b1d-47be-82f6-88e2f18c3cbe` |
| `tronclass-app` | `TronClass APP` | `TronClass創新教學平台 APP` | `行動版教學平台應用` | `smartphone` | `/ext_module/ext_set_param.php?mod_id=_OSL256_UJo4ihRt8li05nCtk5im9g` · `697cb3c7-2846-41ff-94e4-cd606da8b80c` |

`publicModules()` returns the curated modules (plus any passively discovered extra modules) with `defaultPinned` exposed and internal `path` omitted, preserving `launchPath: appPath || "/go/" + id`. `defaultPinnedModuleIds()` returns `["ais", "webmail", "activity", "ep", "tronclass"]`.

### 2.2 Passive Live Discovery (`src/eportal.js` & `src/portal-session.js`)

- Export `extractDashboardModulesFromPage(page)` (or helper inside `src/portal-session.js`) that queries `button[data-item-uuid][onclick*="gotoDashboardModule"]` whenever `EPORTAL_DASHBOARD` is already loaded and verified logged-in (in `inspectServerPortalSession`, `createModuleHandoff`, and `openAisWithServerSession`).
- Parse only the first string argument of `gotoDashboardModule('...')` alongside `data-item-uuid` and button text.
- Export `syncDiscoveredModules(rawEntries)` in `src/eportal.js`:
  - Reject any entry whose `uuid` does not match `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
  - Reject any entry whose `path` does not strictly match `^\/\?app_id=[A-Za-z0-9_-]{1,64}$` or `^\/ext_module\/ext_set_param\.php\?mod_id=[A-Za-z0-9_=-]{1,128}$`.
  - For a known `uuid`, update the runtime path override only if the school rotated its `mod_id`, preserving curated `id`, `shortName`, `name`, `description`, `icon`, `defaultPinned`, and `appPath`.
  - For an unknown `uuid`, register an in-memory discovered module:
    - `id`: `"ext-" + uuid.slice(0, 8).toLowerCase()` (resolving any prefix collision by appending more hex chars)
    - `name` / `shortName`: sanitized button text (capped at 40 / 16 chars)
    - `description`: `"ePortal 校務系統"`
    - `icon`: `"external-link"`
    - `defaultPinned`: `false`
    - `discovered`: `true`
    - `serverHandoff`: `true`
  - Cap discovered unknown modules at 32 entries so malformed upstream HTML cannot bloat memory.
  - Export `resetDiscoveredModules()` for isolated unit tests.

### 2.3 Server-Persisted Pinning (`src/dashboard-preferences.js` & `server.js`)

- Extend `dashboard-preferences.json` schema with `pinnedModules`:
  - Stored as `null` by default (meaning "use `defaultPinnedModuleIds()`"), or an array of valid module IDs (`string[]`, 1–32 unique IDs matching `/^[a-z0-9-]+$/`, all existing in `publicModules()` when validated on write).
  - Requiring at least 1 pinned module ensures the resting `校務系統` wall is never empty.
  - On load, filter out any stale/unknown IDs safely; if the loaded array becomes empty, fall back to `null` (default 5).
- Expose `PUT /api/preferences/pinned-modules` accepting `{ pinnedModules: string[] | null }`, validated against currently known module IDs, returning the updated preferences payload (and include `pinnedModules` in `GET /api/preferences`).

### 2.4 SSO Handoff Hardening (`src/portal-session.js` & `public/launch.js`)

1. **Trusted campus legacy HTTP hops (server-side discovery only):**
   - Keep `LEGACY_HTTP_HANDOFF_HOSTS` for module-specific legacy overrides (`webmail`, `activity`) and keep `shouldExecuteLegacyTargetInBrowser` restricted strictly to `activity`.
   - Extend `isTrustedLegacyHttpTarget(module, rawUrl)` so any `/ext_module/` module may follow intermediate `http://` hops hosted on `*.nutc.edu.tw` or NUTC's campus IPv4 block (`^163\.17\.\d{1,3}\.\d{1,3}$`) **strictly server-side** inside `captureHttpRedirectHandoff` / `discoverBareExternalGet` to locate a transferable HTTPS handoff. Never hand raw `http://` URLs directly to the client browser.
2. **Stateless public HTTPS destinations:**
   - Track target-host cookies present in `context.cookies()` **before** walking an external HTTPS URL in `discoverBareExternalGet`.
   - If the walk terminates at an HTTPS `200` page without a redirect/form **and** no new cookies were created or modified for that target host during the walk, treat it as a public/stateless HTTPS destination (e.g. an app download or info portal) and return `{ type: "get", url: current.toString() }` instead of failing with `EPORTAL_HANDOFF_SESSION_BOUND`.
   - When new target-host cookies *were* created during the walk (indicating server-bound authentication like `activity`), continue throwing `EPORTAL_HANDOFF_SESSION_BOUND`.
3. **Graceful launch fallback (`public/launch.html` & `public/launch.js`):**
   - On `/go/:id` failures with `EPORTAL_HANDOFF_SESSION_BOUND` or `EPORTAL_HANDOFF_UNAVAILABLE`, reveal a secondary fallback link button **"在官方 ePortal 開啟"** (`https://eportal.nutc.edu.tw/nutc_dashboard/`, `target="_blank" rel="noopener noreferrer"`) alongside Retry and Back, so no subsystem is ever a dead end.

---

## 3. UI Design (Impeccable / `DESIGN.md` Operate Mode)

All UI changes adhere to `DESIGN.md` ("The Tinted Glass Wall"): flat tinted glass (`var(--glass)`), 1px hairline edge (`var(--glass-edge)`), 6px tile shoulders, 4px inner chips, 5px controls, no sheen/bevels/nested shadows, no page-load staggers, tabular numerals, and Traditional Chinese copy with zero unnecessary helper subtitles.

### 3.1 Dashboard `校務系統` Section (`public/index.html`, `public/app.js`, `public/dashboard.css`, `public/dashboard-cards.js`)

- **Header row:** Upgrade the `校務系統` header container to match `#customLinksSection` (`mb-3 flex flex-wrap items-center justify-between gap-3 px-0.5`):
  - Left: `<h2 class="wall-heading">校務系統</h2>`
  - Right: `<button id="toggleAllModules" type="button" class="dashboard-tinted-glass inline-flex min-h-[36px] items-center gap-1.5 rounded-[5px] px-3 text-xs font-semibold" aria-expanded="false" aria-controls="moreModuleGrid">` showing **`顯示全部 (16)`** + `chevron-down` when collapsed, and **`收合`** + `chevron-up` when expanded (hidden if total modules ≤ pinned count).
- **Resting state (collapsed — default):**
  - `#moduleGrid` renders only the pinned modules (default: the original 5) in `.tile-wall.tile-wall--doors.tile-wall--fill` using `createDashboardModuleCard()` unchanged — **zero visual drift on the default first viewport**, and full compatibility with `test/dashboard-card-polish.test.js`.
- **Expanded state (`#moreModuleGrid`):**
  - Renders immediately below `#moduleGrid` (with `mt-3` / `var(--tile-gap)`) using `.tile-wall.tile-wall--doors` (auto-fill, min `176px`, 2 columns at ≤900px) so trailing partial rows keep uniform tile widths rather than stretching an orphan card.
  - **Accessible pinning affordance (expanded only):** While expanded, each card in both `#moduleGrid` and `#moreModuleGrid` is wrapped in a `.module-tile-slot` (`position: relative`) containing:
    1. The door `<button>` produced by `createDashboardModuleCard()` (launches the module on click).
    2. A sibling `<button type="button" class="module-pin-btn">` positioned at `top: 10px; right: 10px` (minimum `32px × 32px` hit area, `4px` radius, `pin` Lucide icon, `aria-pressed="true|false"`, `aria-label="取消釘選 <name>"` / `"釘選 <name> 到常用系統"`). Using sibling buttons avoids illegal nested `<button>` elements.
    - While expanded, the door card's decorative trailing arrow is hidden via CSS (`.modules-expanded .dashboard-module-action { opacity: 0; pointer-events: none; }`) so the top-right slot cleanly houses the pin control with zero overlap.
    - **One Accent Rule:** Pinned `.module-pin-btn[aria-pressed="true"]` uses `color: var(--primary); border-color: var(--primary-ring); background: var(--primary-soft)` (active/selected state); unpinned uses muted hairline glass (`var(--muted)` / `var(--glass-edge)`).
    - Disabling unpinning on the last remaining pinned module (`disabled` + clear `title` / `aria-label`) prevents an empty collapsed wall.
    - Clicking pin optimistically updates the wall and persists via `PUT /api/preferences/pinned-modules`, reverting and logging/surfacing an error if the save fails.
  - **Motion:** 160ms opacity/color transitions only; disabled cleanly under `@media (prefers-reduced-motion: reduce)`.

### 3.2 Complete AIS `服務` Tab (`public/ais.js`)

Add the 3 missing AIS top-level menu entries to `SERVICES` in `/ais/services` (preserving existing `openAisPage` SSO handoff and card styling):
- `["選課系統", "課程預選、加退選與選課結果", "/student/selection/pre_selection.aspx", "list"]` (placed first)
- `["通識與運動調查", "通識課程與運動項目意願調查", "/student/selection/common_course.aspx", "search"]`
- `["班級資訊", "班級課表與班級相關資訊", "/student/my_class/schedule_class.aspx", "users"]`

### 3.3 Public Demo Mirror (`demo/index.html`, `demo/app.js`, `demo/features.js`, `demo/features.css`)

- Keep the 5 static `data-service="student|mail|events|learning|tron"` tiles in `demo/index.html` (preserving all `test/demo-parity.test.js` assertions).
- Add the matching `顯示全部 (16)` ↔ `收合` toggle button (`id="toggleDemoModules"`) and expanded `#demoMoreModules` grid with the 11 additional sample services and `localStorage`-backed pinning, strictly containing zero university URLs or auth calls.

---

## 4. Error Handling & Edge Cases

- **Unknown module slug on `/go/:id` or `/api/launch/:id`:** Existing 404 handling stays intact; unknown discovered IDs only resolve if currently present in the discovered map.
- **Pinning save failure:** Optimistic UI rolls back to previous `pinnedModules` state if `PUT /api/preferences/pinned-modules` returns non-2xx.
- **Unpinning last pinned system:** Blocked both client-side (`disabled` on the single remaining pinned card) and server-side (`400` if `pinnedModules` is an empty array).
- **Malformed upstream dashboard HTML during passive discovery:** Silently skipped per-entry; never breaks `/api/portal-status`, keepalive, or existing 16 curated modules.
- **Transient OAKlouds during launch of new modules:** Covered automatically by the existing `gotoEportalWithRetry` + launcher OAKlouds retry logic in `src/portal-session.js`.

---

## 5. Verification Strategy

1. **Automated unit & contract tests (`node --test test/*.test.js`):**
   - `test/eportal-catalog.test.js` (new): verify all 16 curated modules (unique IDs, UUIDs, paths, Lucide icons, 5 defaultPinned), `syncDiscoveredModules` validation/sanitization/cap/path-update rules, and `pinnedModules` store validation + persistence (`PUT /api/preferences/pinned-modules`).
   - `test/handoff-transferability.test.js` (updated): verify campus legacy HTTP hop allowlist (`163.17.*.*` / `*.nutc.edu.tw` for `/ext_module/`, rejecting arbitrary non-campus HTTP) and stateless public HTTPS vs cookie-setting session-bound distinction.
   - `test/ais-portal.test.js` (updated): assert `選課系統`, `通識與運動調查`, and `班級資訊` are present in `public/ais.js`.
   - `test/demo-parity.test.js` (updated): assert the demo includes the expand toggle and still passes the zero-university-URL security check.
2. **Build & syntax check:** Run `npm run verify` (`vite build && node scripts/check-syntax.mjs && node --test test/*.test.js`) and `npm run build:demo` in `/home/ryno/Personal-NUTC-Eportal`.
3. **Impeccable verification (during implementation):**
   - Read `reference/craft-floor.md` before any UI edit.
   - Run `impeccable detect --json --changed` after UI changes and fix all findings.
   - Visually inspect rendered desktop & mobile views (collapsed & expanded states) via `impeccable shot` / browser capture.
