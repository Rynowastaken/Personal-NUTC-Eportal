import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoFile = async (path) =>
  readFile(new URL("../" + path, import.meta.url), "utf8");

test("production HTML loads compiled CSS, not the Tailwind browser CDN", async () => {
  for (const path of ["public/index.html", "public/server-login.html", "public/launch.html"]) {
    const html = await repoFile(path);
    assert.match(html, /<link rel="stylesheet" href="\/generated\/site\.css\?v=\d+"/);
    assert.match(html, /<script src="\/theme-defaults\.js\?v=1"/);
    assert.doesNotMatch(html, /tailwind-config\.js|vendor\/tailwindcss-3|cdn\.tailwindcss\.com/);
  }
});

test("React shadcn UI is a progressive enhancement of existing shortcuts", async () => {
  const html = await repoFile("public/index.html");
  const app = await repoFile("public/app.js");
  const island = await repoFile("frontend/src/main.jsx");
  const button = await repoFile("frontend/src/components/ui/button.jsx");

  assert.match(html, /id="customLinksButtonReactRoot"/);
  assert.match(html, /id="manageCustomLinks"/);
  assert.match(html, /<script src="\/generated\/ui\.js\?v=1" type="module"/);
  assert.match(app, /document\.addEventListener\("click", \(event\) => \{\s*if \(!event\.target\.closest\("#manageCustomLinks"\)\)/);
  assert.match(island, /createRoot\(root\)\.render\(<ManageLinksButton \/>\)/);
  assert.match(island, /<Button[\s\S]*?variant="glass"/);
  assert.match(button, /@radix-ui\/react-slot/);
  assert.match(button, /class-variance-authority/);
});

test("Vite compiles Tailwind from existing HTML and new React components", async () => {
  const pkg = JSON.parse(await repoFile("package.json"));
  const tailwind = await repoFile("tailwind.config.cjs");
  const vite = await repoFile("vite.config.js");
  const styles = await repoFile("frontend/src/styles.css");

  assert.match(pkg.scripts.build, /vite build/);
  assert.match(pkg.scripts.postinstall, /npm run build/);
  assert.match(pkg.scripts.start, /npm run build/);
  assert.ok(pkg.dependencies.react && pkg.dependencies["react-dom"]);
  assert.ok(pkg.dependencies.tailwindcss && pkg.dependencies.vite);
  assert.match(tailwind, /\.\/public\/\*\.html/);
  assert.match(tailwind, /\.\/public\/\*\.js/);
  assert.match(tailwind, /\.\/frontend\/src/);
  assert.match(vite, /outDir: process\.env\.NUTC_BUILD_OUT_DIR \|\| "public\/generated"/);
  assert.match(styles, /@tailwind base;/);
  assert.match(styles, /@tailwind utilities;/);
});
