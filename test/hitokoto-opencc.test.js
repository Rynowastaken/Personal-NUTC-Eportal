import test from "node:test";
import assert from "node:assert/strict";
import { convertHitokotoToTraditional } from "../src/hitokoto-opencc.js";
import { createHitokotoService } from "../src/hitokoto-service.js";

test("OpenCC converts Simplified Chinese quotes to Taiwanese Traditional Chinese", () => {
  const original = Object.freeze({
    text: "汉语学习与历史发展",
    speaker: "张三",
    source: "三国演义",
    url: "https://hitokoto.cn?uuid=12345",
  });
  const result = convertHitokotoToTraditional(original);
  assert.deepEqual(result, {
    text: "漢語學習與歷史發展",
    speaker: "張三",
    source: "三國演義",
    url: original.url,
  });
  assert.equal(original.text, "汉语学习与历史发展", "input must not be mutated");
});

test("conversion preserves existing Traditional Chinese and Latin text", () => {
  const converted = convertHitokotoToTraditional({
    text: "今天也要好好生活！Hello, world.",
    speaker: "",
    source: "NUTC Portal",
    url: "https://hitokoto.cn/",
  });
  assert.deepEqual(converted, {
    text: "今天也要好好生活！Hello, world.",
    speaker: "",
    source: "NUTC Portal",
    url: "https://hitokoto.cn/",
  });
});

test("Hitokoto API serves OpenCC-converted quotes and attribution even from cache", async () => {
  let fetched = 0;
  const response = {
    hitokoto: "学习软件，发现更多乐趣。",
    from_who: "张三",
    from: "三国演义",
    uuid: "75a45fd4-4f2f-45eb-80cb-6f0a7bcdfaf2",
  };
  const service = createHitokotoService({
    now: () => 1000,
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://v1.hitokoto.cn/?encode=json&max_length=100");
      assert.equal(options.redirect, "error");
      fetched += 1;
      return { ok: true, headers: { get: () => null }, json: async () => response };
    },
  });
  const quote = await service.getQuote();
  assert.equal(quote.text, "學習軟體，發現更多樂趣。");
  assert.equal(quote.speaker, "張三");
  assert.equal(quote.source, "三國演義");
  assert.equal(quote.url, "https://hitokoto.cn?uuid=" + response.uuid);
  assert.deepEqual(await service.getQuote(), quote);
  assert.equal(fetched, 1, "cached quote must not refetch or lose its conversion");
});

test("quote UI keeps the existing language setting but shows Traditional Chinese", async () => {
  const { readFile } = await import("node:fs/promises");
  const [html, app, widget] = await Promise.all(
    ["public/index.html", "public/app.js", "public/hitokoto.js"].map(
      path => readFile(new URL("../" + path, import.meta.url), "utf8"),
    ),
  );
  assert.match(html, /繁體中文（OpenCC）/);
  assert.match(html, /data-hitokoto-language="original"/);
  assert.match(app, /original: "繁體中文（OpenCC）"/);
  assert.match(html, /\/app\.js\?v=68/);
  assert.match(widget, /subtitle\.lang = "zh-Hant-TW"/);
  assert.match(widget, /現顯示繁體中文/);
});

test("server startup does not require OpenCC until a quote is requested", async () => {
  const { readFile } = await import("node:fs/promises");
  const [service, server] = await Promise.all([
    readFile(new URL("../src/hitokoto-service.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
  ]);
  assert.ok(!service.includes('import { convertHitokotoToTraditional } from "./hitokoto-opencc.js";'));
  assert.ok(service.includes('await import("./hitokoto-opencc.js")'));
  assert.ok(server.includes('import { createHitokotoService } from "./src/hitokoto-service.js";'));
});
