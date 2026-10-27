import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeHitokotoSettings, parseHitokoto, requestHitokoto,
  translateHitokoto, createHitokotoWidget,
} from "../public/hitokoto.js";
import { createHitokotoService } from "../src/hitokoto-service.js";
import { DashboardPreferenceStore } from "../src/dashboard-preferences.js";

const sample = {
  hitokoto: "  今天也要好好生活  ",
  from: "示範作品",
  from_who: "範例角色",
  uuid: "75a45fd4-4f2f-45eb-80cb-6f0a7bcdfaf2",
};

test("Hitokoto is opt-in and rejects unrecognized language values", () => {
  assert.deepEqual(normalizeHitokotoSettings(), { enabled: false, language: "original" });
  assert.deepEqual(normalizeHitokotoSettings({ enabled: true, language: "ja" }),
    { enabled: true, language: "ja" });
  assert.deepEqual(normalizeHitokotoSettings({ enabled: "true", language: "fr" }),
    { enabled: false, language: "original" });
});

test("quote parser escapes dangerous URL data and retains speaker/source", () => {
  const q = parseHitokoto(sample);
  assert.equal(q.text, "今天也要好好生活");
  assert.equal(q.speaker, "範例角色");
  assert.equal(q.source, "示範作品");
  assert.equal(q.url, "https://hitokoto.cn?uuid=" + sample.uuid);
  const unsafe = parseHitokoto({
    hitokoto: "<img src=x onerror=alert(1)>",
    from: "<script>alert(1)</script>",
    uuid: "javascript:alert(1)",
  });
  assert.equal(unsafe.url, "https://hitokoto.cn/");
  assert.equal(unsafe.speaker, "");
  assert.equal(unsafe.source, "<script>alert(1)</script>");
  assert.throws(() => parseHitokoto({ from: "nothing" }));
});

test("browser requests quote only through own backend, not directly from external API", async () => {
  let request;
  const quote = await requestHitokoto({
    fetchImpl: async (url, opts) => {
      request = { url, opts };
      return { ok: true, json: async () => sample };
    },
  });
  assert.equal(request.url, "/api/hitokoto");
  assert.equal(request.opts.credentials, "same-origin");
  assert.equal(quote.speaker, "範例角色");
});

test("browser translation only declares success for actual translations", async () => {
  assert.deepEqual(await translateHitokoto("測試", "original"), {
    text: "測試", translated: false,
  });
  assert.deepEqual(await translateHitokoto("測試", "en", { TranslatorImpl: null }), {
    text: "測試", translated: false,
  });
  const options = [];
  const translated = await translateHitokoto("測試", "en", {
    TranslatorImpl: {
      availability: async input => { options.push(input); return "available"; },
      create: async () => ({
        translate: async () => "Test",
        destroy: () => {},
      }),
    },
  });
  assert.deepEqual(translated, { text: "Test", translated: true });
  assert.deepEqual(options[0], { sourceLanguage: "zh", targetLanguage: "en" });
  assert.deepEqual(await translateHitokoto("測試", "ja", {
    TranslatorImpl: { availability: async () => "unavailable" },
  }), { text: "測試", translated: false });
});

test("backend preference retains toggle and language and rejects malformed values", async () => {
  const store = new DashboardPreferenceStore();
  let saved = 0;
  store.persist = async () => { saved += 1; };
  assert.deepEqual(store.get().hitokoto, { enabled: false, language: "original" });
  await store.setHitokotoSettings({ enabled: true, language: "en" });
  assert.deepEqual(store.get().hitokoto, { enabled: true, language: "en" });
  await store.setHitokotoSettings({ enabled: false, language: "ja" });
  assert.deepEqual(store.get().hitokoto, { enabled: false, language: "ja" });
  assert.equal(saved, 2);
  for (const payload of [null, {}, { enabled: "true", language: "en" },
    { enabled: true, language: "fr" }]) {
    await assert.rejects(store.setHitokotoSettings(payload), { statusCode: 400 });
  }
});

test("upstream proxy coalesces requests and caches verified quote responses", async () => {
  let attempts = 0;
  let release;
  let clock = 1000;
  const gate = new Promise(resolve => { release = resolve; });
  const service = createHitokotoService({
    now: () => clock,
    fetchImpl: async () => {
      attempts += 1;
      await gate;
      return { ok: true, headers: { get: () => "256" }, json: async () => sample };
    },
  });
  const first = service.getQuote();
  const second = service.getQuote();
  release();
  assert.deepEqual(await first, await second);
  assert.equal(attempts, 1);
  await service.getQuote();
  assert.equal(attempts, 1);
  clock += 20_000;
  await service.getQuote();
  assert.equal(attempts, 2);
});

test("proxy serves a previous quote during temporary upstream outages", async () => {
  let fail = false;
  let clock = 0;
  const service = createHitokotoService({
    now: () => clock,
    fetchImpl: async () => {
      if (fail) throw new Error("network offline");
      return { ok: true, headers: { get: () => "200" }, json: async () => sample };
    },
  });
  await service.getQuote();
  fail = true;
  clock = 20_000;
  assert.equal((await service.getQuote()).speaker, sample.from_who);
});

test("disabled widget never fetches, attributes safely, and restores static subtitle", async () => {
  function fakeNode(text = "") {
    const listeners = new Map();
    return {
      textContent: text, hidden: false, disabled: false,
      lang: "", href: "",
      addEventListener(type, handler) { listeners.set(type, handler); },
      dispatch(type) { listeners.get(type)?.(); },
    };
  }
  const subtitle = fakeNode("你的校園日常，一眼掌握。");
  const details = fakeNode(), speaker = fakeNode(), source = fakeNode();
  const link = fakeNode(), refresh = fakeNode(), status = fakeNode();
  let calls = 0;
  const widget = createHitokotoWidget({
    subtitle, details, speaker, source, link, refresh, status,
    fetchQuote: async () => { calls++; return parseHitokoto(sample); },
    translateQuote: async text => ({ text, translated: false }),
  });
  assert.equal(calls, 0);
  assert.equal(refresh.hidden, true);
  assert.equal(subtitle.textContent, "你的校園日常，一眼掌握。");

  await widget.applySettings({ enabled: true, language: "original" });
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(speaker.textContent, "範例角色");
  assert.equal(source.textContent, "示範作品");
  assert.equal(details.hidden, false);
  assert.equal(link.href, "https://hitokoto.cn?uuid=" + sample.uuid);

  await widget.applySettings({ enabled: false, language: "original" });
  assert.equal(details.hidden, true);
  assert.equal(refresh.hidden, true);
  assert.equal(subtitle.textContent, "你的校園日常，一眼掌握。");
});

test("main page exposes caption toggle, language options and attribution", async () => {
  const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
  const [html, app, server] = await Promise.all([
    read("public/index.html"), read("public/app.js"), read("server.js"),
  ]);
  for (const id of [
    "hitokotoEnabled", "hitokotoLanguage", "hitokotoSpeaker",
    "hitokotoSource", "hitokotoRefresh", "hitokotoStatus",
  ]) assert.ok(html.includes('id="' + id + '"'));
  assert.match(html, /option value="original"/);
  assert.match(html, /option value="en"/);
  assert.match(html, /option value="ja"/);
  assert.match(html, /\/dashboard\.css\?v=4/);
  assert.match(app, /createHitokotoWidget/);
  assert.match(app, /\/api\/preferences\/hitokoto/);
  assert.match(server, /url\.pathname === "\/api\/hitokoto"/);
  assert.match(server, /url\.pathname === "\/api\/preferences\/hitokoto"/);
});
