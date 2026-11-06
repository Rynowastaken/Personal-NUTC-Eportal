import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicModules } from "../src/eportal.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the dashboard's TronClass tile opens the portal's own TronClass pages", () => {
  const tronclass = publicModules().find((module) => module.id === "tronclass");
  assert.equal(tronclass.launchPath, "/tronclass");
  assert.equal(publicModules().find((module) => module.id === "ais").launchPath, "/go/ais");
});

test("the server serves /tronclass and relays only GET and POST to TronClass", async () => {
  const server = await read("../server.js");
  const relay = await read("../src/tronclass.js");
  assert.match(server, /url\.pathname === "\/tronclass" \|\| url\.pathname\.startsWith\("\/tronclass\/"\)/);
  assert.match(server, /serveStatic\(req, res, "\/tronclass\.html", \{ csp: TRONCLASS_CSP \}\)/);
  assert.match(relay, /\["GET", "POST"\]\.includes\(req\.method\)/);
  assert.match(relay, /TRONCLASS_ORIGIN = "https:\/\/tc\.nutc\.edu\.tw"/);
});

test("the TronClass sign-in only follows the school's HTTPS hosts and is stored outside Git", async () => {
  const relay = await read("../src/tronclass.js");
  const gitignore = await read("../.gitignore");
  assert.match(relay, /url\.protocol === "https:"/);
  assert.match(relay, /url\.hostname\.endsWith\("\.nutc\.edu\.tw"\)/);
  assert.match(relay, /path\.join\(ROOT, "data", "tronclass-session\.json"\)/);
  assert.match(gitignore, /^data\/$/m);
});

test("signing out of the portal also drops the TronClass session", async () => {
  const server = await read("../server.js");
  assert.match(server, /\/api\/portal-logout"[\s\S]*?await clearTronclassSession\(\);/);
});

test("the TronClass pages never show the student's name and send exams to TronClass itself", async () => {
  const page = await read("../public/tronclass.js");
  assert.doesNotMatch(page, /user\.name/);
  assert.match(page, /const TRONCLASS = "https:\/\/tc\.nutc\.edu\.tw"/);
  assert.match(page, /canStart \? h\("a", \{ class: "btn primary", href: classicHref\(\), "data-classic": "" \}/);
});

test("the TronClass pages use the dashboard's colours but not its background image", async () => {
  const html = await read("../public/tronclass.html");
  const page = await read("../public/tronclass.js");
  assert.match(html, /<script src="\/theme-defaults\.js\?v=\d+"><\/script>/);
  assert.match(html, /<script src="\/theme\.js\?v=\d+"><\/script>\s*<script src="\/tronclass\.js">/);
  assert.doesNotMatch(html, /portalBackdrop/);
  assert.match(page, /window\.NutcTheme\?\.init\?\.\(\)/);
  // The theme's inline variables must not be shadowed by fixed page colours.
  assert.doesNotMatch(page, /--primary: #/);
  assert.doesNotMatch(page, /rgba\(240,\s*168,\s*200/);
});
