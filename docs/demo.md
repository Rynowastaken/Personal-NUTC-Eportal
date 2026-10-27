# GitHub Pages interactive demo

The public demo mirrors the production dashboard's non-authentication user
interface, using fictional student data and browser-local preferences.
It never touches the ePortal login handler, AIS records, SSO sessions,
deployment credentials, or production backend APIs.

| Production dashboard feature | Safe demo behavior |
| --- | --- |
| Five module cards | Same glass-style tiles with preview dialogs, never SSO |
| Customizable username / avatar | Editable; stored only in this browser |
| Custom shortcuts | Add, edit, pin, unpin, delete, and visit HTTP(S) links |
| Timetable and academic program | Sample day/evening/weekend classes and Taiwan-local dates |
| Holidays and absence records | Clearly marked sample calendar, counts, filters and refresh |
| Theme settings | Nine color schemes, colorfulness and theme brightness |
| Background control | Local image file, drag-and-drop/paste, clear and brightness |
| Background scroll | Optional parallax with reduced-motion support |
| Hitokoto quotes | Opt-in public API, locally bundled OpenCC, language fallback, speaker/work toggles |
| Server update / restart / status | Simulated screens and progress only |
| University login, SSO, student records | Not included |

All demo account, appearance and shortcut data is stored in visitors'
localStorage, not on the real portal server. The only network API called by
the demo is the public Hitokoto endpoint when enabled. If unavailable, a
clearly labeled offline sample quote is shown.

## Publish on GitHub Pages

GitHub Pages is enabled for this repository, using **GitHub Actions**
as its deployment source. The custom workflow deploys the sample-only `demo/`
directory after each relevant push to `main`.

1. Open [Actions → Publish public demo (GitHub Pages)](https://github.com/Rynowastaken/Personal-NUTC-Eportal/actions/workflows/demo-pages.yml) to inspect the latest deployment.
2. Push changes to `demo/` or its workflow on `main` to publish automatically;
   alternatively choose **Run workflow** on **main** for a manual redeploy.
3. After the workflow's **Deploy to GitHub Pages** job succeeds, the site will be at:

   **https://rynowastaken.github.io/Personal-NUTC-Eportal/**

The deployment workflow publishes **only the generated demo-dist/ folder**. This is not
the backend server and it does not publish \`.env\`, Playwright profiles,
application credentials, the full project source, or server code.

## Preview locally

Install project dependencies and bundle OpenCC into standalone browser
assets with these commands:

    npm install
    npm run build:demo
    python3 -m http.server 8765 --directory demo-dist

Open http://localhost:8765/ to test the complete interactive demo. The
source folder demo/ is not served directly because browser imports to the
OpenCC package require bundling. Vite builds relative URLs so GitHub Pages
project paths work without redirecting to your portal's production server.

## Test

\`\`\`bash
node --check demo/app.js
node --test test/demo-site.test.js test/demo-parity.test.js
\`\`\`

Existing GitHub Actions builds and tests also run for pull requests.

If validation succeeds but deployment fails, check the `Deploy to GitHub Pages`
job for environment and repository permissions. The workflow will never
deploy pull requests, and the URL should only be described as live after GitHub
reports a successful Pages deployment.
