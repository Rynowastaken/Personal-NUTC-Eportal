import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describeLoginBridgeError } from "../src/login-bridge-error.js";

const startError = (message) => ({ code: "EPORTAL_LOGIN_BRIDGE_START_FAILED", message });

test("missing Chromium gives actionable guidance and stable error code", () => {
  const result = describeLoginBridgeError(startError(
    "browserType.launch: Executable doesn't exist at /home/private/browser/chrome"
  ));
  assert.equal(result.status, 503);
  assert.equal(result.code, "EPORTAL_BROWSER_NOT_INSTALLED");
  assert.match(result.message, /npx playwright install chromium/);
  assert.doesNotMatch(result.message, /\/home\/private/);
});

test("missing system libraries get a separate safe diagnosis", () => {
  const result = describeLoginBridgeError(startError(
    "Host system is missing dependencies to run browsers: libnss3.so"
  ));
  assert.equal(result.code, "EPORTAL_BROWSER_DEPENDENCIES_MISSING");
  assert.match(result.message, /install-deps chromium/);
  assert.doesNotMatch(result.message, /libnss3.so/);
});

test("navigation failures and unknown startup exceptions never reveal raw detail", () => {
  const navigation = describeLoginBridgeError(startError(
    "page.goto: net::ERR_CONNECTION_REFUSED at https://eportal.nutc.edu.tw/?secret=hidden"
  ));
  assert.equal(navigation.status, 503);
  assert.match(navigation.message, /連線/);
  assert.doesNotMatch(navigation.message, /secret|hidden/);

  const unknown = describeLoginBridgeError(startError(
    "sensitive@email.test - unexpected failure at /home/ryno/.eportal-profile"
  ));
  assert.equal(unknown.code, "EPORTAL_LOGIN_BRIDGE_START_FAILED");
  assert.match(unknown.message, /\[login-bridge\]/);
  assert.doesNotMatch(unknown.message, /sensitive|email|\/home/);
});

test("unknown action failures use a safe diagnostic code", () => {
  const error = describeLoginBridgeError(new Error("Submitted secret 1234"));
  assert.equal(error.status, 500);
  assert.equal(error.code, "EPORTAL_LOGIN_BRIDGE_FAILED");
  assert.doesNotMatch(error.message, /secret|1234/);
});

test("server handles bridge errors without leaking raw errors to browser", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(source, /import \{ describeLoginBridgeError \} from "\.\/src\/login-bridge-error\.js";/);
  assert.match(source, /const diagnostic = describeLoginBridgeError\(error\)/);
  assert.match(source, /sendError\(res, diagnostic\.status, diagnostic\.message, diagnostic\.code\)/);
});

test("login page renders diagnostic code and preserves server guidance", async () => {
  const frontend = await readFile(new URL("../public/server-login.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/server-login.html", import.meta.url), "utf8");
  assert.match(frontend, /errorCode\.textContent = code \? `錯誤代碼：\$\{code\}` : ""/);
  assert.match(frontend, /error\.code = state\.code \|\| ""/);
  assert.match(html, /id="errorCode"/);
});
