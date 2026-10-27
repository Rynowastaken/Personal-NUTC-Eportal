# GitHub Pages interactive demo

The static public demo lives in [demo/](../demo) and has **no access to the
university login flow, your deployed server, its private preferences, cookies,
or AIS APIs**. It shows fictional courses, an example attendance summary,
module previews, theme brightness, smooth background scrolling, and
custom shortcuts stored only in each visitor's browser.

## Publish on GitHub Pages

This repository is public, but GitHub Pages may not have been enabled yet.
Repository administrators must enable it once; the GitHub connector's
repository-editing actions do not expose Pages settings.

1. Open [Repository Settings → Pages](https://github.com/Rynowastaken/Personal-NUTC-Eportal/settings/pages).
2. Under **Build and deployment**, select **GitHub Actions** as Source.
3. Open [Actions → Publish public demo (GitHub Pages)](https://github.com/Rynowastaken/Personal-NUTC-Eportal/actions/workflows/demo-pages.yml).
4. Choose **Run workflow** and select **main**. Later changes to the demo
   automatically publish when pushed to main.
5. When the deployment finishes, the site will be at:

   **https://rynowastaken.github.io/Personal-NUTC-Eportal/**

The deployment workflow publishes **only the demo/ folder**. This is not
the backend server and it does not publish \`.env\`, Playwright profiles,
application credentials, the full project source, or server code.

## Preview locally

No npm installation is needed for the demo:

\`\`\`bash
python3 -m http.server 8765 --directory demo
\`\`\`

Then open http://localhost:8765/ and try the five service cards, settings
slider, sample timetable refresh, and custom shortcut manager.

The demo is deliberately standalone so it works under a GitHub Pages project
subpath. Its CSS and JS links are relative (\`./styles.css\`, \`./app.js\`).
It uses no live ePortal endpoints, requires no account and never asks visitors
for university passwords.

## Test

\`\`\`bash
node --check demo/app.js
node --test test/demo-site.test.js
\`\`\`

Existing GitHub Actions builds and tests also run for pull requests.

If you see a green validation check but no deployment, check that Pages
has been enabled and that its Source is set to **GitHub Actions**. The
deployment job is intentionally skipped until that one-time setting is
enabled; it must not impersonate an administrator or claim a URL is live
before GitHub reports a successful Pages deployment.
