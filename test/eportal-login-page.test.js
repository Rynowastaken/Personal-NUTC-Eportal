import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyEportalLoginFailure } from "../src/eportal-login-page.js";

test("ePortal licensing error is recognized even when HTML returns HTTP 200", () => {
  const error = classifyEportalLoginFailure({
    status: 200,
    text: 'checkLicense("OAKlouds") is failed!',
  });
  assert.equal(error?.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
  assert.match(error.message, /校方/);
  assert.match(error.message, /OAKlouds/);
});

test("upstream gateway errors and maintenance are distinguished from bad credentials", () => {
  for (const status of [500, 502, 503, 504, 521, 522, 523, 524]) {
    const value = classifyEportalLoginFailure({ status });
    assert.equal(value?.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
    assert.match(value.message, new RegExp(String(status)));
  }
  const maintenance = classifyEportalLoginFailure({ text: "系統維護中，暫停服務。" });
  assert.equal(maintenance?.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
});

test("normal login and unknown changed form remain unclassified", () => {
  assert.equal(classifyEportalLoginFailure({
    status: 200,
    text: "帳號密碼登入 請輸入帳號 請輸入密碼 請輸入驗證碼",
  }), null);
  assert.equal(classifyEportalLoginFailure({
    status: 200,
    text: "The university updated its login experience.",
  }), null);
  assert.equal(classifyEportalLoginFailure({ status: 403, text: "Forbidden" }), null);
});

test("page classification does not echo arbitrary upstream input", () => {
  const userData = "private-email@example.org";
  const value = classifyEportalLoginFailure({
    status: 503,
    text: "Service Unavailable " + userData,
  });
  assert.equal(value.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
  assert.doesNotMatch(value.message, /private-email/);
});

test("server maps university-side failures to HTTP 503", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server, /error\?\.code === "EPORTAL_UPSTREAM_UNAVAILABLE"[\s\S]*?sendError\(res, 503, error\.message, error\.code\)/);
});
