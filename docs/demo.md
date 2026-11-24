# GitHub Pages interactive demo

The public demo mirrors both the production dashboard and the rebuilt **AIS Student Hub (`ais.html`)**, **TronClass Hub (`tronclass.html`)**, and **Library Hub (`library.html`)** interfaces using **100% fictional sample data** and browser-local state.
It never touches the ePortal login handler, real AIS/TronClass/Library records, SSO sessions, deployment credentials, or production backend APIs.

| Production feature | Safe demo behavior |
| --- | --- |
| Dashboard module cards & shortcuts | Interactive tiles linking directly to AIS, TronClass, and Library demo hubs; external modules show preview dialogs (`WebMail`, `活動報名`, `學習歷程`, etc.); HTTP(S) custom shortcuts saved in localStorage |
| Appearance, avatar & themes | Editable username/avatar, 9 color schemes, colorfulness, brightness, background image/blur/parallax, synced automatically into AIS, TronClass, and Library hubs |
| Timetable, program & absences | Sample day/evening/weekend classes, Taiwan-local dates, attendance counts/filters |
| AIS Student Hub (`ais.html`) | Overview KPIs, clickable week schedule & full 9-week syllabus, multi-semester grades & 4-year checklist, absences, paginated announcements, and privacy reveal toggle powered by fictional student fixtures |
| TronClass Hub (`tronclass.html`) | Ongoing/past courses, upcoming todos, lecture materials, graded quiz review, interactive practice exam taking with live mock grading, and simulated **問 AI 這題** explanations + follow-ups |
| Library Hub (`library.html`) | 48 sample books with inline SVG covers, browse-all catalog with scope/facet tags/sort/page-jump counter, enriched book details modal, stateful loan renewal, `10F-1`–`10F-7` carrel calendar booking/cancellation, and database directory |
| Hitokoto quotes | Opt-in public API, locally bundled OpenCC, browser translator fallback |
| University login, SSO, real credentials | Not included; outbound classic/SSO anchors are intercepted cleanly with a demo toast |

All demo account, appearance, and shortcut settings are saved in visitors' browser `localStorage`; hub mutations (renewing a sample loan, submitting a practice exam, booking/canceling a carrel) live purely in in-memory page fixtures via `demo/demo-hub-runtime.js`.

## Architecture

Vite builds `demo/` with `base: "./"` and `cssCodeSplit: true` into `demo-dist/` across four static entry points (`index.html`, `ais.html`, `tronclass.html`, `library.html`) so GitHub Pages subpath hosting (`/Personal-NUTC-Eportal/`) works without a backend server.

## Publish on GitHub Pages

GitHub Pages is enabled for this repository, using **GitHub Actions**
as its deployment source. The workflow deploys only the compiled `demo-dist/`
directory after relevant pushes to `main`.

1. Open [Actions → Publish public demo (GitHub Pages)](https://github.com/Rynowastaken/Personal-NUTC-Eportal/actions/workflows/demo-pages.yml) to inspect the latest deployment.
2. Push changes to `demo/`, the hub frontends, or the workflow on `main` to publish automatically; alternatively choose **Run workflow** on `main` for a manual redeploy.
3. After **Deploy to GitHub Pages** succeeds, the live demo is available at:

   **https://rynowastaken.github.io/Personal-NUTC-Eportal/**

The workflow never publishes `.env`, Playwright profiles, application credentials, `data/`, or server code.

## Preview locally

Install dependencies and build the static bundle into `demo-dist/`:

```bash
npm install
npm run build:demo
python3 -m http.server 8765 --directory demo-dist
```

Open `http://localhost:8765/` to preview every interactive hub locally.

## Test

```bash
node --check demo/app.js demo/demo-hub-runtime.js demo/demo-data-ais.js demo/demo-data-tronclass.js demo/demo-data-library.js
node --test test/demo-site.test.js test/demo-parity.test.js
```
