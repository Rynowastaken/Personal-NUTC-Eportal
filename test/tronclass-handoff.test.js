import test from "node:test";
import assert from "node:assert/strict";
import { applyTronclassLanding } from "../src/tronclass-handoff.js";

const ticketUrl =
  "https://tc.nutc.edu.tw/login?next=%2F&ticket=ST-123-abc&locale=zh_TW";

test("a TronClass handoff lands on the requested page instead of the home page", () => {
  const handoff = applyTronclassLanding(
    { type: "get", url: ticketUrl },
    "https://tc.nutc.edu.tw/course/7/learning-activity#/exam/3",
  );
  const url = new URL(handoff.url);
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("next"), "/course/7/learning-activity");
  assert.equal(url.searchParams.get("ticket"), "ST-123-abc");
  assert.equal(url.searchParams.get("locale"), "zh_TW");
  assert.equal(url.hash, "#/exam/3");
});

test("only TronClass ticket handoffs are rewritten", () => {
  const other = { type: "get", url: "https://webmail.nutc.edu.tw/cgi-bin/login.sso?token=abc" };
  assert.equal(
    applyTronclassLanding(other, "https://tc.nutc.edu.tw/course/7").url,
    other.url,
  );

  const post = { type: "post", url: ticketUrl, fields: [["a", "b"]] };
  assert.equal(
    applyTronclassLanding(post, "https://tc.nutc.edu.tw/course/7").url,
    ticketUrl,
  );

  const notLogin = { type: "get", url: "https://tc.nutc.edu.tw/user/index?x=1" };
  assert.equal(
    applyTronclassLanding(notLogin, "https://tc.nutc.edu.tw/course/7").url,
    notLogin.url,
  );
});

test("targets outside TronClass are ignored", () => {
  const handoff = { type: "get", url: ticketUrl };
  for (const target of [
    "https://evil.example/course/7",
    "http://tc.nutc.edu.tw/course/7",
    "/course/7",
    "",
    "not a url",
  ]) {
    assert.equal(applyTronclassLanding(handoff, target).url, ticketUrl, target);
  }
});
