# Design Spec: Modern NUTC Library Hub (`/library`)

Date: 2026-11-24
Repository: `Personal-NUTC-Eportal`
Status: Proposed

## 1. Goal & Scope

Replace the legacy ASP.NET WebForms portal landing (`library.nutc.edu.tw/sso/default2.aspx`) with a fast, dark tinted-glass `/library` hub inside `Personal-NUTC-Eportal`, matching the visual grammar and interaction quality of `/ais` and `/tronclass`.

### In scope
1. **Entry wiring & fallback**: Set `appPath: "/library"` on the `library` module in [src/eportal.js](file:///home/ryno/Personal-NUTC-Eportal/src/eportal.js), add `"/library"` to `ALLOWED_NEXT_PATHS` in [public/login-route.js](file:///home/ryno/Personal-NUTC-Eportal/public/login-route.js) and [public/server-login.js](file:///home/ryno/Personal-NUTC-Eportal/public/server-login.js), and keep `/go/library` working as the direct fallback into the official `library.nutc.edu.tw/sso/default2.aspx` portal.
2. **Overview (`/library`)**: 4 summary KPI tiles (`借閱中`, `預約中`, `逾期／罰款`, `研究小間`), an inline catalog quick-search bar with campus/format scope chips, active checkouts & future Study Carrel reservations preview, and quick shortcuts (`三民總館新進館藏`, `民生分館新進館藏`).
3. **Catalog Search & Item Details (`/library/catalog`)**: Fast SirsiDynix Enterprise OPAC search (`ntit.ent.sirsidynix.net/client/zh_TW/NUTC/search/results`) with field selector (`所有欄位`, `題名`, `著者`, `主題`, `期刊名`, `ISBN`, `ISSN`, `館藏條碼`), scope filters (`所有`, `三民總館`, `民生分館`, `電子書`, `視聽影片`, `語言中心`), presets (`SMNEW`, `MSNEW`), pagination, proxied cover art, call number & live availability badges (`可借閱` / `複本總數` / `預約`), and full holdings/copies drawer/detail view.
4. **My Account (`/library/loans`)**: Rebuilt SirsiDynix `我的帳戶` (`search/account?`) showing active checkouts (`#CheckoutsList`) with due-date urgency and eligible item renewal, holds (`#HoldsList`), fines/blocks (`#finesTab`), and checkout history (`#CheckoutsHistoryList`), while keeping the student's barcode/ID hidden behind an explicit opt-in toggle.
5. **Space Booking (`/library/rooms`)**: Native Study Carrel (`研究小間10F-1` to `10F-7`) monthly availability lookup (`RoomCAL2.aspx`), active reservations (`CancelRoom2.aspx`) with cancellation support for reservations dated tomorrow or later (`明天以後`), and a clean Study Carrel reservation form (`OrderRoom2.aspx`). Remaining spaces (`預約團體討論室`, `預約團體放映室`, `預約新生利用教育`) launch via fresh one-click SSO links.
6. **Databases, EndNote & Tools (`/library/resources`)**: Searchable Electronic Databases (`DatabasesList.asp`) with keyword + language/college/subject/type filters, direct EZproxy/OCLC access links and PDF guide links, authenticated EndNote downloads (`2025`–`X9`, Win/Mac via `dslist.aspx` + `dlfile.aspx`), and one-click links for `電子期刊`, `電子資源探索 (Summon)`, `書刊推薦`, `讀者權益聲明（含電子郵件設定）`, and `重設館藏查詢密碼`.

### Out of scope
- Natively rebuilding `OrderRoom1.aspx` (group discussion rooms requiring co-user student IDs), `OrderRoom.aspx` (screening room), `activeacc2.aspx`, `resetPIN.aspx`, and `brs.nutc.edu.tw` book recommendations; these remain one-click authenticated SSO launch links.

---

## 2. Backend Architecture (Option 1: Hybrid Fast HTTP + Scoped Authenticated Session)

Probing the live NUTC Library services established how the upstreams behave:
- **Catalog & Databases** (`ntit.ent.sirsidynix.net/client/zh_TW/NUTC/search/...` and `library.nutc.edu.tw/database/search/DatabasesList.asp`) return server-rendered HTML directly to plain HTTPS requests without authentication.
- **Library SSO & Subsystems** (`library.nutc.edu.tw/sso/verifyv2.aspx` → `default2.aspx` → `dslist.aspx`, `OrderRoom2.aspx`, `RoomCAL2.aspx`, `CancelRoom2.aspx`, and SirsiDynix `decryptuid2.jsp` → `search/account?`) require an authenticated session minted from `createModuleHandoff("library")`.

Using one strategy for everything would either block `data/eportal-profile.lock` and add 3–6s Playwright startup to every catalog search, or break on SirsiDynix's multi-hop JavaScript/Tapestry SSO login. Therefore:

1. **`src/library-parsers.js` (pure HTML/DOM-free parsers)**:
   - Zero network calls, Playwright imports, or disk access.
   - Parses:
     - OPAC search results HTML (total hit count, pagination tokens, book cards: title, author, publisher/year, detail URL/ID, cover image URL, library branch, call number, available/holds/total counts).
     - OPAC item detail HTML (bibliographic metadata + per-copy holdings table: branch, location, call number, item type, status/due date, official OPAC link).
     - OPAC `我的帳戶` HTML (`#patronSummary` / account status / balance, `#CheckoutsList` rows + renew form parameters, `#HoldsList` rows, `#finesTab` rows, `#CheckoutsHistoryList` rows, opt-in masked barcode).
     - `DatabasesList.asp` HTML (name, direct URL, type badge, summary description, guide PDF URL, license expiry date, detail URL).
     - `OrderRoom2.aspx` HTML (`__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`, role radios `RBLType`, `ddlTimePeriod`, `ddlRoom`, `tbCrt_Date`, masked/unmasked prefilled contact defaults, rules summary), `RoomCAL2.aspx` monthly grid (date + occupied/available room numbers `1`–`7`), and `CancelRoom2.aspx` reservation table + cancel button postback targets.
     - `default2.aspx` & `dslist.aspx` links (SSO navigation targets and EndNote download records `{ fid, fk, title, platform }`).

2. **`src/library-portal.js` (transport, session lifecycle, caches)**:
   - **Host allowlist**: Server-side requests and cookie replay are strictly constrained to HTTPS origins in `ALLOWED_LIBRARY_HOSTS = new Set(["library.nutc.edu.tw", "ntit.ent.sirsidynix.net"])` plus initial SSO hops on `lib1.nutc.edu.tw` / `library.nutc.edu.tw`. Redirects outside allowlisted hosts are rejected cleanly rather than followed blindly.
   - **Public Fast HTTP path**: Catalog search, item details, new-arrival presets, and `DatabasesList.asp` queries execute directly via Node `fetch` with a realistic User-Agent and timeout (`12_000 ms`), completely independent of headless Chromium or `data/eportal-profile.lock`.
   - **Authenticated Library Session**:
     - Stored outside Git at `data/library-session.json` (`0o600`), holding cookies (`ASP.NET_SessionId` / library forms auth + SirsiDynix OPAC session cookies) and extracted link/sso metadata.
     - Initialized lazily on demand using `createModuleHandoff("library")`, completing both `library.nutc.edu.tw/sso/default2.aspx` and (for OPAC account routes) the short Playwright/HTTP SirsiDynix `decryptuid2.jsp` → `patronloginform` → `search/account?` handshake.
     - Serializes concurrent session refreshes/submissions via a single in-module promise lock so simultaneous dashboard requests do not mint competing SSO tickets.
     - Automatically re-authenticates once when an authenticated upstream page redirects back to `/sso/ErrorPage.aspx`, `/login`, or SirsiDynix login; if ePortal itself requires login, throws `EPORTAL_LOGIN_REQUIRED` (`401`).
     - Exported `clearLibrarySession()` hooks into `/api/portal-logout` in [server.js](file:///home/ryno/Personal-NUTC-Eportal/server.js) so signing out wipes `data/library-session.json` and memory caches.
   - **Caches**:
     - Overview & EndNote downloads: 5-minute TTL (in-memory, single-flight coalesced, bypassed via `?refresh=1` and invalidated on renew/book/cancel).
     - Databases default/filter results: 5-minute TTL (bounded LRU `Map`, max 40 entries).
     - Catalog search / item details: 2-minute TTL (bounded LRU `Map`, max 60 entries).
     - Carrel monthly availability (`RoomCAL2.aspx`): 2-minute TTL (invalidated immediately on carrel book/cancel).

---

## 3. Server Routes & API Contract (`server.js`)

All `/library` and `/api/library/*` routes sit behind the existing `cloudflareAccess` origin guard in [server.js](file:///home/ryno/Personal-NUTC-Eportal/server.js).

### HTML & Static Asset Route
- `GET /library` and `GET /library/*` (matching `/library`, `/library/catalog`, `/library/loans`, `/library/rooms`, `/library/resources`) serve `public/library.html` with `PUBLIC_APP_CSP` (`default-src 'self'`).
- Cover thumbnails stay `'self'`-compliant via `GET /api/library/cover?url=...`, which accepts only `https:` URLs matching vetted book-cover hosts (`cdnec.sanmin.com.tw`, `ntit.ent.sirsidynix.net`, `books.google.com`, `covers.openlibrary.org`, `static.findbook.com.tw`), validates `image/*` content type, caps response size at 2 MB, caches briefly (`Cache-Control: private, max-age=3600`), and returns `404` on invalid hosts/failures so cards fall back cleanly to typographic book placeholders.

### JSON & Download Endpoints
1. **`GET /api/library/overview`** (`?refresh=1`):
   - Returns `{ fetchedAt, status, patron: { maskedId, ... }, summary: { checkoutsCount, holdsCount, finesTotal, activeCarrelsCount }, account: { checkouts, holds, fines, history }, carrels: { reservations, formDefaults: { role, today, rooms, periods, hasContactDefaults, department, phone, email, altEmail, rules } }, downloads: [...], quickLinks: [...], sectionErrors: { opac?, carrels?, downloads? } }`.
   - Account contact details (`studentId`/card number) follow `/ais` masking rules (`maskIdentifier()`), never exposing raw sensitive identifiers unprompted; carrel form defaults expose non-sensitive contact fields (`tbClassName`, `tbTEL`, `tbEMail`, `tbEMail1`) only on the `/library/rooms` edit view where the user explicitly submits `OrderRoom2.aspx`.
   - Per-section isolation (`Promise.allSettled`): if SirsiDynix `我的帳戶` fails or times out while `library.nutc.edu.tw` succeeds (or vice versa), the responding section still renders and the failed section surfaces an inline retry message via `sectionErrors`.
   - Auth failure (`EPORTAL_LOGIN_REQUIRED`) propagates `401` so the page displays the single reconnect banner.

2. **`GET /api/library/catalog/search`** (`?q=&field=ALL&scope=ALL&preset=&page=1`):
   - Validates `field` against `{ ALL, TITLE, AUTHOR, SUBJECT, JOURNAL, ISBN, ISSN, BARCODE }`, `scope` against `{ ALL, SM, MS, EBOOK, AV, LANG }`, `preset` against `{ "", "SMNEW", "MSNEW" }`, and integer `page >= 1`.
   - Returns `{ query, field, scope, preset, page, totalResults, totalPages, items: [{ id, title, author, publisherYear, isbn, callNumber, campus, availableCount, totalCount, holdsCount, coverProxyUrl, detailPath, officialUrl }] }`.

3. **`GET /api/library/catalog/item`** (`?path=...`):
   - Validates `path` starts with `/client/zh_TW/NUTC/search/detailnonmodal` (no open proxy).
   - Returns `{ title, author, publisherYear, summary, isbn, officialUrl, holdings: [{ branch, location, callNumber, barcode, type, status }] }`.

4. **`POST /api/library/opac/renew`** (JSON `{ itemIds: string[] }`):
   - Executes renewal on active checkouts in the authenticated OPAC account, clears overview cache, returns `{ ok, message, account }`.

5. **`GET /api/library/databases`** (`?q=&language=&college=&subject=&type=`):
   - Posts to `library.nutc.edu.tw/database/search/DatabasesList.asp` with validated query/filter parameters (or loads all databases when browsing by category) and returns `{ filter, count, items: [{ id, name, url, accessType, description, guideUrl, expiry, detailUrl }] }`.

6. **`GET /api/library/rooms/carrel/availability`** (`?year=&month=`):
   - Queries `RoomCAL2.aspx` for the requested month (current month default) via authenticated session and returns `{ year, month, rooms: [1..7], days: [{ day, dateKey, bookedRooms: [...] }] }`.

7. **`POST /api/library/rooms/carrel/book`** (JSON `{ role, department, phone, email, altEmail, dateStart, dateEnd, timePeriod, room }`):
   - Validates dates (`YYYY-MM-DD`, end >= start, within 2 months), period (`1`..`4`), room (`1`..`7`), role (`專任教師` / `研究生` / `學生`), and required WebForms fields (`department`, `phone`, `altEmail`) matching `OrderRoom2.aspx`'s `ChkInput()`. Optional `File1` uploads stay in the official form fallback (`/library/open/carrel`).
   - Re-fetches fresh `OrderRoom2.aspx` WebForms tokens (`__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`, `__EVENTTARGET`), submits via POST using authenticated `tbName`/`tbSID`, inspects the response/alert text, invalidates carrel & overview caches, and returns `{ ok, message }` (or structured `400`/`409` with the library's exact rule rejection, e.g. overlapping slot).

8. **`POST /api/library/rooms/carrel/cancel`** (JSON `{ targetId }`):
   - Matches `targetId` against freshly parsed `CancelRoom2.aspx` reservations (server never executes arbitrary postback targets supplied by the client), submits cancellation, invalidates caches, and returns `{ ok, message, reservations }`.

9. **`GET /api/library/downloads/:fid`**:
   - Resolves `:fid` against the authenticated `dslist.aspx` catalog on the server (so `fk` keys are bound server-side), streams `dlfile.aspx?fid=...&fk=...` with safe `Content-Disposition` filename validation directly to the user's browser.

10. **`GET /library/open/:key`** (authenticated redirect route):
    - Maps a fixed allowlist (`opac`, `carrel`, `carrel-cancel`, `group-discuss`, `group-screening`, `orientation`, `recommend`, `patron-rights`, `reset-pin`, `ejournals`, `summon`) through the active authenticated `library.nutc.edu.tw` session (`default2.aspx` fresh ticket lookup) or static HTTPS library URL, redirecting the new tab straight to the requested target without leaking SSO tickets into `/library` JSON payloads or browser history on the main SPA tab.

---

## 4. Frontend UI & Impeccable Design (`public/library.html`, `public/library.css`, `public/library.js`)

Follows `DESIGN.md` ("The Tinted Glass Wall", `Operate` mode) and `/home/ryno/.gemini/config/rules/ui-copy.md`:

- **Theme & Shell (`public/library.html`, `public/library.css`)**:
  - Uses `/theme-defaults.js?v=1`, `/theme.js?v=5`, `/vendor/lucide-1.24.0.min.js`, local `Albert Sans` + `Noto Sans TC` stack, tinted dark surfaces (`--bg`, `--surface`, `--raised`), hairline `rgba(255,255,255,.10)` borders, `4px`–`6px` corners, tabular numerals (`.num`), and a single `--primary` accent.
  - 56px sticky top bar matching [public/ais.css](file:///home/ryno/Personal-NUTC-Eportal/public/ais.css): square-grid brand mark + `圖書館`, horizontal scrollable navigation tabs (`總覽`, `館藏`, `借閱`, `空間`, `資源`), and right-side utility menu (`重新整理`, `在官方圖書館開啟`, `返回主頁`) honoring the **Quiet Identity Rule** (no user real name or student ID rendered in the header chrome).
- **Views & Interactions (`public/library.js`)**:
  - Clean `history.pushState` / `popstate` client routing across `/library`, `/library/catalog`, `/library/loans`, `/library/rooms`, `/library/resources`.
  - **總覽 (`/library`)**: Compact single-line greeting (`h1` `圖書館` + Claude-style spark matching `/ais` and `/tronclass`), 4 tabular KPI cards (`借閱中`, `預約中`, `應付罰款`, `研究小間`), inline search bar jumping straight to `/library/catalog?q=...`, plus side-by-side summary panels for active loans / carrel bookings and quick links (`三民總館新進`, `民生分館新進`).
  - **館藏 (`/library/catalog`)**: Clean search bar + collapsible/compact filter chips (scope & field) + preset pills (`三民新進`, `民生新進`), scannable book list rows showing cover thumbnail (or typographic fallback), title, author/year, campus & call number (`.num`), and live availability chip (`可借 N / 共 M`), opening an accessible slide-over or inline `<dialog>` holding details panel (`holdings` table + official OPAC link).
  - **借閱 (`/library/loans`)**: Sub-tabs/sections for `借閱中` (with due date & renew button), `預約中`, `罰款明細`, and `借閱歷史`, plus opt-in `顯示借閱證資訊` toggle (hidden by default like `/ais`'s identity toggle).
  - **空間 (`/library/rooms`)**: Two-column desktop / single-column mobile layout pairing a clean interactive monthly **研究小間預約月曆** (`RoomCAL2.aspx` room `1`–`7` indicators per day; clicking a day pre-fills the booking dates) and active reservations list (`CancelRoom2.aspx` with inline cancel confirmation) alongside the structured **研究小間申請表單** (`OrderRoom2.aspx`), operational library borrowing rules disclosure (`<details>`), and a compact footer row of one-click links (`團體討論室 10F`, `團體放映室`, `新生利用教育`, `在官方表單開啟`).
  - **資源 (`/library/resources`)**: Searchable database filter bar (`關鍵字`, language/college/type chips), clean database list cards (`全文型` / expiry / direct open link + PDF guide), `EndNote 書目管理軟體` download table (`dlfile` buttons), and quick-access links (`電子期刊`, `電子資源探索`, `書刊推薦`, `讀者權益聲明`, `重設館藏查詢密碼`).
  - **States**: Explicit loading skeleton, empty states (`目前無借閱紀錄`, `找不到符合條件的館藏`), per-section soft error cards with inline retry, and `EPORTAL_LOGIN_REQUIRED` error card with a `登入 Server ePortal` link to `/server-login/?force=1&next=%2Flibrary`. Zero decorative helper subtitles (`ui-copy.md`).

---

## 5. Security, Privacy & Testing Plan

### Security & Privacy
- **No leaked tickets/tokens**: `dslist.aspx` `fk` keys and `default2.aspx` `Verifyv2.aspx?ticket=...` links are resolved server-side inside `/api/library/downloads/:fid` and `/library/open/:key`, never exposed blindly to client-submitted query strings.
- **No arbitrary SSRF**: All upstream requests enforce explicit host allowlists (`library.nutc.edu.tw`, `lib1.nutc.edu.tw`, `ntit.ent.sirsidynix.net`, plus vetted cover hosts for `/api/library/cover`).
- **CSP compliance**: `public/library.html` stays strictly under `PUBLIC_APP_CSP` (`default-src 'self'`).
- **Credential/PII hygiene**: `data/library-session.json` is stored mode `0o600` inside gitignored `data/` and deleted on `/api/portal-logout`; server logs never print cookies, tickets, phone numbers, or national/student IDs.

### Verification Plan
1. **Unit & contract tests**:
   - `test/library-parsers.test.js`: fixture-based tests for OPAC search results, OPAC item holdings, OPAC My Account (checkouts/holds/fines/history/empty state), `DatabasesList.asp`, `OrderRoom2.aspx`, `RoomCAL2.aspx`, `CancelRoom2.aspx`, and `dslist.aspx`.
   - `test/library-portal.test.js`: route auth guards (`EPORTAL_LOGIN_REQUIRED`), `/library` CSP & HTML serving, `ALLOWED_NEXT_PATHS` (`/library`), cover-proxy allowlist rejection of non-library/private URLs, `/api/library/downloads/:fid` allowlist lookup, and `/api/portal-logout` clearing library session cache.
   - Run `npm run verify` (Vite build, `check-syntax.mjs`, all `node --test test/*.test.js`).
2. **Impeccable checks & Visual verification**:
   - Run `impeccable detect --json --changed` (0 errors, 0 new warnings).
   - Capture desktop (`1440x900`) and mobile (`390x844`) renders across all 5 `/library` tabs (Overview, Catalog + detail dialog, Loans, Rooms + calendar/booking form, Resources) plus `EPORTAL_LOGIN_REQUIRED` state against a local mock/preview server, inspect via `read_file`, fix any layout/contrast/overflow findings, and verify once more before deploying cleanly to `100.99.81.61` if requested.
