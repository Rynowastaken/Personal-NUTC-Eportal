import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { listSyntaxFiles } from "../scripts/check-syntax.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("syntax checker discovers new source files and excludes generated/vendor files", async () => {
  const files = await listSyntaxFiles();
  for (const file of [
    "server.js",
    "src/server-update.js",
    "public/dashboard-cards.js",
    "scripts/check-syntax.mjs",
    "test/server-update.test.js",
  ]) {
    assert.ok(files.includes(file), file + " must be checked automatically");
  }
  assert.ok(files.length >= 35, "source scanner appears to have missed directories");
  assert.ok(!files.some(file => file.startsWith("public/vendor/")));
  assert.ok(!files.some(file => file.startsWith("public/generated/")));
  assert.ok(!files.some(file => file.endsWith(".jsx")),
    "Vite is responsible for checking JSX");
  assert.deepEqual(files, [...new Set(files)].sort());
});

test("dashboard-only styling lives in dedicated CSS with no duplicate inline blocks", async () => {
  const html = await read("public/index.html");
  const css = await read("public/dashboard.css");
  assert.doesNotMatch(html, /<style\b/);
  assert.match(html, /<link rel="stylesheet" href="\/dashboard\.css\?v=2"/);
  assert.ok(html.indexOf("/generated/site.css") < html.indexOf("/dashboard.css"));
  for (const selector of [
    ".dashboard-tinted-glass",
    ".dashboard-overview-glass",
    ".custom-link-control",
    "#customLinksDialog",
  ]) {
    assert.ok(css.includes(selector), selector + " moved out of HTML");
  }
});

test("shared card factory is imported rather than duplicated in dashboard controller", async () => {
  const app = await read("public/app.js");
  const cards = await read("public/dashboard-cards.js");
  assert.match(app, /import \{ moduleAccent, createDashboardModuleCard \} from "\.\/dashboard-cards\.js\?v=2";/);
  assert.doesNotMatch(app, /^function createDashboardModuleCard\(/m);
  assert.match(cards, /export function createDashboardModuleCard\(/);
  assert.match(cards, /export function moduleAccent\(/);
});

test("HTTP server imports the updater instead of defining a second build pipeline", async () => {
  const server = await read("server.js");
  const updater = await read("src/server-update.js");
  assert.match(server, /import \{ createServerUpdater \} from "\.\/src\/server-update\.js"/);
  assert.doesNotMatch(server, /^function runGit\(/m);
  assert.match(updater, /export function createServerUpdater\(/);
  assert.match(updater, /await verifyAssets\(staged\)/);
});

test("one verification command covers build, syntax, and automated tests", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.scripts.check, "node scripts/check-syntax.mjs");
  assert.equal(pkg.scripts.verify, "npm run build && npm run check && npm test");
});
