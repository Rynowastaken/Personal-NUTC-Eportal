import test from "node:test";
import assert from "node:assert/strict";
import { isAisLoginExpiredMessage, watchAisLoginExpiry } from "../src/ais-auth.js";
import { needsInteractiveLogin, isSessionExpiredError, shouldAutoOpenLogin } from "../public/session-auth.js";

test("AIS login-expiry dialog is recognized while unrelated alerts are ignored", () => {
  assert.equal(isAisLoginExpiredMessage("驗證失敗!\n連線可能逾期，請重新登入 ePortal。"), true);
  assert.equal(isAisLoginExpiredMessage("連線可能逾期，請重新登入 ePortal。"), true);
  assert.equal(isAisLoginExpiredMessage("Your session expired. Please login again."), true);
  assert.equal(isAisLoginExpiredMessage("資料更新成功"), false);
  assert.equal(isAisLoginExpiredMessage("請稍後重試"), false);
  assert.equal(isAisLoginExpiredMessage(""), false);
});

test("expired AIS alert is dismissed and converted into login-required error", async () => {
  let onDialog;
  let dismissed = 0;
  const page = { on(type, callback) {
    assert.equal(type, "dialog");
    onDialog = callback;
  } };
  const watcher = watchAisLoginExpiry(page);
  await onDialog({
    message: () => "驗證失敗! 連線可能逾期，請重新登入 ePortal。",
    dismiss: async () => { dismissed += 1; },
  });
  assert.equal(dismissed, 1);
  assert.equal(watcher.expired(), true);
  assert.throws(() => watcher.assertValid(), {
    code: "EPORTAL_LOGIN_REQUIRED",
    statusCode: 401,
  });
});

test("non-auth AIS alerts are dismissed without marking session expired", async () => {
  let callback;
  const watcher = watchAisLoginExpiry({ on: (_, handler) => { callback = handler; } });
  await callback({ message: () => "查無資料", dismiss: async () => {} });
  assert.equal(watcher.expired(), false);
  assert.doesNotThrow(() => watcher.assertValid());
});

test("automatic login is reserved for confirmed expiry, never transient errors", () => {
  assert.equal(needsInteractiveLogin({ status: "needs-login", needsLogin: true }), true);
  assert.equal(needsInteractiveLogin({ status: "not-configured", needsLogin: true }), true);
  assert.equal(needsInteractiveLogin({ status: "valid", valid: true }), false);
  assert.equal(needsInteractiveLogin({ status: "busy", needsLogin: false }), false);
  assert.equal(needsInteractiveLogin({ status: "error", needsLogin: false }), false);
  assert.equal(needsInteractiveLogin({ status: "error", needsLogin: true }), false);
  assert.equal(needsInteractiveLogin(null), false);
});

test("AIS expiry is distinguishable from other network failures", () => {
  assert.equal(isSessionExpiredError({ code: "EPORTAL_LOGIN_REQUIRED", status: 401 }), true);
  assert.equal(isSessionExpiredError({ code: "AIS_SESSION_EXPIRED" }), true);
  assert.equal(isSessionExpiredError({ code: "CLASS_SCHEDULE_TIMEOUT", status: 504 }), false);
  assert.equal(isSessionExpiredError({ code: "EPORTAL_PROFILE_BUSY", status: 409 }), false);
  assert.equal(isSessionExpiredError({ status: 401 }), false);
});

test("automatic login redirects once, with a cooldown to avoid loops", () => {
  const expired = { status: "needs-login" };
  const now = Date.now();
  assert.equal(shouldAutoOpenLogin(expired, 0, now), true);
  assert.equal(shouldAutoOpenLogin(expired, now - 30_000, now), false);
  assert.equal(shouldAutoOpenLogin(expired, now - 120_000, now), true);
  assert.equal(shouldAutoOpenLogin({ status: "valid" }, 0, now), false);
  assert.equal(shouldAutoOpenLogin({ status: "busy" }, 0, now), false);
});
