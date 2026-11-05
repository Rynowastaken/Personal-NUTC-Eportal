---
name: NUTC Portal
description: A personal NUTC dashboard drawn as a wall of flat tinted-glass tiles over the owner's own background.
colors:
  primary: "#f0a8c8"
  primary-soft: "rgba(240,168,200,.14)"
  primary-ring: "rgba(240,168,200,.42)"
  accent: "#e8b86d"
  secondary: "#51314a"
  danger: "#f07178"
  danger-text: "#f4a0a5"
  foreground: "#f7f1f6"
  muted: "rgba(247,241,246,.56)"
  faint: "rgba(247,241,246,.38)"
  control-text: "#17121b"
  glass: "rgba(18,15,22,.46)"
  glass-edge: "rgba(255,255,255,.12)"
  glass-edge-hover: "rgba(255,255,255,.24)"
  hairline: "rgba(255,255,255,.08)"
  period-column: "rgba(16,13,19,.94)"
  overlay-surface: "rgba(14,12,16,.97)"
  canvas: "#141018"
typography:
  display:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 7.5vw, 6.5rem)"
    fontWeight: 300
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  numeral:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 3.6rem)"
    fontWeight: 200
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 3.4vw, 2.6rem)"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "clamp(1.35rem, 2.4vw, 1.75rem)"
    fontWeight: 300
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  door-title:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
    fontFeature: "tnum"
  label:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  meta:
    fontFamily: "Albert Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.82
rounded:
  chip: "3px"
  inner: "4px"
  control: "5px"
  tile: "6px"
  overlay: "8px"
spacing:
  tile-gap: "clamp(.5rem, 1.2vw, .75rem)"
  tile-padding: "1rem 1.05rem"
  door-padding: "16px"
  section: "1.5rem"
  gutter-phone: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "32px"
  container: "72rem"
components:
  live-tile:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-padding}"
    height: "148px"
  live-tile-flood:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.control-text}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-padding}"
  door-tile:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foreground}"
    typography: "{typography.door-title}"
    rounded: "{rounded.tile}"
    padding: "{spacing.door-padding}"
    height: "148px"
  door-icon-chip:
    rounded: "{rounded.inner}"
    size: "36px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.control-text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.control-text}"
  button-settings:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.control-text}"
    rounded: "{rounded.control}"
    size: "42px"
  button-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  tile-chip:
    textColor: "{colors.muted}"
    rounded: "{rounded.chip}"
    padding: ".1rem .4rem"
  schedule-block:
    textColor: "{colors.foreground}"
    rounded: "{rounded.inner}"
    padding: "10px"
  schedule-block-now:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.control-text}"
    rounded: "{rounded.inner}"
    padding: "10px"
  schedule-period-column:
    backgroundColor: "{colors.period-column}"
    width: "56px"
  overlay-panel:
    backgroundColor: "{colors.overlay-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.overlay}"
    padding: "20px"
---

# Design System: NUTC Portal

## Overview

**Creative North Star: "The Tinted Glass Wall"**

The day is laid out as a wall of flat, square-shouldered panes of tinted glass set over the owner's own background image. It reads as Metro tiles: big light type, data-first live tiles, uniform doors. But the material is the incumbent tinted glass the owner chose to keep: blur and saturate over the backdrop, one hairline edge, no sheen, no bevel, no inner highlight. The wall answers "what's next, where, and am I in trouble" before any scrolling, and the doors below it open each ePortal system in one tap.

Density is calm. Few elements, large type, generous tile gaps on a four-column rhythm. The owner's theme controls (custom background with its own brightness, colour, saturation, brightness) produce the palette at runtime, so every value under Colors is a default. The system has to hold up under any palette the theme engine derives. Surfaces always stay dark glass (the page declares a dark colour scheme). The light/dark setting changes how the palette is derived, not the glass.

Motion is limited to two signature moves: a press-tilt toward the pointer, and a flip when a live tile's data really changes. Reduced motion turns both off. The dashboard has no entrance stagger.

**Key Characteristics:**
- Flat tinted glass, 1px hairline edge, 6px tile shoulders, 4px inner radii.
- A large, light, lowercase greeting sized so the user's name fits; only an unusually long name clips at the right edge.
- Three live tiles (next class, absences, today). Next class floods with the theme primary when a class is on now or later today.
- Door tiles for the five ePortal modules and for user shortcuts, each tinted by its own palette colour (user-pinned).
- Albert Sans Light for Latin, system CJK for Chinese, tabular numerals everywhere.
- UI chrome is Traditional Chinese (zh-Hant). Latin appears only for product names and some setting labels.

## Colors

A dark, plum-tinted glass world with one runtime-driven theme colour, plus quiet palette tints that give each door and course its identity.

### Primary
- **Theme Primary** (`primary`, default pink): the owner's theme colour. It owns every live state: the flooded next-class tile, the in-progress schedule block, today's schedule column (header wash plus a 2px bottom rule, light cell wash), focus outlines, the connected status, selection, caret and form accent. It also fills the settings button and colours the greeting's username. Those two uses are user-pinned (see Named Rules).
- **Primary Soft / Primary Ring** (`primary-soft`, `primary-ring`): the 14% and 42% alpha forms of primary. Used for the avatar tile, selected options, status pills and focus rings. Always derived from primary at runtime, never set by hand.

### Secondary
- **Warm Honey** (`accent`): the second palette slot. It is the hover fill of primary buttons, and it is one of the door and course tints.
- **Deep Plum** (`secondary`): the dark third palette slot. As a tint or icon colour it would vanish into the glass, so the door renderer lifts it to at least ~0.42 luminance (legibleAccent) before use.

### Tertiary
- **Alert Coral** (`danger`, `danger-text`): errors and destructive actions only. A coral-tinted pane with a coral hairline, coral-pink title text, logout and delete controls.

### Neutral
- **Rose White** (`foreground`): primary text on glass.
- **Muted / Faint** (`muted`, `faint`): secondary meta lines and tertiary hints, both alpha forms of foreground.
- **Ink** (`control-text`): text on primary fills. At runtime it is computed as the readable text colour for the current primary.
- **Glass / Glass Edge** (`glass`, `glass-edge`, `glass-edge-hover`): the single pane tint and its single hairline. Hover brightens the edge, not the pane's elevation.
- **Hairline** (`hairline`): schedule grid lines and absence row dividers.
- **Period Column** (`period-column`): the near-opaque fill behind the sticky schedule period column, so scrolled day columns never show through.
- **Overlay Surface** (`overlay-surface`): dialogs and menus, which sit above the wall and must not show the wall through them.
- **Canvas** (`canvas`): the body colour under the backdrop.

### Named Rules

**The One Accent Rule.** The theme primary is the only colour that marks a *live state*: now, today, focused, connected. No other hue may flood a tile, mark today, or draw a focus ring. Identity tints (doors, courses, absence dots) are a different job. They stay quiet and never compete with the flood.

**The User-Pinned Tint Exceptions.** The owner chose "Go with the Flat tiles direction but I liked the tinted glass theme". The following are deliberate and must not be "fixed" to satisfy the One Accent Rule:
1. **Per-module door tints and coloured icon chips.** Each door gets its own palette colour (palette order 0, 1, 2, 3, 1). The colour is run through legibleAccent, washed into the pane as a 160deg gradient, and repeated in a 4px-radius icon chip with a tinted fill, tinted hairline and tinted glyph.
2. **The accent-coloured username in the greeting.** The name renders in primary at weight 400 inside the light 300 greeting.
3. **The accent-filled settings button.** The 42px settings control is solid primary with ink text and the honey hover fill.

**The Quiet Identity Rule.** Schedule courses take a hashed palette tint (12% fill, 20% border) and absence rows take a palette-coloured status dot. These tints identify things. They never signal state, and they never reach flood strength.

## Typography

**Display Font:** Albert Sans (self-hosted variable woff2, Latin range only)
**Body Font:** Albert Sans, falling back to Noto Sans TC, PingFang TC, Microsoft JhengHei, Noto Sans CJK TC for Chinese
**Label/Mono Font:** system monospace, used only for raw technical detail

**Character:** A light, wide-open Latin face at very large sizes, paired with the platform's own Traditional Chinese face. Numbers are tabular across the whole document (`font-variant-numeric: tabular-nums` on body), so times and counts never jitter when a tile flips.

### Hierarchy
- **Display** (`display`): the lowercase greeting only. It stays on one line (`white-space: nowrap`) and is clipped by the container edge, never wrapped or shrunk to fit. On phones it steps down to `clamp(3.6rem, 18vw, 5rem)`.
- **Numeral** (`numeral`): the big numbers on live tiles (absence count, today's date). Weight 200 is the lightest step in the system.
- **Headline** (`headline`): the next-class course name. Single line with an ellipsis.
- **Title** (`title`): Pivot-style section headings (校務系統, 自訂捷徑, 本週課表, 缺曠紀錄): large, light, left-aligned. A 0.75rem faint meta line may sit below.
- **Door Title** (`door-title`): module and shortcut names. 19px on phones.
- **Body** (`body`): the greeting subtitle and Hitokoto quote, max 62ch.
- **Label** (`label`): the tile label row (下一堂 / 現在 / 缺曠 / 週四), muted, paired with a 16px icon or a tabular time on the right.
- **Meta** (`meta`): tile and row metadata, joined with ` · `.
- **Mono** (`mono`): the collapsed raw-error `pre` and error codes.

### Named Rules

**The Light Giant Rule.** Size carries hierarchy, not weight. Display, numeral, headline and title are all 200 to 300. Weight 500 to 600 is for small labels, buttons and list item names only.

**The Tabular Time Rule.** Every time, date, count and range uses tabular numerals. Time ranges use an en dash (14:00–14:59).

## Layout

The page is a single centred column (max `container`) with gutters that grow from phone to desktop. Sections are stacked: top bar, greeting, live wall, ePortal doors, shortcuts, then the schedule and absence pair.

- **The wall:** a four-column grid with `tile-gap`. The next-class tile spans two columns. At 900px and below the wall drops to two columns and the wide tile spans the full row.
- **ePortal doors** use an auto-fit grid (min 176px). The fixed set of five always fills one row on desktop.
- **Shortcut doors** use auto-fill with the same 176px minimum, so a short list stays tile-sized instead of stretching. Both door grids become two columns at 900px.
- **Schedule and absences** sit side by side at `lg` (schedule ~1.75fr, absences min 300px). Absences come first on narrow screens.
- **The phone schedule:** day columns are at least 104px on phones (72px otherwise) inside a horizontal scroller. A 56px period column is sticky on the left and near-opaque. On load the scroller jumps to today's column when the week doesn't fit.
- **Top bar:** identity (avatar tile, school name, product name) on the left. Status and the settings button on the right, both on a 42px control grid.

**The Name Fits Rule.** The greeting is sized so a typical name shows in full on desktop and phone (user-pinned: the owner rejected a size that cut off their name). On desktop it stays on one line with clip as a safety net for very long names; on phones (≤640px) it wraps with balanced lines so the name is never cut. Line-height leaves room for descenders.

## Elevation & Depth

The system is flat. Depth comes from the backdrop blur (`blur(20px) saturate(160%)`) and one hairline, never from shadows. Tiles, doors, schedule blocks and panels all carry `box-shadow: none`. Hover raises the edge brightness, not the pane. Only overlays that float above the wall (dialogs, the language menu) cast a shadow, so they read as separate from it.

### Shadow Vocabulary
- **Overlay** (`0 24px 80px rgba(0,0,0,.46)`): dialogs.
- **Menu** (`0 18px 38px rgba(0,0,0,.40)`): the custom listbox popup.

### Named Rules

**The No-Sheen Rule.** One tint, one 1px edge. No inner highlight, no bevel, no `::before` sheen layer, no second rounded edge.

## Shapes

The corners are square-shouldered: `tile` on every pane (tiles, doors, overview panels), `inner` on anything nested inside a pane (icon chips, door arrows, schedule blocks, the raw-error pre), `control` on buttons, `chip` on the smallest tags (the 現在 badge, tile chips), and `overlay` on dialogs and login shells. Status dots are the only circles. Dashed hairline borders mark empty states (no shortcuts yet).

## Components

### Live Tiles
Data first, at least 148px tall, with a label row on top and the value plus meta on the bottom.
- **Next class (wide):** the label switches between 下一堂, 現在 and 下次上課, with a tabular time on the right. It **floods** (primary at 78% over dark glass, 70% primary edge, ink text, label and meta at 72% ink) only when a class is on now or later today. A class on a later day, or no class at all, stays plain glass.
- **Absences:** a big numeral total, plus up to three category counts in the meta line.
- **Today:** weekday label, big date numeral, and a remaining-classes line.
- **Flip:** a face flips (620ms, rotateX ±88deg) only when real data replaces real data, never on first load.
- **Focus:** a 2px primary outline with 2px offset. On a flooded tile the outline uses foreground.

### Door Tiles
- **Shape:** `tile` radius, hairline edge, at least 128px tall (148px from `sm`), 16px padding.
- **Fill:** the door's own palette tint as a gradient (26% to 10% to dark glass). This is user-pinned.
- **Content:** a 36px tinted icon chip top-left, the title and a one-line muted description bottom-left, and a 28px arrow top-right that nudges 2px up-right on hover.
- **Parity:** built-in modules (buttons) and pinned shortcuts (anchors) share one renderer and one look.

### Buttons
- **Shape:** `control` radius. Minimum height 42–44px for primary actions, 36px for in-panel refresh.
- **Primary:** solid primary with ink text. Hover swaps to the honey accent fill.
- **Glass:** the pane tint with a hairline. Hover lifts the tint toward foreground by 10% and brightens the edge.
- **Danger:** a coral-tinted fill with a coral hairline and coral-pink text.
- **Focus:** a primary outline or a 4px primary-ring ring. Disabled controls drop to 45–55% opacity.

### Schedule Grid
- **Cells:** hairline right and bottom rules. Today's column gets a light primary wash, and its header gets a 22% primary wash plus a 2px primary bottom rule.
- **Blocks:** `inner` radius, inset 2–3px from the cell edges, with a quiet hashed course tint. The block in progress is the one flooded block (primary at 82%, ink text, a 現在 badge in ink with primary text). Blocks on calendar no-class days fade to 45% opacity and lose saturation.

### Absence List
- One inline summary line (`label count · label count`), then a hairline-divided list. Each row has the course name (semibold), a muted meta line, and a status line led by a 6px palette-coloured dot.

### Error Panel (launch, server login)
- A coral-tinted pane with a named error (無法開啟 / 無法登入) and recovery copy in zh-Hant.
- The raw detail stays collapsed by default under a 技術細節 summary, in a mono `pre` (max 10rem, scrollable, `inner` radius).
- Then two clear actions: 重試 (primary) and 回到首頁 (glass).

### Navigation / Top Bar
- The avatar sits in a primary-soft tile with a primary-ring edge. The school name is a small muted line above the product name. The status pill is collapsible to a bare 42px icon and coloured primary when connected. The settings button is solid primary (user-pinned).

## Do's and Don'ts

### Do:
- **Do** read every colour from the theme variables (`--primary`, `--primary-soft`, `--primary-ring`, `--control-*`) so the owner's colour, saturation and brightness controls drive the whole page.
- **Do** keep flood strength (primary at 78–82%) for "now" and "later today" only.
- **Do** pass any palette colour used as a tint or glyph colour through legibleAccent, so dark swatches stay visible on glass.
- **Do** give every tile and control `box-shadow: none`, one hairline, and the shared blur and saturate.
- **Do** keep press-tilt and data-change flip as the only motion on the dashboard, and turn both off under `prefers-reduced-motion`.
- **Do** write UI chrome in zh-Hant. Use a named error, zh-Hant recovery copy, collapsed raw detail, and two actions for every failure state.
- **Do** keep phone schedule columns at least 104px wide, with a sticky opaque period column and auto-scroll to today.

### Don't:
- **Don't** "fix" the user-pinned door tints, icon chips, accent username or accent settings button to satisfy the One Accent Rule.
- **Don't** use side stripes or nested cards in the absence list. Use hairline dividers and a small status dot.
- **Don't** add page-load entrance staggers, fades or rises to the dashboard wall.
- **Don't** add sheen, inner highlights, bevels or drop shadows to panes.
- **Don't** shrink or wrap the greeting to make it fit.
- **Don't** use tracked uppercase eyebrows or kickers above headings. Section titles stand alone as large light headings.
- **Don't** let any non-primary hue mark today, now, focus or connected.
