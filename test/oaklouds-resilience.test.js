import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  gotoEportalWithRetry,
  readEportalUpstreamFailure,
} from "../src/portal-session.js";

test("gotoEportalWithRetry retries transient OAKlouds errors and succeeds on recovery", async () => {
  let attempts = 0;
  const page = {
    url: () => "https://eportal.nutc.edu.tw/nutc_dashboard/",
    goto: async () => {
      attempts += 1;
      return { status: () => 200 };
    },
    waitForTimeout: async () => {},
    evaluate: async () =>
      attempts < 3 ? 'checkLicense("OAKlouds") is failed!' : "學生管理系統",
  };

  const result = await gotoEportalWithRetry(
    page,
    "https://eportal.nutc.edu.tw/nutc_dashboard/",
  );
  assert.equal(attempts, 3);
  assert.equal(result.status, 200);
  assert.equal(result.failure, null);
});

test("gotoEportalWithRetry stops after bounded attempts on persistent OAKlouds failure", async () => {
  let attempts = 0;
  const page = {
    url: () => "https://eportal.nutc.edu.tw/login.php",
    goto: async () => {
      attempts += 1;
      return { status: () => 200 };
    },
    waitForTimeout: async () => {},
    evaluate: async () => 'checkLicense("OAKlouds") is failed!',
  };

  const result = await gotoEportalWithRetry(
    page,
    "https://eportal.nutc.edu.tw/nutc_dashboard/",
  );
  assert.equal(attempts, 5);
  assert.equal(result.failure?.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
  assert.equal(result.failure?.retryable, true);
});

test("gotoEportalWithRetry does not retry non-retryable upstream errors", async () => {
  let attempts = 0;
  const page = {
    url: () => "https://eportal.nutc.edu.tw/nutc_dashboard/",
    goto: async () => {
      attempts += 1;
      return { status: () => 503 };
    },
    waitForTimeout: async () => {},
    evaluate: async () => "Service Unavailable",
  };

  const result = await gotoEportalWithRetry(
    page,
    "https://eportal.nutc.edu.tw/nutc_dashboard/",
  );
  assert.equal(attempts, 1);
  assert.equal(result.failure?.code, "EPORTAL_UPSTREAM_UNAVAILABLE");
  assert.notEqual(result.failure?.retryable, true);
});

test("readEportalUpstreamFailure ignores non-eportal 200 pages", async () => {
  let evaluated = false;
  const page = {
    url: () => "https://ais.nutc.edu.tw/student/home.aspx",
    evaluate: async () => {
      evaluated = true;
      return 'checkLicense("OAKlouds") is failed!';
    },
  };

  const result = await readEportalUpstreamFailure(page, 200);
  assert.equal(result, null);
  assert.equal(evaluated, false);
});

test("portal-session checks upstream failures instead of misreporting needs-login", async () => {
  const source = await readFile(
    new URL("../src/portal-session.js", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /import \{ classifyEportalLoginFailure \} from "\.\/eportal-login-page\.js"/,
  );
  assert.match(
    source,
    /async function inspectServerPortalSession[\s\S]*?gotoEportalWithRetry\([\s\S]*?if \(failure\) \{\s*return \{[\s\S]*?status: "error"[\s\S]*?needsLogin: false/,
  );
  assert.match(
    source,
    /async function inspectServerPortalSession[\s\S]*?postWaitFailure = await readEportalUpstreamFailure[\s\S]*?needsLogin: false/,
  );
  assert.match(
    source,
    /export async function openAisWithServerSession[\s\S]*?createUpstreamUnavailableError/,
  );
  assert.match(
    source,
    /export async function createModuleHandoff[\s\S]*?createUpstreamUnavailableError/,
  );
  assert.match(
    source,
    /error\.statusCode = 503/,
  );
});

test("launch UI distinguishes upstream ePortal outages from missing credentials", async () => {
  const launch = await readFile(
    new URL("../public/launch.js", import.meta.url),
    "utf8",
  );
  assert.match(launch, /if \(code === "EPORTAL_UPSTREAM_UNAVAILABLE"\)/);
});
