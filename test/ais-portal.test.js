import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the AIS tile opens the portal's rebuilt student hub and keeps /go/ais as the fallback", async () => {
  const server = await read("../server.js");
  const page = await read("../public/ais.js");
  assert.match(server, /url\.pathname === "\/ais" \|\| url\.pathname\.startsWith\("\/ais\/"\)/);
  assert.match(server, /serveStatic\(req, res, "\/ais\.html"\)/);
  assert.match(page, /const BASE = "\/ais"/);
  assert.match(page, /href: "\/go\/ais"/);
});

test("the AIS API is served by the portal, not by the school directly", async () => {
  const server = await read("../server.js");
  assert.match(server, /url\.pathname === "\/api\/ais\/overview"/);
  assert.match(server, /url\.pathname === "\/api\/ais\/announcements"/);
  assert.match(server, /\/api\\\/ais\\\/announcements\\\/\(\\d\+\)/);
  assert.match(server, /await getAisOverview\(\{ force \}\)/);
  assert.match(server, /await getAisAnnouncements\(\{ page, force \}\)/);
  assert.match(server, /await getAisAnnouncement\(Number\(aisAnnouncementMatch\[1\]\), \{ force \}\)/);
});

test("one AIS session feeds the overview and the schedule/absence readers are reused", async () => {
  const portal = await read("../src/ais-portal.js");
  assert.match(portal, /openAisWithServerSession\(/);
  assert.match(portal, /import \{ AIS_SCHEDULE_URL, readSchedule \} from "\.\/class-schedule\.js"/);
  assert.match(portal, /import \{ AIS_ABSENCE_URL, readAbsences \} from "\.\/absence-list\.js"/);
  // The overview navigates every page inside a single acquisition of the
  // serialized server profile.
  assert.equal((portal.match(/openAisWithServerSession\(/g) || []).length, 3);
  assert.match(portal, /readSchedule\(page\)/);
  assert.match(portal, /readAbsences\(page\)/);
});

test("AIS reads the grades, progress, profile and announcement pages it renders", async () => {
  const portal = await read("../src/ais-portal.js");
  assert.match(portal, /my_hist_grade\.aspx/);
  assert.match(portal, /progress_view\.aspx/);
  assert.match(portal, /stu_info\.aspx/);
  assert.match(portal, /bulletin_view\.aspx/);
  assert.match(portal, /readAisAnnouncementList/);
  assert.match(portal, /tr\.tr_data/);
  assert.match(portal, /課程標準/);
});

test("the AIS overview never returns the student's full national ID", async () => {
  const portal = await read("../src/ais-portal.js");
  assert.match(portal, /function maskNationalId/);
  assert.match(portal, /nationalId: undefined/);
  assert.match(portal, /nationalIdMasked: maskNationalId\(profile\.nationalId\)/);
  // The raw value must not be put back into the public response.
  assert.doesNotMatch(portal, /nationalIdMasked: profile\.nationalId/);
});

test("the AIS page follows the dashboard theme and sanitizes announcement HTML", async () => {
  const page = await read("../public/ais.js");
  const html = await read("../public/ais.html");
  const css = await read("../public/ais.css");
  assert.match(html, /<script src="\/theme-defaults\.js\?v=\d+"><\/script>/);
  assert.match(html, /<script src="\/theme\.js\?v=\d+"><\/script>\s*<script src="\/ais\.js"><\/script>/);
  assert.doesNotMatch(html, /portalBackdrop/);
  assert.match(page, /window\.NutcTheme\?\.init\?\.\(\)/);
  assert.doesNotMatch(css, /--primary: #/);
  assert.match(page, /function richText\(html\)/);
  assert.match(page, /querySelectorAll\("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select"\)/);
  assert.match(page, /name\.startsWith\("on"\)/);
  assert.match(page, /rel", "noopener noreferrer"/);
});

test("the rebuilt AIS pages cover the student tasks the old system scattered", async () => {
  const page = await read("../public/ais.js");
  for (const route of ["schedule", "grades", "absences", "announcements", "profile", "services"]) {
    assert.match(page, new RegExp(`${route}: view`));
  }
  assert.match(page, /今天的課/);
  assert.match(page, /function todayBlocks/);
  assert.match(page, /blockLabel\(item\)/);
  assert.match(page, /共 \$\{periods\.length\} 節/);
  assert.match(page, /本學期累計/);
  assert.match(page, /畢業學分/);
  assert.match(page, /修業進度/);
  assert.match(page, /課程標準/);
  assert.match(page, /缺曠紀錄/);
  assert.match(page, /在 AIS 開啟/);
  // A service card first authenticates this browser through the portal's
  // ePortal handoff, then sends the authenticated tab to the chosen AIS page.
  assert.match(page, /function openAisService/);
  assert.match(page, /target: "ais-service"/);
  assert.match(page, /window\.open\("", "ais-service"\)/);
  assert.match(page, /popup\.location\.replace\(target\)/);
  assert.match(page, /首次開啟會先完成 ePortal 登入/);
});
