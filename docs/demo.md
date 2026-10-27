# GitHub Pages interactive demo

The static public demo lives in [demo/](../demo) and has **no access to the
university login flow, your deployed server, its private preferences, cookies,
or AIS APIs**. It shows fictional courses, an example attendance summary,
module previews, theme brightness, smooth background scrolling, and
custom shortcuts stored only in each visitor's browser.

## Publish on GitHub Pages

GitHub Pages is enabled for this repository, using **GitHub Actions**
as its deployment source. The custom workflow deploys the sample-only `demo/`
directory after each relevant push to `main`.

1. Open [Actions → Publish public demo (GitHub Pages)](https://github.com/Rynowastaken/Personal-NUTC-Eportal/actions/workflows/demo-pages.yml) to inspect the latest deployment.
2. Push changes to `demo/` or its workflow on `main` to publish automatically;
   alternatively choose **Run workflow** on **main** for a manual redeploy.
3. After the workflow's **Deploy to GitHub Pages** job succeeds, the site will be at:

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

If validation succeeds but deployment fails, check the `Deploy to GitHub Pages`
job for environment and repository permissions. The workflow will never
deploy pull requests, and the URL should only be described as live after GitHub
reports a successful Pages deployment.
