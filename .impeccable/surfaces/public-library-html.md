---
version: 1
slug: "public-library-html"
primary_target: "public/library.html"
related_targets: ["public/library.css","public/library.js"]
---

# Library hub surface brief

Scope: the rebuilt library student hub (public/library.html, public/library.css, public/library.js). Mode: Operate, code-led (no generated comps). Daily/frequent academic lookup and study-room booking on desktop (1440x900) and mobile (390x844); single owner behind Cloudflare Access.

Must keep: full functional parity with official NUTC Library (`library.nutc.edu.tw`, SirsiDynix Enterprise OPAC search/details/account/renew, searchable electronic databases, Study Carrel `10F-1`–`10F-7` availability calendar, booking, and cancellation, EndNote downloads, and one-click SSO links to group rooms and remaining library tools), `/go/library` fallback, strict `'self'`-only CSP, Quiet Identity Rule (never display the user's real name or student ID in header chrome), and ui-copy rules (no explanatory filler subtitles). User pinned the existing `/ais` and `/tronclass` visual system: "make it more modern like ais and tronclass".

## Direction contract

THESIS: A fast, calm academic utility console on tinted obsidian glass that turns NUTC's fragmented IIS WebForms and SirsiDynix frames into one structured search-first library workspace, rejecting legacy nested menus, table-based forms, and multi-hop SSO detours.

OWN-WORLD: Inherits DESIGN.md ("The Tinted Glass Wall") and the shared `/ais` & `/tronclass` dark utility tokens: tinted charcoal surfaces (`--bg`, `--surface`, `--raised`) with zero background photo behind data, hairline borders (`1px solid rgba(255,255,255,.10)`), crisp `4px`–`6px` corners, one `--primary` rose accent owning active navigation, focus rings, available counts, and primary buttons, paired with `Albert Sans` + `Noto Sans TC` and tabular numerals (`tabular-nums`) across due dates, call numbers, counts, and room slots.

STORY: Opening `/library` shows current loans, holds, fines, and carrel bookings alongside an immediate catalog search bar; clicking into tabs searches campus collections, manages checkouts, checks `10F-1`–`10F-7` carrel openings visually and books/cancels them cleanly, or filters licensed databases and downloads EndNote in one click.

FIRST VIEWPORT: 56px sticky frosted top bar (`圖書館` grid mark + 5 horizontal route tabs `總覽`, `館藏`, `借閱`, `空間`, `資源` + right utility menu button). Below, crisp light `h1` (`圖書館`) followed immediately by 4 tabular KPI summary tiles, an inline full-width catalog search form with campus scope pills, and active loans / study-carrel preview cards above the fold cleanly fitting both `1440x900` and `390x844`.

FORM: Rebuilt dark utility workspace matching `/ais` (`public/ais.css`, `public/ais.js`) and `/tronclass`. seed: none (pinned) — "make it more modern like ais and tronclass". Signature interaction: instant inline catalog search and scope pill filtering paired with an interactive monthly Study Carrel availability calendar that pre-fills booking dates on click.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
