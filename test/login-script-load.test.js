import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const watchdogSource = await readFile(
  new URL("../public/login-script-watchdog.js", import.meta.url),
  "utf8",
);

function runWatchdog() {
  const events = new Map();
  const timers = [];
  let reloads = 0;
  const elements = new Map();
  for (const id of [
    "statusTitle", "statusDot", "pageCard",
    "errorCard", "errorMessage", "retryButton",
  ]) {
    const classes = new Set(id === "errorCard" ? ["hidden"] : []);
    const actions = new Map();
    elements.set(id, {
      dataset: {},
      style: {},
      textContent: "",
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      addEventListener: (name, handler) => actions.set(name, handler),
      trigger: (name) => actions.get(name)?.(),
    });
  }

  const window = {
    setTimeout(fn, delay) { timers.push({ fn, delay }); },
    addEventListener(name, cb) { events.set(name, cb); },
    location: { reload() { reloads += 1; } },
  };
  const document = {
    getElementById(id) { return elements.get(id) || null; },
  };

  vm.runInNewContext(watchdogSource, { window, document });
  return {
    window,
    elements,
    timers,
    triggerError(filename) {
      events.get("error")({ filename, target: { src: filename } });
    },
    tick() { timers.forEach(({ fn }) => fn()); },
    reloads: () => reloads,
  };
}

test("blocked Cloudflare analytics scripts do not trigger login errors", () => {
  const page = runWatchdog();
  page.triggerError("https://static.cloudflareinsights.com/beacon.min.js");
  assert.equal(page.elements.get("errorCard").classList.contains("hidden"), true);
});

test("missing login script shows a visible retryable error", () => {
  const page = runWatchdog();
  page.triggerError("https://portal.example/server-login.js?v=15");
  assert.equal(page.elements.get("errorCard").classList.contains("hidden"), false);
  assert.equal(page.elements.get("statusTitle").textContent, "登入介面無法啟動");
  assert.match(page.elements.get("errorMessage").textContent, /server-login\.js/);
  page.elements.get("retryButton").trigger("click");
  assert.equal(page.reloads(), 1);
});

test("startup watchdog reports stalled controller, but does not interrupt a started controller", () => {
  const stalled = runWatchdog();
  assert.equal(stalled.timers[0].delay, 10_000);
  stalled.tick();
  assert.equal(stalled.elements.get("errorCard").classList.contains("hidden"), false);

  const booted = runWatchdog();
  booted.window.__nutcLoginBridgeBooted = true;
  booted.tick();
  assert.equal(booted.elements.get("errorCard").classList.contains("hidden"), true);
});

test("login controller is a standalone script, not a module import chain", async () => {
  const frontend = await readFile(new URL("../public/server-login.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/server-login.html", import.meta.url), "utf8");
  assert.doesNotMatch(frontend, /^import\s/m);
  assert.match(frontend, /window\.__nutcLoginBridgeBooted = true/);
  assert.match(frontend, /function loginRequestOptions\(search = ""\)/);
  assert.match(html, /src="\/login-script-watchdog\.js\?v=1"/);
  assert.match(html, /src="\/server-login\.js\?v=15"/);
  assert.doesNotMatch(html, /server-login\.js[^"]*"\s+type="module"/);
});
