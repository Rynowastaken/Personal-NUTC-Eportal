import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFile(path.join(base, file), "utf8");
const [html, css, script] = await Promise.all([
  read("demo/index.html"), read("demo/styles.css"), read("demo/app.js"),
]);

test("GitHub Pages demo has local, base-path-safe assets", async () => {
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css">/);
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
  assert.match(html, /<script type="module" src="\.\/features\.js"><\/script>/);
  assert.match(html, /href="\.\/features\.css"/);
  assert.doesNotMatch(html, /src="\/(?:app|theme|generated)|href="\/generated/);
  for (const file of ["demo/index.html", "demo/styles.css", "demo/app.js", "demo/features.css", "demo/features.js"]) {
    assert.ok((await stat(path.join(base, file))).size > 1000);
  }
});

test("preview clearly labels sample data and never relies on live university APIs", () => {
  assert.match(html, /DEMO MODE/);
  assert.match(html, /沒有真實登入、學籍資料或學校系統連線/);
  assert.match(html, /示範課表/);
  assert.match(html, /模擬統計/);
  assert.match(script, /COURSES = Object\.freeze/);
  assert.match(script, /timeZone: "Asia\/Taipei"/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket|\/api\/|eportal\.nutc\.edu\.tw|ais\.nutc\.edu\.tw/);
  assert.doesNotMatch(html, /type="password"|name="password"|action="https?:/);
  assert.doesNotMatch(html + script + css, /AKfycbw935_0y_iKPCBvL0ri9cwq4iUI/);
});

test("sample module cards, dialogs and shortcut manager are present", () => {
  for (const id of ["student", "mail", "events", "learning", "tron"]) {
    assert.ok(html.includes('data-service="' + id + '"'));
  }
  for (const id of ["serviceDialog", "settingsDialog", "shortcutDialog",
                    "manageShortcuts", "shortcutGrid", "shortcutForm"]) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /dialog\.showModal\(\)/);
  assert.match(script, /state\.shortcuts\.splice\(index, 1\)/);
  assert.match(script, /target = "_blank"/);
  assert.match(script, /rel = "noopener noreferrer"/);
});

test("custom links reject unsafe URLs and accept https/http addresses", () => {
  const start = script.indexOf("function validExternalUrl(value) {");
  const end = script.indexOf("function loadState()", start);
  assert.ok(start >= 0 && end > start);
  const validExternalUrl = new Function(
    script.slice(start, end) + "\nreturn validExternalUrl;",
  )();
  assert.equal(validExternalUrl("https://example.com"), "https://example.com/");
  assert.equal(validExternalUrl("http://example.com/path"), "http://example.com/path");
  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "mailto:user@example.com",
    "",
    "not a URL",
  ]) {
    assert.equal(validExternalUrl(unsafe), null);
  }
});

test("responsive glass cards have explicit rounded outlines without duplicate edge layers", () => {
  assert.match(css, /\.module-card\s*\{[\s\S]*?border-radius: 21px;[\s\S]*?border: 1px solid rgba/);
  assert.match(css, /\.module-icon\s*\{[^\}]*border-radius: 13px;/);
  assert.match(css, /\.module-arrow\s*\{[^\}]*border-radius: 11px;/);
  assert.match(css, /background-clip: padding-box/);
  assert.doesNotMatch(css, /\.module-card::before/);
  assert.match(css, /@media\(max-width: 600px\)/);
  assert.match(css, /@media\(prefers-reduced-motion: reduce\)/);
});

test("Pages workflow deploys only public demo without publishing source or secrets", async () => {
  const workflow = await read(".github/workflows/demo-pages.yml");
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /\bpath: demo-dist\b/);
  assert.match(workflow, /npm run build:demo/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
  assert.doesNotMatch(workflow, /github\.event\.repository\.has_pages == true/);
  assert.doesNotMatch(workflow, /path: \.\/?$/m);
});
