import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  staticCacheControl,
  stampHtmlAssetRevision,
} from "../src/static-assets.js";

test("replaceable UI assets are never cached as immutable", () => {
  for (const ext of [".html", ".js", ".css"]) {
    assert.equal(staticCacheControl("generated/site" + ext, ext), "no-store");
  }
  assert.equal(staticCacheControl("dashboard.css", ".css"), "no-store");
  assert.equal(staticCacheControl("vendor/lucide.js", ".js"),
    "public, max-age=31536000, immutable");
});

test("each server boot gives HTML links a fresh revision without changing external URLs", () => {
  const html = [
    '<link rel="stylesheet" href="/generated/site.css?v=5" />',
    '<script src="/app.js?v=65" type="module"></script>',
    '<script src="/generated/ui.js?v=1" type="module"></script>',
    '<script src="https://example.com/app.js"></script>',
    '<a href="/docs">Docs</a>',
  ].join("\n");
  const result = stampHtmlAssetRevision(html, "new-instance/123");
  assert.match(result, /site\.css\?v=5&build=new-instance%2F123/);
  assert.match(result, /app\.js\?v=65&build=new-instance%2F123/);
  assert.match(result, /ui\.js\?v=1&build=new-instance%2F123/);
  assert.match(result, /src="https:\/\/example\.com\/app\.js"/);
  assert.match(result, /href="\/docs"/);
});

test("server provides asynchronous update and progress polling with a single active job", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server, /url\.pathname === "\/api\/debug\/update\/status"/);
  assert.match(server, /updateOperation\?\.state === "running"/);
  assert.match(server, /sendJson\(res, 202, \{ ok: true, \.\.\.operation/);
  assert.match(server, /onProgress\(\{ stage, detail \}\)/);
  assert.match(server, /restartScheduled = true;/);
  assert.match(server, /assetRevision: serverInstanceId/);
  assert.match(server, /stampHtmlAssetRevision\(raw\.toString\("utf8"\), serverInstanceId\)/);
});

test("dashboard waits for the NEW instance and forces a fresh navigation", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /waitForUpdateAndRestart\(previousInstanceId, operationId\)/);
  assert.match(app, /state\.instanceId !== previousInstanceId/);
  assert.match(app, /state\.id !== operationId/);
  assert.match(app, /state\.state === "error"/);
  assert.match(app, /target\.searchParams\.set\("build", newInstanceId\)/);
  assert.match(app, /window\.location\.replace\(target\.toString\(\)\)/);
});
