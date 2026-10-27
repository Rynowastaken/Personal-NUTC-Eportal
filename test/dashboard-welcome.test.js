import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("live dashboard has one large personalized welcome heading below the toolbar", async () => {
  const html = await read("public/index.html");
  const headerEnd = html.indexOf("</header>");
  const heading = html.indexOf('id="welcomeHeading"');
  assert.ok(headerEnd > 0 && heading > headerEnd,
    "welcome heading must be outside the compact toolbar");
  assert.equal((html.match(/id="welcomeHeading"/g) || []).length, 1);
  assert.equal((html.match(/id="welcomeUsername"/g) || []).length, 1);
  assert.match(html, /<h1 id="welcomeHeading" class="portal-welcome-title">/);
  assert.match(html, /Welcome: <span id="welcomeUsername">User<\/span>/);
  assert.match(html, /class="portal-welcome-subtitle">你的校園日常，一眼掌握。<\/p>/);
  assert.match(html, /首頁會顯示為 Welcome: Username。/);
  assert.match(html, /\/dashboard\.css\?v=3/);
  assert.doesNotMatch(html, /Welcome! <span/);
});

test("existing account profile updates the hero username using safe textContent", async () => {
  const app = await read("public/app.js");
  assert.match(app, /const welcomeUsername = document\.querySelector\("#welcomeUsername"\)/);
  assert.match(app, /function applyAccountProfile\(profile = currentAccountProfile\)/);
  assert.match(app, /welcomeUsername\.textContent = username;/);
  assert.doesNotMatch(app, /welcomeUsername\.innerHTML\s*=/);
});

test("welcome headline matches demo typography while remaining mobile-safe", async () => {
  const css = await read("public/dashboard.css");
  const demoCss = await read("demo/styles.css");
  assert.match(demoCss, /\.welcome h1 \{ font-size: clamp\(31px/);
  assert.match(css, /\.portal-welcome-title\s*\{[\s\S]*?font-size: clamp\(2\.15rem, 5\.2vw, 3\.5rem\);/);
  assert.match(css, /\.portal-welcome-title\s*\{[\s\S]*?font-weight: 800;/);
  assert.match(css, /\.portal-welcome-title\s*\{[\s\S]*?letter-spacing: -\.07em;/);
  assert.match(css, /#welcomeUsername\s*\{[\s\S]*?color: var\(--primary, #e6a4ad\);/);
  assert.match(css, /overflow-wrap: anywhere;/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /font-size: clamp\(1\.9rem, 8\.2vw, 2\.35rem\)/);
});
