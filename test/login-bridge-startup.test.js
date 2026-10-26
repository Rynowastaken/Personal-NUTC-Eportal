import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { classifyEportalLoginFailure } from "../src/eportal-login-page.js";
import { readFile } from "node:fs/promises";

const bridgeSource = await readFile(
  new URL("../src/login-bridge.js", import.meta.url),
  "utf8",
);

function makeLoginBridge(openLoginBridgeSession) {
  // Exercise the real bridge state machine with a mocked browser instead of
  // hitting the university's production login service during a unit test.
  const source = bridgeSource
    .replace(/^import[\s\S]*?;\s*$/gm, "")
    .replace(/\bexport (?=async function|function|const)/g, "");
  return new Function(
    "crypto", "openLoginBridgeSession", "EPORTAL_DASHBOARD",
    "EPORTAL_HOME", "EPORTAL_LOGIN", "STUDENT_BUTTON_SELECTOR",
    "classifyEportalLoginFailure",
    source + "return { startLoginBridge, getLoginBridgeState, stopLoginBridge };",
  )(
    crypto, openLoginBridgeSession,
    "https://eportal.nutc.edu.tw/nutc_dashboard/",
    "https://eportal.nutc.edu.tw/",
    "https://eportal.nutc.edu.tw/login.php",
    'button[onclick*="NUTC_6401"]',
    classifyEportalLoginFailure,
  );
}

function tokenFromLaunchPath(launchPath) {
  const marker = "#token=";
  const index = launchPath.indexOf(marker);
  assert.ok(index >= 0);
  return decodeURIComponent(launchPath.slice(index + marker.length));
}

test("Login Bridge responds before Chromium/profile lock becomes available", async () => {
  let resolveBrowser;
  const pending = new Promise((resolve) => { resolveBrowser = resolve; });
  const bridge = makeLoginBridge(() => pending);

  const started = await Promise.race([
    bridge.startLoginBridge({ force: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("start blocked")), 1000)),
  ]);
  assert.equal(started.phase, "waiting-profile");
  const token = tokenFromLaunchPath(started.launchPath);
  const progress = await bridge.getLoginBridgeState(token);
  assert.equal(progress.active, true);
  assert.equal(progress.phase, "waiting-profile");

  // Cancel during a queued startup and verify the late browser is closed,
  // not resurrected as an unauthorized new login.
  await bridge.stopLoginBridge(token);
  let closed = 0;
  resolveBrowser({
    page: {},
    close: async () => { closed += 1; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, 1);
  await assert.rejects(bridge.getLoginBridgeState(token), /Invalid or expired/);
});

test("Browser profile startup failures are reported instead of leaving spinner running", async () => {
  const busy = new Error("Profile lock busy");
  busy.code = "EPORTAL_PROFILE_BUSY";
  const bridge = makeLoginBridge(async () => { throw busy; });

  const started = await bridge.startLoginBridge({ force: true });
  assert.equal(started.phase, "waiting-profile");
  const token = tokenFromLaunchPath(started.launchPath);
  await assert.rejects(
    bridge.getLoginBridgeState(token),
    /Server ePortal is busy/,
  );
});

test("Login UI initializes bridge without waiting for theme image extraction", async () => {
  const js = await readFile(new URL("../public/server-login.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/server-login.html", import.meta.url), "utf8");
  assert.doesNotMatch(js, /await window\.NutcTheme\.init\(\)/);
  assert.match(js, /void Promise\.resolve\(\)/);
  assert.match(js, /START_TIMEOUT_MS = 20_000/);
  assert.match(js, /PHASE_TIMEOUT_MS = 60_000/);
  assert.match(html, /id="retryButton"/);
  assert.match(html, /server-login\.js\?v=14/);
});

test("Profile queue has its own deadline, not only the file lock timeout", async () => {
  const js = await readFile(new URL("../src/portal-session.js", import.meta.url), "utf8");
  assert.match(js, /await Promise\.race\(\[\s*previous,/);
  assert.match(js, /queueTimer = setTimeout\(\(\) => reject\(profileBusyError\(\)\), timeoutMs\)/);
  assert.match(js, /const remaining = bounded \? timeoutMs - \(Date\.now\(\) - started\)/);
});

test("license error with HTTP 200 reports university outage, not missing inputs", async () => {
  let navigationCount = 0;
  let cleared = 0;
  let closed = 0;
  const page = {
    url: () => "https://eportal.nutc.edu.tw/login.php",
    goto: async () => {
      navigationCount++;
      return { status: () => 200 };
    },
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    locator: () => ({
      count: async () => 0,
      first: () => ({ waitFor: async () => {
        throw new Error("no login inputs");
      } }),
    }),
    evaluate: async () => 'checkLicense("OAKlouds") is failed!',
  };
  const browser = {
    page,
    context: { clearCookies: async () => { cleared++; } },
    close: async () => { closed++; },
  };
  const bridge = makeLoginBridge(async () => browser);
  const started = await bridge.startLoginBridge({ force: true });
  const token = tokenFromLaunchPath(started.launchPath);

  // Async initialization has a bounded number of microtasks in this mock.
  for (let i = 0; i < 16; i++) await Promise.resolve();
  await assert.rejects(
    bridge.getLoginBridgeState(token),
    (error) => {
      assert.equal(error.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
      assert.match(error.message, /OAKlouds/);
      assert.doesNotMatch(error.message, /login controls were not found/);
      return true;
    },
  );
  assert.equal(navigationCount, 1, "known upstream errors should not trigger another login navigation");
  assert.equal(cleared, 1, "forced login retains existing explicit-cookie handling");
  assert.equal(closed, 1, "failed login browser should be closed");
});
