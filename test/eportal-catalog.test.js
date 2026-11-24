import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MODULES,
  defaultPinnedModuleIds,
  moduleById,
  moduleUrl,
  publicModules,
  resetDiscoveredModules,
  syncDiscoveredModules,
} from "../src/eportal.js";
import {
  DashboardPreferenceStore,
  validatePinnedModules,
} from "../src/dashboard-preferences.js";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("curated ePortal catalog exposes all 16 official subsystems safely with valid icons", async () => {
  resetDiscoveredModules();
  const list = publicModules();
  assert.equal(list.length, 16);
  assert.equal(MODULES.length, 16);

  const ids = new Set(list.map((item) => item.id));
  const uuids = new Set(list.map((item) => item.uuid));
  assert.equal(ids.size, 16);
  assert.equal(uuids.size, 16);

  assert.deepEqual(defaultPinnedModuleIds(), [
    "ais",
    "webmail",
    "activity",
    "ep",
    "tronclass",
  ]);

  const lucide = await read("public/vendor/lucide-1.24.0.min.js");
  const toPascal = (name) =>
    name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");

  for (const item of list) {
    assert.equal("path" in item, false, `${item.id} must not expose internal path`);
    assert.match(item.uuid, /^[0-9a-f-]{36}$/i);
    assert.ok(
      item.launchPath === "/ais" ||
        item.launchPath === "/tronclass" ||
        item.launchPath === "/library" ||
        item.launchPath === `/go/${item.id}`,
    );
    assert.ok(
      new RegExp(`\\b${toPascal(item.icon)}\\b`).test(lucide),
      `Missing Lucide icon ${item.icon} (${toPascal(item.icon)})`,
    );
  }
});

test("passive live discovery validates paths/UUIDs, updates rotated mod_id, and caps unknown entries", () => {
  resetDiscoveredModules();

  try {
    // Reject malformed UUIDs and unsafe paths.
    const rejected = syncDiscoveredModules([
      { uuid: "not-a-uuid", name: "Bad", path: "/ext_module/ext_set_param.php?mod_id=abc" },
      {
        uuid: "11111111-1111-1111-1111-111111111111",
        name: "Evil",
        path: "javascript:alert(1)",
      },
      {
        uuid: "22222222-2222-2222-2222-222222222222",
        name: "Weird",
        path: "/admin/secret.php?x=1",
      },
      {
        uuid: "33333333-3333-3333-3333-333333333333",
        name: "   ",
        path: "/ext_module/ext_set_param.php?mod_id=emptyTitle",
      },
    ]);
    assert.equal(rejected.length, 0);
    assert.equal(publicModules().length, 16);

    // Known UUID updates its path override without mutating curated labels or icons.
    syncDiscoveredModules([
      {
        uuid: "ee517564-07f6-4c80-a5e8-ef1af4762ece",
        name: "Changed upstream title",
        path: "/ext_module/ext_set_param.php?mod_id=_OSL256_ROTATED_TOKEN",
      },
    ]);
    assert.equal(
      moduleById("library").path,
      "/ext_module/ext_set_param.php?mod_id=_OSL256_ROTATED_TOKEN",
    );
    assert.equal(moduleById("library").shortName, "圖書館系統");
    assert.equal(moduleUrl("library"), "https://eportal.nutc.edu.tw/ext_module/ext_set_param.php?mod_id=_OSL256_ROTATED_TOKEN");

    // Unknown valid UUIDs register under ext-<uuid8> and are capped at 32 entries.
    const extras = Array.from({ length: 35 }, (_, idx) => ({
      uuid: `${String(idx + 1).padStart(8, "0")}-aaaa-bbbb-cccc-dddddddddddd`,
      name: `新校務系統 ${idx + 1}`,
      path: `/ext_module/ext_set_param.php?mod_id=EXTRA_${idx + 1}`,
    }));
    const added = syncDiscoveredModules(extras);
    assert.equal(added.length, 32);
    assert.equal(publicModules().length, 16 + 32);
    assert.equal(added[0].id, "ext-00000001");
    assert.equal(added[0].defaultPinned, false);
    assert.equal(added[0].discovered, true);
    const publicExtra = publicModules().find((item) => item.id === "ext-00000001");
    assert.equal(publicExtra?.launchPath, "/go/ext-00000001");
    assert.equal("path" in publicExtra, false);
  } finally {
    resetDiscoveredModules();
  }
});

test("validatePinnedModules and DashboardPreferenceStore enforce safe non-empty pinning", async () => {
  const allowed = new Set(publicModules().map((item) => item.id));
  assert.equal(validatePinnedModules(null, allowed), null);
  assert.deepEqual(
    validatePinnedModules(["library", "ais", "library"], allowed),
    ["library", "ais"],
  );

  for (const invalid of [[], "ais", {}, [123], ["not-real"], ["bad/id"]]) {
    assert.throws(() => validatePinnedModules(invalid, allowed), { statusCode: 400 });
  }

  const store = new DashboardPreferenceStore();
  let saves = 0;
  store.persist = async () => { saves += 1; };

  assert.equal(store.get().pinnedModules, null);
  const updated = await store.setPinnedModules(["ais", "library", "code-judger"], allowed);
  assert.deepEqual(updated.pinnedModules, ["ais", "library", "code-judger"]);
  updated.pinnedModules.push("mutated");
  assert.deepEqual(store.get().pinnedModules, ["ais", "library", "code-judger"]);

  await assert.rejects(store.setPinnedModules([], allowed), { statusCode: 400 });
  assert.equal(saves, 1);
});

test("server route, dashboard progressive disclosure, and launch fallback are wired", async () => {
  const [server, html, css, app, launchHtml, launchJs] = await Promise.all([
    read("server.js"),
    read("public/index.html"),
    read("public/dashboard.css"),
    read("public/app.js"),
    read("public/launch.html"),
    read("public/launch.js"),
  ]);

  assert.match(server, /url\.pathname === "\/api\/preferences\/pinned-modules"/);
  assert.match(server, /dashboardPreferenceStore\.setPinnedModules/);
  assert.match(html, /id="toggleAllModules"/);
  assert.match(html, /id="moreModuleGrid"/);
  assert.match(css, /\.module-tile-slot/);
  assert.match(css, /\.module-pin-btn\[aria-pressed="true"\]/);
  assert.match(css, /\.tile-wall\[hidden\]/);
  assert.match(app, /\/api\/preferences\/pinned-modules/);
  assert.match(app, /顯示全部/);
  assert.match(launchHtml, /id="launchOfficialEportal"/);
  assert.match(launchJs, /EPORTAL_HANDOFF_SESSION_BOUND/);
});
