import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const [html, app, features, menus, css, workflow, pkg] = await Promise.all([
  read("demo/index.html"), read("demo/app.js"), read("demo/features.js"),
  read("demo/dropdowns.js"), read("demo/features.css"),
  read(".github/workflows/demo-pages.yml"), read("package.json"),
]);

test("public demo mirrors all non-authenticated dashboard feature sections", () => {
  for (const id of [
    "demoUsername", "demoAccountButton", "demoAccountDialog", "demoUsernameInput",
    "demoAvatarFile", "demoRemoveAvatar", "demoServerButton", "demoServerDialog",
    "demoUpdateServer", "demoRestartServer", "demoServerProgress",
    "demoColorSchemeOptions", "demoColorPreview", "demoColorfulness",
    "demoThemeBrightness", "demoBackgroundFile", "demoBackgroundDropzone",
    "demoRemoveBackground", "brightness", "motionToggle",
    "demoHitokotoEnabled", "demoHitokotoLanguage", "demoHitokotoSpeaker",
    "demoHitokotoSource", "demoQuoteSpeaker", "demoQuoteSource", "demoQuoteRefresh",
    "demoAcademicProgram", "demoCalendarNote", "scheduleTable", "demoAbsenceEvents",
    "refreshSchedule", "refreshAbsence", "shortcutForm", "cancelShortcutEdit",
    "shortcutGrid", "shortcutManagerList",
  ]) assert.ok(html.includes('id="' + id + '"'), "Missing demo feature: " + id);
  for (const module of ["student","mail","events","learning","tron"]) {
    assert.match(html, new RegExp('data-service="' + module + '"'));
  }
});

test("custom shortcuts have edit and pin/unpin in addition to add/remove", () => {
  assert.match(app, /editingShortcut/);
  assert.match(app, /item\.pinned !== false/);
  assert.match(app, /togglePin\.addEventListener\("click"/);
  assert.match(app, /edit\.addEventListener\("click"/);
  assert.match(app, /state\.shortcuts\.splice\(index, 1\)/);
  assert.match(app, /rel = "noopener noreferrer"/);
  assert.match(app, /validExternalUrl/);
});

test("program selector changes sample day, evening and weekend timetable", () => {
  assert.match(app, /const EVENING_COURSES = Object\.freeze/);
  assert.match(app, /const WEEKEND_COURSES = Object\.freeze/);
  assert.match(app, /setAcademicProgram\(program\)/);
  assert.match(features, /window\.NutcDemo\?\.setAcademicProgram\(state\.program\)/);
  assert.match(app, /timeZone: "Asia\/Taipei"/);
  assert.match(html, /data-demo-absence="leave"/);
  assert.match(html, /data-demo-absence="absent"/);
});

test("theme, background, local avatar and Hitokoto preferences are interactive", () => {
  assert.match(features, /demoAvatarFile/);
  assert.match(features, /maxLength|slice\(0,40\)/);
  assert.match(features, /new FileReader\(\)/);
  assert.match(features, /state\.background = ""/);
  assert.match(features, /state\.themeBrightness = Number/);
  assert.match(features, /state\.colorfulness = Number/);
  assert.match(features, /demoHitokotoEnabled/);
  assert.match(features, /state\.hitokotoSpeaker/);
  assert.match(features, /state\.hitokotoSource/);
  assert.match(features, /from: "cn", to: "twp"/);
  assert.match(features, /translate\(quote\.text, state\.hitokotoLanguage\)/);
  assert.match(features, /localStorage\.setItem/);
  assert.match(features, /no-store/);
});

test("feature selectors are animated accessible glass listboxes", () => {
  assert.match(menus, /aria-haspopup/);
  assert.match(menus, /aria-selected/);
  assert.match(menus, /ArrowDown/);
  assert.match(menus, /Escape/);
  assert.match(menus, /MutationObserver/);
  assert.match(css, /\.demo-select-menu\[data-state="open"\]/);
  assert.match(css, /prefers-reduced-motion/);
});

test("demo never includes university authentication or privileged server calls", () => {
  const source = html + app + features + menus;
  assert.doesNotMatch(source, /\/api\/|\/server-login|eportal\.nutc\.edu\.tw|ais\.nutc\.edu\.tw|login\.php|type="password"/);
  assert.doesNotMatch(source, /token=|sessionStorage\.setItem/);
  assert.match(features, /credentials:"omit"/);
  assert.match(features, /https:\/\/v1\.hitokoto\.cn\//);
  assert.match(html, /此為靜態展示/);
  assert.match(html, /沒有真實登入、學籍資料或學校系統連線/);
  assert.match(features, /模擬更新完成/);
});

test("demo build bundles OpenCC locally and publishes build outputs only", () => {
  const packageFile = JSON.parse(pkg);
  assert.match(packageFile.scripts["build:demo"], /vite build --config demo\/vite\.config\.js/);
  assert.ok(packageFile.dependencies["opencc-js"]);
  assert.match(workflow, /npm run build:demo/);
  assert.match(workflow, /path: demo-dist/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
  assert.doesNotMatch(workflow, /path: \.\/?$/m);
});
