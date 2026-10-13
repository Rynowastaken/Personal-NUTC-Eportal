import test from "node:test";
import assert from "node:assert/strict";
import {
  DashboardPreferenceStore,
  validateCustomLink,
} from "../src/dashboard-preferences.js";

const GOOGLE_SCRIPT =
  "https://script.google.com/macros/s/AKfycbw935_0y_iKPCBvL0ri9cwq4iUIJjZnM78PhzpFpwvSbjVp6jY3arwhl5qGFfacMVGl6g/exec";

test("custom links accept full Google Apps Script and standard HTTP(S) URLs", () => {
  assert.deepEqual(validateCustomLink({ title: "  Forms  ", url: GOOGLE_SCRIPT }), {
    title: "Forms",
    url: GOOGLE_SCRIPT,
    pinned: true,
  });
  assert.equal(
    validateCustomLink({ title: "Internal", url: "http://localhost:3000/page", pinned: false }).url,
    "http://localhost:3000/page",
  );
});

test("unsafe or malformed links and titles are rejected", () => {
  const rejected = [
    { title: "Unsafe", url: "javascript:alert(1)" },
    { title: "Unsafe", url: "data:text/html,hello" },
    { title: "Unsafe", url: "file:///etc/passwd" },
    { title: "Unsafe", url: "https://user:pass@example.org" },
    { title: "Unsafe", url: "https://example.org/\npath" },
    { title: "", url: "https://example.org" },
    { title: "x".repeat(61), url: "https://example.org" },
    { title: "Bad", url: "example.org" },
    { title: "Bad", url: "https://example.org", pinned: "false" },
  ];
  for (const input of rejected) {
    assert.throws(() => validateCustomLink(input), { statusCode: 400 });
  }
});

test("links can be added, edited, pinned, unpinned and removed without losing other preferences", async () => {
  const store = new DashboardPreferenceStore();
  let saves = 0;
  store.persist = async () => { saves += 1; };

  await store.setAcademicProgram("weekend");
  const added = await store.addCustomLink({
    title: "Google Form",
    url: GOOGLE_SCRIPT,
    pinned: true,
  });
  assert.equal(added.customLinks.length, 1);
  const id = added.customLinks[0].id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(added.customLinks[0].url, GOOGLE_SCRIPT);
  assert.equal(added.academicProgram, "weekend");

  let updated = await store.updateCustomLink(id, { pinned: false });
  assert.equal(updated.customLinks[0].title, "Google Form");
  assert.equal(updated.customLinks[0].pinned, false);
  updated = await store.updateCustomLink(id, {
    title: "Student page",
    url: "https://example.com/path?x=1",
    pinned: true,
  });
  assert.equal(updated.customLinks[0].title, "Student page");
  assert.equal(updated.customLinks[0].pinned, true);
  updated.customLinks[0].title = "mutated client data";
  assert.equal(store.get().customLinks[0].title, "Student page");

  await assert.rejects(store.updateCustomLink(id, { url: "javascript:alert(1)" }), {
    statusCode: 400,
  });
  assert.equal(store.get().customLinks[0].url, "https://example.com/path?x=1");
  assert.equal((await store.removeCustomLink(id)).customLinks.length, 0);
  await assert.rejects(store.removeCustomLink(id), { statusCode: 404 });
  await assert.rejects(store.updateCustomLink(id, { pinned: true }), { statusCode: 404 });
  assert.equal(saves, 5);
});

test("custom-link operations serialize concurrent requests and cap entries at 30", async () => {
  const store = new DashboardPreferenceStore();
  store.persist = async () => {};
  await Promise.all(Array.from({ length: 30 }, (_, index) =>
    store.addCustomLink({ title: "Link " + index, url: "https://example.org/" + index }),
  ));
  assert.equal(store.get().customLinks.length, 30);
  await assert.rejects(
    store.addCustomLink({ title: "Too many", url: "https://example.org" }),
    { statusCode: 400 },
  );
});
