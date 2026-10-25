# Codebase architecture and contributor workflow

The portal intentionally runs two different UI styles: the dashboard is
progressively enhanced vanilla JavaScript, while selected controls use
source-owned shadcn-style React components. Do **not** migrate authentication
or SSO flows while making visual-only changes.

## Directory boundaries

| Path | Responsibility |
| --- | --- |
| `server.js` | HTTP route dispatch, response headers, launch jobs, service lifecycle |
| `src/portal-session.js` | Server-owned Playwright browser session, profile locks, ePortal handoff |
| `src/login-bridge.js` | Interactive ePortal login flow and CAPTCHA handoff |
| `src/server-update.js` | Git update + Vite rebuild before dashboard-triggered restart |
| `src/class-schedule.js`, `src/absence-list.js` | AIS scraping and cache |
| `src/dashboard-preferences.js` | Appearance and shortcut persistence |
| `public/index.html` | Dashboard structure, landmarks, accessible dialogs |
| `public/dashboard.css` | Dashboard-only glass cards, dialogs, buttons (loaded after Tailwind) |
| `public/app.js` | Dashboard state and event handling |
| `public/dashboard-cards.js` | Shared native-card rendering for modules and custom links |
| `public/theme.js` | Theme and background appearance settings |
| `frontend/src/` | Compiled Tailwind styles and React/shadcn component source |
| `test/` | Node's built-in test runner: unit and structure-regression tests |
| `scripts/check-syntax.mjs` | Discovers source JavaScript automatically for `node --check` |

## Local workflow

```bash
npm install
npm run verify
npm start
```

- `npm run build`: regenerate `public/generated/site.css` and `ui.js`.
- `npm run build:watch`: compile UI changes continuously while developing.
- `npm run check`: discover and syntax-check `.js`, `.mjs`, and `.cjs`
  under source/script/test directories; excludes vendored or built output.
- `npm test`: execute all `test/*.test.js`.
- `npm run verify`: run build, syntax checks, then tests.
- JSX source is validated by the Vite build, not `node --check`.

Always add a regression test when changing interactive UI, login state,
profile locking, or Git-update behavior. Build before restarting systemd,
which launches `node server.js` directly and does not invoke npm scripts.
The authenticated dashboard's Update action already runs the frontend build
after pulling new commits and before restarting.

## Changes with elevated risk

- **Login/SSO**: avoid storing credentials; user-initiated re-login must
  remain explicit, and cookies from other origins cannot be accessed.
- **Generated assets**: never edit `public/generated/` manually. It is
  intentionally ignored by Git.
- **Mobile glass cards**: preserve the CSS-independent fallback backgrounds
  supplied by `public/dashboard-cards.js`, so older mobile assets don't
  render invisible cards.
- **CSS precedence**: compiled `/generated/site.css` loads first; the
  uncompiled `/dashboard.css` loads second and owns dashboard-specific
  rules. When changing either asset, increment its version query string
  in `public/index.html` to avoid stale browser caches.
- **Tests**: CI must pass a build, syntax checks, and the test suite before
  merging structural changes.

## Follow-on refactoring

`public/app.js` and `src/portal-session.js` are still large. Extracting
small, cohesive modules with tests is safer than splitting them all at once.
Keep shared rendering in `public/dashboard-cards.js`; move new feature
logic into independent modules rather than adding more code to those files.
