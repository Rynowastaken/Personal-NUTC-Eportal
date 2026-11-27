import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearSavedPortalSessionCookies,
  extractPersistableSessionCookies,
  restorePortalSessionCookies,
  savePortalSessionCookies,
} from "../src/portal-session-cookies.js";
import {
  getPortalKeepaliveState,
  startPortalKeepalive,
  stopPortalKeepalive,
} from "../src/portal-session.js";

test("extractPersistableSessionCookies keeps NUTC session cookies and drops CSRF, persistent, and external cookies", () => {
  const cookies = [
    {
      name: "OAKS_SESS1",
      value: "sess-1",
      domain: "eportal.nutc.edu.tw",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "ASP.NET_SessionId",
      value: "ais-1",
      domain: "ais.nutc.edu.tw",
      path: "/",
      expires: 0,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "TS01b05e85",
      value: "f5-waf",
      domain: ".eportal.nutc.edu.tw",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "None",
    },
    {
      name: "oak_cookie",
      value: "oak-1",
      domain: ".oaklouds.com",
      path: "/",
      expires: -1,
    },
    {
      name: "APP_USER_LOGIN_AUTH_PAGE",
      value: "persistent-auth",
      domain: "eportal.nutc.edu.tw",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
    {
      name: "oaksloginWebCsrfSid",
      value: "csrf-1",
      domain: "eportal.nutc.edu.tw",
      path: "/",
      expires: -1,
    },
    {
      name: "loginbulletinWebCsrfSid",
      value: "csrf-2",
      domain: "eportal.nutc.edu.tw",
      path: "/",
      expires: -1,
    },
    {
      name: "SID",
      value: "evil-val",
      domain: "evil.example",
      path: "/",
      expires: -1,
    },
  ];

  const extracted = extractPersistableSessionCookies(cookies);
  assert.deepEqual(
    extracted.map((c) => [c.name, c.domain, c.expires]),
    [
      ["OAKS_SESS1", "eportal.nutc.edu.tw", -1],
      ["ASP.NET_SessionId", "ais.nutc.edu.tw", -1],
      ["TS01b05e85", ".eportal.nutc.edu.tw", -1],
      ["oak_cookie", ".oaklouds.com", -1],
    ],
  );
});

test("save, restore, empty-save preservation, and clear of portal session cookies", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nutc-cookies-test-"));
  const filePath = path.join(dir, "eportal-session-cookies.json");

  try {
    const context = {
      async cookies() {
        return [
          {
            name: "OAKS_SESS1",
            value: "live-sess",
            domain: "eportal.nutc.edu.tw",
            path: "/",
            expires: -1,
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
          },
          {
            name: "ASP.NET_SessionId",
            value: "live-ais",
            domain: "ais.nutc.edu.tw",
            path: "/",
            expires: -1,
            httpOnly: true,
          },
        ];
      },
    };

    const count = await savePortalSessionCookies(context, { filePath });
    assert.equal(count, 2);

    const stat = await fs.stat(filePath);
    assert.equal(stat.mode & 0o777, 0o600);

    // Empty cookie list must not clobber existing saved session cookies.
    const emptyCount = await savePortalSessionCookies(
      { async cookies() { return []; } },
      { filePath },
    );
    assert.equal(emptyCount, 0);

    const added = [];
    const restoreCtx = {
      async cookies() {
        return [
          {
            name: "OAKS_SESS1",
            value: "already-in-context",
            domain: "eportal.nutc.edu.tw",
            path: "/",
          },
        ];
      },
      async addCookies(items) {
        added.push(...items);
      },
    };

    const restoredCount = await restorePortalSessionCookies(restoreCtx, {
      filePath,
    });
    assert.equal(restoredCount, 1);
    assert.equal(added.length, 1);
    assert.equal(added[0].name, "ASP.NET_SessionId");
    assert.equal(added[0].value, "live-ais");

    await clearSavedPortalSessionCookies({ filePath });
    await assert.rejects(() => fs.stat(filePath), { code: "ENOENT" });
    assert.equal(await restorePortalSessionCookies(restoreCtx, { filePath }), 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("startPortalKeepalive retries quickly after busy and error states and stopPortalKeepalive clears timers", async () => {
  const outcomes = [
    { status: "busy", valid: false },
    () => {
      throw new Error("transient failure");
    },
    { status: "valid", valid: true, checkedAt: "2026-11-24T00:00:00.000Z" },
  ];
  let calls = 0;

  try {
    startPortalKeepalive({
      intervalMinutes: 10,
      initialDelayMs: 10,
      retryDelayMs: 25,
      async checkStatus() {
        const next = outcomes[Math.min(calls, outcomes.length - 1)];
        calls += 1;
        return typeof next === "function" ? next() : next;
      },
    });

    const deadline = Date.now() + 2_000;
    while (calls < 3 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    // Wait one tick after checkStatus resolves so state updates cleanly.
    await new Promise((resolve) => setTimeout(resolve, 15));

    const state = getPortalKeepaliveState();
    assert.equal(calls >= 3, true);
    assert.equal(state.lastStatus, "valid");
    assert.equal(state.lastSuccessAt, "2026-11-24T00:00:00.000Z");
    assert.equal(state.lastError, null);
  } finally {
    stopPortalKeepalive();
    assert.equal(getPortalKeepaliveState().enabled, false);
  }
});

test("portal-session and login-bridge wire session cookie save, restore, and clear hooks", async () => {
  const portalSessionSrc = await fs.readFile(
    new URL("../src/portal-session.js", import.meta.url),
    "utf8",
  );
  const loginBridgeSrc = await fs.readFile(
    new URL("../src/login-bridge.js", import.meta.url),
    "utf8",
  );

  assert.match(portalSessionSrc, /restorePortalSessionCookies\(context\)/);
  assert.match(portalSessionSrc, /savePortalSessionCookies\(context\)/);
  assert.match(portalSessionSrc, /clearSavedPortalSessionCookies\(\)/);

  assert.match(loginBridgeSrc, /savePortalSessionCookies\(active\.browser\.context\)/);
  assert.match(loginBridgeSrc, /savePortalSessionCookies\(session\.browser\.context\)/);
  assert.match(loginBridgeSrc, /clearSavedPortalSessionCookies\(\)/);
});

test("startPortalKeepalive runs onTick callback cleanly even if onTick rejects", async () => {
  const seen = [];
  try {
    startPortalKeepalive({
      intervalMinutes: 10,
      initialDelayMs: 5,
      retryDelayMs: 50,
      async checkStatus() {
        return { status: "valid", valid: true, checkedAt: "2026-11-27T00:00:00.000Z" };
      },
      async onTick(status) {
        seen.push(status.valid);
        throw new Error("downstream tick error");
      },
    });

    const deadline = Date.now() + 1_000;
    while (seen.length < 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    await new Promise((resolve) => setTimeout(resolve, 15));

    assert.deepEqual(seen, [true]);
    assert.equal(getPortalKeepaliveState().lastStatus, "valid");
  } finally {
    stopPortalKeepalive();
  }
});
