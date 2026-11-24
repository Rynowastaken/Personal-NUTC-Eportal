import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loginRequestOptions } from "../public/login-route.js";

test("the banner's Re-login ePortal action requests a fresh login form", async () => {
  assert.deepEqual(loginRequestOptions("?force=1"), { force: true, next: "/" });
  assert.deepEqual(loginRequestOptions("?autocheck=1"), { force: false, next: "/" });
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /href="\/server-login\/\?force=1"/);
});

test("Reconnect AIS and rebuilt portal hubs require fresh login then return to origin", async () => {
  assert.deepEqual(loginRequestOptions("?force=1&next=%2Fgo%2Fais"), {
    force: true,
    next: "/go/ais",
  });
  assert.deepEqual(loginRequestOptions("?force=1&next=%2Fais"), {
    force: true,
    next: "/ais",
  });
  assert.deepEqual(loginRequestOptions("?force=1&next=%2Ftronclass"), {
    force: true,
    next: "/tronclass",
  });
  assert.deepEqual(loginRequestOptions("?force=1&next=%2Flibrary"), {
    force: true,
    next: "/library",
  });
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const aisJs = await readFile(new URL("../public/ais.js", import.meta.url), "utf8");
  const tronclassJs = await readFile(new URL("../public/tronclass.js", import.meta.url), "utf8");
  const libraryJs = await readFile(new URL("../public/library.js", import.meta.url), "utf8");
  const launchJs = await readFile(new URL("../public/launch.js", import.meta.url), "utf8");
  assert.match(html, /href="\/server-login\/\?force=1&amp;next=%2Fais"/);
  assert.doesNotMatch(html, /next=%2Fgo%2Fais/);
  assert.match(aisJs, /href: "\/server-login\/\?force=1&next=%2Fais"/);
  assert.match(tronclassJs, /href: "\/server-login\/\?force=1&next=%2Ftronclass"/);
  assert.match(libraryJs, /href: "\/server-login\/\?force=1&next=%2Flibrary"/);
  assert.match(launchJs, /\/server-login\/\?force=1/);
});

test("post-login return destination cannot redirect to arbitrary origins", () => {
  for (const value of [
    "https://evil.example/",
    "//evil.example/",
    "/go/ais/../not-ais",
    "/go/webmail",
    "javascript:alert(1)",
  ]) {
    const parsed = loginRequestOptions("?force=1&next=" + encodeURIComponent(value));
    assert.deepEqual(parsed, { force: true, next: "/" });
  }
});

test("forced login bypasses saved-session auto completion and clears ePortal, AIS, and SSO cookies", async () => {
  const bridge = await readFile(new URL("../src/login-bridge.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const frontend = await readFile(new URL("../public/server-login.js", import.meta.url), "utf8");
  assert.match(bridge, /if \(session\.forceLogin\) \{[\s\S]*?clearCookies\([\s\S]*?eportal/);
  assert.match(bridge, /if \(session\.forceLogin\) \{[\s\S]*?PUBLIC_APP_USER_SSO_TOKEN/);
  assert.match(bridge, /if \(!session\.forceLogin && await loginComplete\(page\)\)/);
  assert.match(bridge, /!force &&[\s\S]*?active &&[\s\S]*?!active\.complete/);
  assert.match(server, /force: body\.force === true/);
  assert.match(frontend, /body: JSON\.stringify\(\{ force: forceLogin \}\)/);
  assert.match(frontend, /location\.replace\(next\)/);
});
