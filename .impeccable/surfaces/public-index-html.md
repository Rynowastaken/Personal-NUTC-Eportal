---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["demo/index.html","public/server-login.html","public/launch.html","public/access-login.html"]
---

# Dashboard surface brief

Scope: the personal dashboard (public/index.html), its GitHub Pages demo mirror (demo/), and the login/launch pages. Mode: Operate. Daily glance on phone and desktop; owner is the only user.

Must keep: user background image + brightness + parallax, theme colour controls (light/dark, saturation, brightness), Hitokoto quotes, every existing function and state. User pinned the incumbent tinted-glass material.

## Direction contract

THESIS: The day as a wall of tinted glass tiles. The next class is the largest live tile, flooded with the user's theme colour; refuses the stacked "welcome headline, then rows of identical icon cards" dashboard.

OWN-WORLD: Flat, square-shouldered panes of tinted glass (blur + saturate over the user's own background, 1px hairline edge, 6px radius, no inner highlights or bevels). One accent, the user's theme colour, owns every live state: next-class tile, today column, focused tile, connected status. Giant light-weight lowercase type; Albert Sans for Latin, system CJK (Noto Sans TC / PingFang TC / JhengHei) for Chinese, tabular numerals for all times.

STORY: Opening the page answers "what's next, where, and am I in trouble" before any scrolling, then offers one-tap doors into ePortal systems.

FIRST VIEWPORT: Top bar (identity left; status, avatar, settings right). A giant light greeting cropped by the viewport edge. Below, a tile wall: live next-class tile spanning two columns in the accent colour, an absence-count tile, then the five ePortal launcher tiles at uniform square-ish size with label bottom-left and icon top-left. Shortcuts, full week schedule and absence detail follow below.

FORM: Metro typographic tiles, fused with the incumbent tinted glass. Challenger digital-design-canon-metro-typographic-tiles (user-chosen over assigned candidate 5). seed:17d96b1a8dffcd92. Signature interaction: tiles tilt toward the pointer on press (CSS 3D), and live tiles flip to reveal fresh data; reduced motion disables both.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
