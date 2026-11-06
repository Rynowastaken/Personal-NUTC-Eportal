import test from "node:test";
import assert from "node:assert/strict";
import {
  isSsoLoginEndpoint,
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
