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

test("Reconnect AIS requires fresh login then returns to AIS SSO", async () => {
  assert.deepEqual(loginRequestOptions("?force=1&next=%2Fgo%2Fais"), {
    force: true,
    next: "/go/ais",
  });
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /href="\/server-login\/\?force=1&amp;next=%2Fgo%2Fais"/);
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

test("forced login bypasses saved-session auto completion and clears only ePortal cookies", async () => {
  const bridge = await readFile(new URL("../src/login-bridge.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const frontend = await readFile(new URL("../public/server-login.js", import.meta.url), "utf8");
  assert.match(bridge, /if \(session\.forceLogin\) \{[\s\S]*?clearCookies\([\s\S]*?eportal/);
  assert.match(bridge, /if \(!session\.forceLogin && await loginComplete\(page\)\)/);
  assert.match(bridge, /!force &&[\s\S]*?active &&[\s\S]*?!active\.complete/);
  assert.match(server, /force: body\.force === true/);
  assert.match(frontend, /body: JSON\.stringify\(\{ force: forceLogin \}\)/);
  assert.match(frontend, /location\.replace\(next\)/);
});
