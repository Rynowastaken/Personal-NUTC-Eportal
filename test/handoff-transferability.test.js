import test from "node:test";
import assert from "node:assert/strict";
import {
  isSsoLoginEndpoint,
  isStatelessPublicHttpsLanding,
  isTrustedLegacyHttpTarget,
  looksSelfContainedGetHandoff,
} from "../src/portal-session.js";

test("the school's SSO login pages are recognized as server-side hops", () => {
  assert.equal(
    isSsoLoginEndpoint(new URL("https://sso.nutc.edu.tw/ePortal/Default.aspx?ReturnUrl=%2F")),
    true,
  );
  assert.equal(
    isSsoLoginEndpoint(new URL("https://identity.nutc.edu.tw/auth/realms/nutc/protocol/cas/login?service=x")),
    true,
  );
  assert.equal(
    isSsoLoginEndpoint(new URL("https://tc.nutc.edu.tw/login?redirect=%2Fcourse%2F1")),
    true,
  );
  assert.equal(
    isSsoLoginEndpoint(new URL("https://tc.nutc.edu.tw/course/1/learning-activity")),
    false,
  );
  // WebMail's login.sso URL carries a bearer token despite the name; it must
  // keep being handed to the browser untouched.
  assert.equal(
    isSsoLoginEndpoint(new URL("https://webmail.nutc.edu.tw/cgi-bin/login.sso?token=abc")),
    false,
  );
  assert.equal(
    isSsoLoginEndpoint(new URL("http://sso.nutc.edu.tw/ePortal/Default.aspx")),
    false,
  );
});

test("SSO login pages are walked server-side, tickets are handed to the browser", () => {
  // A login page with query parameters looks self-contained but only
  // authenticates a browser that already holds the school's session.
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://sso.nutc.edu.tw/ePortal/Default.aspx?ReturnUrl=%2F")),
    false,
  );
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://identity.nutc.edu.tw/auth/realms/nutc/protocol/cas/login?service=x")),
    false,
  );
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://tc.nutc.edu.tw/login?redirect=%2Fcourse%2F1")),
    false,
  );

  // The redirect CAS adds after the server-side login is the transferable
  // handoff, whatever its path, and must never be followed again.
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://tc.nutc.edu.tw/login?service=x&ticket=ST-123-abc")),
    true,
  );
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://tc.nutc.edu.tw/course/1?Ticket=ST-9")),
    true,
  );

  // Bearer URLs keep their existing treatment.
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://webmail.nutc.edu.tw/cgi-bin/login.sso?token=abc")),
    true,
  );
  assert.equal(
    looksSelfContainedGetHandoff(new URL("https://tc.nutc.edu.tw/sso/9f8e7d6c5b4a3210fedcba9876543210")),
    true,
  );
});

test("server-side legacy HTTP hop allowlist covers campus hosts for ext_module only", () => {
  const extMod = {
    id: "library",
    path: "/ext_module/ext_set_param.php?mod_id=abc",
  };
  const aisMod = { id: "ais", path: "/?app_id=NUTC_6401" };

  assert.equal(isTrustedLegacyHttpTarget(extMod, "http://163.17.131.143/login"), true);
  assert.equal(isTrustedLegacyHttpTarget(extMod, "http://163.17.1.2/sso"), true);
  assert.equal(isTrustedLegacyHttpTarget(extMod, "http://lib.nutc.edu.tw/auth"), true);
  assert.equal(isTrustedLegacyHttpTarget(extMod, "http://example.com/auth"), false);
  assert.equal(isTrustedLegacyHttpTarget(extMod, "http://10.0.0.1/auth"), false);
  assert.equal(isTrustedLegacyHttpTarget(extMod, "http://163.17.999.1/auth"), false);
  assert.equal(isTrustedLegacyHttpTarget(extMod, "https://lib.nutc.edu.tw/auth"), false);
  assert.equal(isTrustedLegacyHttpTarget(aisMod, "http://163.17.1.2/sso"), false);
});

test("stateless public HTTPS landings succeed only when no session cookies or login pages are involved", () => {
  assert.equal(
    isStatelessPublicHttpsLanding({
      url: "https://example.nutc.edu.tw/app-download",
      status: 200,
      targetCookiesAdded: false,
      moduleId: "tronclass-app",
    }),
    true,
  );
  assert.equal(
    isStatelessPublicHttpsLanding({
      url: "https://vote.nutc.edu.tw/home",
      status: 200,
      targetCookiesAdded: true,
      moduleId: "library",
    }),
    false,
  );
  assert.equal(
    isStatelessPublicHttpsLanding({
      url: "https://vote.nutc.edu.tw/home",
      status: 200,
      targetCookiesAdded: false,
      moduleId: "activity",
    }),
    false,
  );
  assert.equal(
    isStatelessPublicHttpsLanding({
      url: "https://sso.nutc.edu.tw/ePortal/Default.aspx",
      status: 200,
      targetCookiesAdded: false,
      moduleId: "library",
    }),
    false,
  );
  assert.equal(
    isStatelessPublicHttpsLanding({
      url: "https://lib.nutc.edu.tw/login.aspx",
      status: 200,
      targetCookiesAdded: false,
      moduleId: "library",
    }),
    false,
  );
});
