# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the owner, a National Taichung University of Science and Technology (NUTC) student, who self-hosts this dashboard. The typical use is a quick daily glance on phone and desktop: what class is next, how many absences have piled up, and a one-tap jump into an ePortal subsystem without logging in again.

## Purpose

Put the weekly AIS class schedule, absence records, and the five ePortal subsystems (學生管理, WebMail, 活動報名, EP 學習歷程, TronClass) on one page. A server-side headless Chromium keeps the ePortal session alive; the server only bridges the SSO token, and the user's own browser completes sign-in to each subsystem.

## Capabilities to preserve

- Weekly schedule grid with academic program (學制) switching; absence list with category filters and totals.
- ePortal subsystem launchers and user-defined pinned web shortcuts (add / edit / pin / delete).
- Server login bridge flow, reconnect and expired-session states.
- Custom avatar, display name, user-uploaded background image with independent brightness (0–200%) and scroll parallax that respects reduced motion.
- Theme controls: light / dark, colour saturation, brightness.
- Optional Hitokoto welcome quotes with OpenCC Traditional Chinese conversion and language controls.
- Holiday calendar.
- Public GitHub Pages demo that mirrors the dashboard with sample data.

## Constraints

- UI language is Traditional Chinese (zh-Hant); Latin labels appear for some settings.
- Unofficial personal project, not affiliated with NUTC; must not imitate official university branding.
- Stack: Node server + static `public/` HTML/vanilla JS, Tailwind built by Vite, a small React/shadcn island. Existing tests assert on markup and behaviour.
- The README's vibe-code warning must stay verbatim.
