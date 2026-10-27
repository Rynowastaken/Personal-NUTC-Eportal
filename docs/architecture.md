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

## In-site updater (Update Server)

The Settings → Server → **Update** button now starts an asynchronous update
operation and shows each step on the page:

1. Fast-forward Git only (`git pull --ff-only`).
2. Install dependencies if `package.json` or a lockfile has changed, or the
   installed dependency fingerprint is absent/outdated. This fingerprint lives
   in ignored `node_modules/.nutc-dependency-revision`, so failed installs
   will retry even after Git has already pulled the new commit.
3. Ensure the installed Playwright version's Chromium binaries are present
   with the local Playwright CLI (also when npm dependencies are unchanged).
   npm installs packages but does not necessarily download a matching browser.
4. Always rebuild the frontend, including when Git is already up to date.
   This allows an in-site **Repair** of broken or missing compiled UI assets.
5. Write to a private temporary directory, validate `site.css` and `ui.js`,
   then replace `public/generated/` with rollback on publish failure.
6. Restart only after Chromium provisioning and a valid frontend build. The browser follows the
   operation through `/api/debug/update/status`, waits for a **new instance
   ID**, then navigates to a versioned URL.

The repository currently does not commit `package-lock.json`. Some servers
already have a **local, untracked** lockfile from a manual `npm install`. Such
files may be stale after new dependencies like `opencc-js` are added. The
updater now checks Git's index before choosing an install command:

- If a lockfile is **tracked by Git**, try reproducible `npm ci` first.
  If npm reports a lockfile mismatch, retry once with
  `npm install --no-save --package-lock=false --no-audit --no-fund`.
  This keeps the site recoverable without modifying the committed lockfile.
  Maintainers should still synchronize and commit the lockfile; other npm
  installation errors do not trigger a retry.
- If a lockfile is **not tracked**, ignore any stale local copies and run
  `npm install --no-save --package-lock=false --no-audit --no-fund`.
  The updater leaves the local lockfile untouched.

The server exposes progress and concise failure messages without including
secrets or browser profiles. If a Git pull, Chromium install, or build fails,
it will not restart and the previous generated CSS/JS are retained.

### Recovering from missing Playwright Chromium after an in-site update

Without a committed lockfile, `npm install` can upgrade `playwright` within
the allowed semver range. Each Playwright version requires matching Chromium
binaries, but npm installing the package alone is not sufficient. The Update
button now invokes `node_modules/playwright/cli.js install chromium` using
the running server's Node executable and environment after any npm install
and on every manual repair update. Existing matching binaries are reused.
This installs into the same service user's browser cache, respecting
`PLAYWRIGHT_BROWSERS_PATH` if set. For the first rollout of this fix, apply
the new code, restart to load the new updater, and run Update once more.
If the browser download fails, check the network and available disk space.
Operating-system Chromium libraries still need administrator installation
when missing (`npm run install-browser` / `npm run doctor`).

### Recovering from `npm error code EUSAGE`

If an older updater reports `npm ci` and `Missing: opencc-js@1.4.2 from lock
file`, Git has probably already pulled the new code. After this fix is
merged, click **Update** once to fetch it, **Restart** to load the new updater,
then **Update** again. The second update should ignore your untracked stale
lockfile. If a server uses a genuinely committed lockfile that is out of sync, the
updater retries once without using the lockfile. Fix and commit the lockfile
in the repository for reproducible future updates rather than changing
tracked files on the live server.

### Recovering from `spawn npm ENOENT`

Some systemd services start with a restricted `PATH`. If the dashboard reports
`npm failed: spawn npm ENOENT`, the previous updater could not find npm even
though Node itself was running. The updater now launches npm's JavaScript CLI
using `process.execPath`, and rebuilds with the local Vite JavaScript CLI
directly. It prepends the Node binary directory and normal system locations
to child process `PATH`; no system-wide service changes should be needed for
a normal Node + npm install.

**One-time recovery after upgrading:** the old in-memory updater may have
already fetched the new Git commit before failing. After the fix is merged,
click **Settings → Server → Update** once to fetch it (the old updater might
still report the same error), then click **Restart** to load the new updater
code, and finally click **Update** again to rebuild the frontend. If the web
restart is unavailable, from the server's project folder run:

```bash
git pull --ff-only
npm install
npm run verify
sudo systemctl restart personal-nutc-eportal.service
```

If the fixed updater reports `SERVER_UPDATE_NPM_UNAVAILABLE`, npm's CLI
really is missing or installed in a nonstandard directory. Locate it with
`readlink -f "$(command -v npm)"`; if it is a JavaScript CLI, set the
service environment variable `NUTC_NPM_CLI_PATH` to its absolute path and
restart the service. The server leaves the previous frontend assets intact
when install or build fails.

Static portal HTML, CSS and JavaScript are served with `Cache-Control:
no-store`; each server boot also injects a unique `build` query parameter
into its HTML asset references. The only immutable assets are versioned
third-party vendor files.

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
