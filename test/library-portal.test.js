import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fetchBookEnrichment,
  fetchLibraryCover,
  getLibraryCatalogAvailability,
  handleLibraryRequest,
  isAllowedCoverUrl,
  searchLibraryCatalog,
} from "../src/library-portal.js";
import { MODULES, moduleById, publicModules } from "../src/eportal.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function makeMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
      );
    },
    end(payload = "") {
      this.body = payload;
    },
  };
}

function makeHandlers() {
  return {
    sendJson(res, status, data) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    },
    sendError(res, status, message, code) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message, code }));
    },
    async readJsonBody(req) {
      return req._body ?? {};
    },
  };
}

test("isAllowedCoverUrl permits only safe HTTPS cover CDN/catalog hosts", () => {
  assert.equal(isAllowedCoverUrl("https://cdnec.sanmin.com.tw/cover.jpg"), true);
  assert.equal(isAllowedCoverUrl("https://ntit.ent.sirsidynix.net/img/a.png"), true);
  assert.equal(isAllowedCoverUrl("https://cover.openbd.jp/9784846021177.jpg"), true);
  assert.equal(isAllowedCoverUrl("http://cdnec.sanmin.com.tw/cover.jpg"), false);
  assert.equal(isAllowedCoverUrl("https://127.0.0.1/secret.png"), false);
  assert.equal(isAllowedCoverUrl("https://169.254.169.254/latest/meta-data"), false);
  assert.equal(isAllowedCoverUrl("https://evil.example.com/a.jpg"), false);
  assert.equal(isAllowedCoverUrl("not-a-url"), false);
});

test("handleLibraryRequest dispatches overview, catalog, renew, databases, rooms, cover, download, and open routes", async () => {
  const handlers = makeHandlers();
  const seen = [];

  const deps = {
    overviewFn: async ({ force }) => {
      seen.push(["overview", force]);
      return { summary: { checkoutsCount: 1 } };
    },
    searchCatalogFn: async (opts) => {
      seen.push(["search", opts]);
      return { items: [] };
    },
    catalogAvailabilityFn: async (ids) => {
      seen.push(["availability", ids]);
      return { items: { 226822: { availableCount: 1, totalCount: 2, holdsCount: 0, holdable: true } } };
    },
    catalogItemFn: async (path) => ({ title: "Demo Book", detailPath: path }),
    renewFn: async (itemIds) => ({ message: `Renewed ${itemIds.length}`, results: [] }),
    databasesFn: async (opts) => ({ count: 0, items: [], opts }),
    availabilityFn: async (opts) => ({ year: Number(opts.year) || 2026, month: 11, days: [] }),
    bookCarrelFn: async (payload) => ({ message: `Booked room ${payload.room}` }),
    cancelCarrelFn: async (targetId) => ({ cancelled: true, targetId }),
    coverFn: async () => ({
      contentType: "image/jpeg",
      buffer: Buffer.from([1, 2, 3]),
    }),
    downloadFn: async (fid) => ({
      contentType: "application/octet-stream",
      filename: `EndNote_${fid}.exe`,
      buffer: Buffer.from("EXE"),
    }),
    openTargetFn: async (key) => `https://library.nutc.edu.tw/sso/target/${key}`,
  };

  // Unmatched path returns false
  {
    const res = makeMockRes();
    const handled = await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/ais/overview"),
      handlers,
      deps,
    );
    assert.equal(handled, false);
  }

  // GET /api/library/overview?refresh=1
  {
    const res = makeMockRes();
    assert.equal(
      await handleLibraryRequest(
        { method: "GET" },
        res,
        new URL("http://localhost/api/library/overview?refresh=1"),
        handlers,
        deps,
      ),
      true,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen[0], ["overview", true]);
  }

  // GET /api/library/catalog/search (empty browse-all + sort + repeated tags)
  {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL(
        "http://localhost/api/library/catalog/search?q=&field=ALL&scope=SM&sort=PD&tag=" +
          encodeURIComponent("LANGUAGE\t語言\tCHI\t中文") +
          "&tag=" +
          encodeURIComponent("PUBDATE\t出版日期\t2025\t2025") +
          "&page=2",
      ),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen[1], [
      "search",
      {
        q: "",
        field: "ALL",
        scope: "SM",
        preset: "",
        sort: "PD",
        tags: ["LANGUAGE\t語言\tCHI\t中文", "PUBDATE\t出版日期\t2025\t2025"],
        page: "2",
      },
    ]);
  }

  // POST /api/library/opac/renew + /api/library/rooms/carrel/book + /cancel
  for (const [path, body, expectSub] of [
    ["/api/library/opac/renew", { itemIds: ["A", "B"] }, "Renewed 2"],
    ["/api/library/rooms/carrel/book", { room: "3" }, "Booked room 3"],
    ["/api/library/rooms/carrel/cancel", { targetId: "carrel-1" }, "carrel-1"],
  ]) {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "POST", _body: body },
      res,
      new URL(`http://localhost${path}`),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 200);
    assert.match(String(res.body), new RegExp(expectSub));
  }

  // GET /api/library/catalog/availability?ids=226822,306166
  {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/library/catalog/availability?ids=226822,306166"),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 200);
    assert.match(String(res.body), /226822/);
  }

  // GET /api/library/cover?isbn=... sets strict image headers and forwards isbn
  {
    const seenCoverOpts = [];
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/library/cover?isbn=9789864514489"),
      handlers,
      {
        ...deps,
        coverFn: async (opts) => {
          seenCoverOpts.push(opts);
          return deps.coverFn(opts);
        },
      },
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seenCoverOpts, [{ url: "", isbn: "9789864514489" }]);
    assert.equal(res.headers["content-type"], "image/jpeg");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["cache-control"], "private, max-age=3600");
  }

  // GET /api/library/downloads/:fid sets attachment disposition
  {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/library/downloads/101"),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-disposition"], /attachment; filename\*=UTF-8''EndNote_101\.exe/);
    assert.equal(res.headers["cache-control"], "no-store, private");
  }

  // GET /library/open/:key issues 302 redirect and maps EPORTAL_LOGIN_REQUIRED to /server-login/
  {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/library/open/carrel"),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, "https://library.nutc.edu.tw/sso/target/carrel");
    assert.equal(res.headers["referrer-policy"], "no-referrer");

    const loginRes = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      loginRes,
      new URL("http://localhost/library/open/carrel"),
      handlers,
      {
        openTargetFn: async () => {
          const err = new Error("Login needed");
          err.code = "EPORTAL_LOGIN_REQUIRED";
          throw err;
        },
      },
    );
    assert.equal(loginRes.statusCode, 302);
    assert.equal(loginRes.headers.location, "/server-login/?force=1&next=%2Flibrary");
  }

  // API error mapping preserves EPORTAL_LOGIN_REQUIRED -> 401 and EPORTAL_PROFILE_BUSY -> 409
  for (const [code, expectedStatus] of [
    ["EPORTAL_LOGIN_REQUIRED", 401],
    ["EPORTAL_PROFILE_BUSY", 409],
  ]) {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/library/overview"),
      handlers,
      {
        overviewFn: async () => {
          const err = new Error("Auth/busy");
          err.code = code;
          throw err;
        },
      },
    );
    assert.equal(res.statusCode, expectedStatus);
  }
});

test("library module, server routing, CSP, logout cleanup, and frontend safety invariants hold", async () => {
  const mod = moduleById("library");
  assert.ok(mod);
  assert.equal(mod.appPath, "/library");
  const pubMod = publicModules().find((m) => m.id === "library");
  assert.equal(pubMod?.launchPath, "/library");
  assert.ok(MODULES.some((m) => m.id === "library"));

  const [server, libraryHtml, libraryJs] = await Promise.all([
    read("../server.js"),
    read("../public/library.html"),
    read("../public/library.js"),
  ]);

  assert.match(
    server,
    /import\s*\{[\s\S]*clearLibrarySession[\s\S]*handleLibraryRequest[\s\S]*\}\s*from\s*"\.\/src\/library-portal\.js"/,
  );
  assert.match(server, /warmLibraryCatalog\(\)/);
  assert.match(server, /await clearLibrarySession\(\)/);
  assert.match(server, /url\.pathname === "\/library" \|\| url\.pathname\.startsWith\("\/library\/"\)/);
  assert.match(server, /serveStatic\(req, res, "\/library\.html"\)/);
  assert.match(libraryHtml, /<script src="\/library\.js"><\/script>/);
  assert.match(libraryJs, /const BASE = "\/library"/);
  assert.deepEqual(libraryJs.match(/innerHTML\s*=/g), ["innerHTML ="]);
  assert.match(libraryJs, /svg\.innerHTML = ICONS\[name\] \|\| ICONS\.book;/);
  assert.doesNotMatch(libraryJs, /insertAdjacentHTML/);
});

test("searchLibraryCatalog rejects invalid sort orders and malformed facet tags cleanly", async () => {
  await assert.rejects(
    () => searchLibraryCatalog({ sort: "INVALID" }),
    (err) => err?.code === "LIBRARY_INVALID_PARAM" && err?.statusCode === 400,
  );
  await assert.rejects(
    () => searchLibraryCatalog({ tags: ["EVIL\tTAG"] }),
    (err) => err?.code === "LIBRARY_INVALID_PARAM" && err?.statusCode === 400,
  );
  await assert.rejects(
    () => searchLibraryCatalog({ scope: "UNKNOWN" }),
    (err) => err?.code === "LIBRARY_INVALID_PARAM" && err?.statusCode === 400,
  );
});

test("getLibraryCatalogAvailability rejects empty or non-numeric IDs", async () => {
  await assert.rejects(
    () => getLibraryCatalogAvailability(""),
    (err) => err?.code === "LIBRARY_INVALID_PARAM" && err?.statusCode === 400,
  );
  await assert.rejects(
    () => getLibraryCatalogAvailability("123,abc"),
    (err) => err?.code === "LIBRARY_INVALID_PARAM" && err?.statusCode === 400,
  );
});

test("fetchLibraryCover resolves missing covers by ISBN fallback, follows safe redirects, and rejects invalid payloads or unsafe hosts", async () => {
  const realFetch = globalThis.fetch;
  const fakeJpeg = Buffer.alloc(650, 0xab);
  try {
    // 1. Rejects malformed ISBN and empty inputs
    await assert.rejects(
      () => fetchLibraryCover({ url: "", isbn: "bad-isbn" }),
      (err) => err?.code === "LIBRARY_INVALID_PARAM" && err?.statusCode === 400,
    );
    await assert.rejects(
      () => fetchLibraryCover({ url: "", isbn: "" }),
      (err) => err?.code === "LIBRARY_COVER_DISALLOWED" && err?.statusCode === 400,
    );

    // 2. TW ISBN falls back from 200 text/html Sanmin to Google Books viewapi -> zoom=1 image
    const seenUrls1 = [];
    globalThis.fetch = async (input) => {
      const u = String(input);
      seenUrls1.push(u);
      if (u.startsWith("https://cdnec.sanmin.com.tw/")) {
        return new Response("<html>no image</html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (u.startsWith("https://books.google.com/books?bibkeys=")) {
        return new Response(
          'var _GBSBookInfo = {"ISBN:9789864761234":{"thumbnail_url":"http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=5&edge=curl"}};',
          { status: 200, headers: { "content-type": "text/javascript" } },
        );
      }
      if (u.startsWith("https://books.google.com/books/content?")) {
        assert.match(u, /zoom=1/);
        assert.doesNotMatch(u, /edge=curl/);
        return new Response(fakeJpeg, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response("not found", { status: 404 });
    };
    const twHit = await fetchLibraryCover({ url: "", isbn: "9789864761234" });
    assert.equal(twHit.contentType, "image/jpeg");
    assert.equal(twHit.buffer.length, 650);
    assert.equal(seenUrls1.some((u) => u.includes("cdnec.sanmin.com.tw")), true);

    // 3. Rejects tiny <400B image & unsafe redirect; follows safe archive.org redirect on Open Library
    const seenUrls2 = [];
    globalThis.fetch = async (input) => {
      const u = String(input);
      seenUrls2.push(u);
      if (u.startsWith("https://books.google.com/books?bibkeys=")) {
        return new Response('var _GBSBookInfo = {"ISBN:9780134685991":{}};', {
          status: 200,
          headers: { "content-type": "text/javascript" },
        });
      }
      if (u.startsWith("https://covers.openlibrary.org/")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://archive.org/download/m_covers/cover.jpg" },
        });
      }
      if (u.startsWith("https://archive.org/")) {
        return new Response(fakeJpeg, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response("no", { status: 404 });
    };
    const olHit = await fetchLibraryCover({ url: "", isbn: "9780134685991" });
    assert.equal(olHit.buffer.length, 650);
    assert.equal(seenUrls2.some((u) => u.startsWith("https://archive.org/")), true);

    // 4. Rejects tiny image, SVG content-type, and unsafe redirect target to evil.example.com
    globalThis.fetch = async (input) => {
      const u = String(input);
      if (u.startsWith("https://cover.openbd.jp/")) {
        return new Response(Buffer.alloc(120, 1), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (u.startsWith("https://books.google.com/books?bibkeys=")) {
        return new Response(
          'var _GBSBookInfo = {"ISBN:9784846021177":{"thumbnail_url":"https://books.google.com/books/content?id=svgtest&printsec=frontcover&img=1&zoom=5"}};',
          { status: 200, headers: { "content-type": "text/javascript" } },
        );
      }
      if (u.startsWith("https://books.google.com/books/content?")) {
        return new Response("<svg xmlns='http://www.w3.org/2000/svg'></svg>", {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        });
      }
      if (u.startsWith("https://covers.openlibrary.org/")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://evil.example.com/pwn.jpg" },
        });
      }
      return new Response("no", { status: 404 });
    };
    await assert.rejects(
      () => fetchLibraryCover({ url: "", isbn: "9784846021177" }),
      (err) => err?.code === "LIBRARY_COVER_NOT_FOUND" && err?.statusCode === 404,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchBookEnrichment resolves descriptions and author bios across Sanmin, Eslite, OpenBD, Google Books, and Open Library", async () => {
  const realFetch = globalThis.fetch;
  try {
    assert.equal(await fetchBookEnrichment("not-an-isbn"), null);

    // 1. TW ISBN hits Sanmin Intro1 & Intro2
    globalThis.fetch = async (input) => {
      const u = String(input);
      if (u.startsWith("https://www.sanmin.com.tw/search/index/")) {
        return new Response(
          '<div class="Title"><a href="/product/index/014043898">安那其的黑色流星</a></div>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (u === "https://www.sanmin.com.tw/product/index/014043898") {
        return new Response(
          `<meta name="description" content="ISBN：9786263841703，頁數：320">
           <h2 id="Intro1">商品簡介</h2><div class="SectionBody">台灣青年歷史小說。</div>
           <h2 id="Intro2">作者簡介</h2><div class="SectionBody">童育園，政大台文所畢。</div>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return new Response("miss", { status: 404 });
    };
    const twHit = await fetchBookEnrichment("978-626-384-170-3");
    assert.equal(twHit?.source, "三民書局");
    assert.equal(twHit?.description, "台灣青年歷史小說。");
    assert.equal(twHit?.authorBio, "童育園，政大台文所畢。");
    assert.equal(twHit?.pages, "320");

    // 2. TW ISBN falls back to Eslite Athena API and strips promo notice
    globalThis.fetch = async (input) => {
      const u = String(input);
      if (u.startsWith("https://www.sanmin.com.tw/")) {
        return new Response("<html>no match</html>", { status: 200 });
      }
      if (u.startsWith("https://athena.eslite.com/api/v2/search")) {
        return new Response(
          JSON.stringify({
            hits: { hit: [{ fields: { eslite_sn: "2683130603006", isbn: "9789570879988" } }] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (u === "https://athena.eslite.com/api/v1/products/2683130603006") {
        return new Response(
          JSON.stringify({
            isbn13: 9789570879988,
            descriptions: [
              {
                product_description_type_id: 2,
                name: "內容簡介",
                description:
                  "<p>【誠品會員獨家贈點】<br>贈送700點</p><p>注意事項如下：<br>1. 活動期間...</p><p>一位終身銀行員的央行二十年紀實。</p>",
              },
              {
                product_description_type_id: 6,
                name: "作者介紹",
                description: "<p>口述／彭淮南</p>",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("miss", { status: 404 });
    };
    const esliteHit = await fetchBookEnrichment("9789570879988");
    assert.equal(esliteHit?.source, "誠品線上");
    assert.equal(esliteHit?.description, "一位終身銀行員的央行二十年紀實。");
    assert.equal(esliteHit?.authorBio, "口述／彭淮南");

    // 3. JP ISBN uses OpenBD CollateralDetail TextType 03 + Contributor bio
    globalThis.fetch = async (input) => {
      const u = String(input);
      if (u.startsWith("https://api.openbd.jp/v1/get")) {
        return new Response(
          JSON.stringify([
            {
              onix: {
                CollateralDetail: {
                  TextContent: [
                    { TextType: "02", Text: "短い要約" },
                    { TextType: "03", Text: "詳細な内容紹介テキストです。" },
                  ],
                },
                DescriptiveDetail: {
                  Contributor: [{ BiographicalNote: "東京都在住の作家。" }],
                },
              },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("miss", { status: 404 });
    };
    const jpHit = await fetchBookEnrichment("9784846021177");
    assert.equal(jpHit?.source, "OpenBD");
    assert.equal(jpHit?.description, "詳細な内容紹介テキストです。");
    assert.equal(jpHit?.authorBio, "東京都在住の作家。");

    // 4. EN ISBN uses Google Books viewapi -> #synopsistext, and another EN ISBN falls back to Open Library works
    globalThis.fetch = async (input) => {
      const u = String(input);
      if (u.includes("9780596158101") && u.includes("viewapi")) {
        return new Response(
          'var _GBSBookInfo = {"ISBN:9780596158101":{"info_url":"https://books.google.com/books?id=etibAgAAQBAJ&source=gbs_ViewAPI"}};',
          { status: 200 },
        );
      }
      if (u.startsWith("https://books.google.com/books?id=etibAgAAQBAJ")) {
        return new Response(
          '<div id="synopsistext"><p>Master Python for real applications.</p><p>Includes web and GUI tutorials.</p></div>',
          { status: 200 },
        );
      }
      if (u.includes("9780134685991") && u.includes("viewapi")) {
        return new Response("var _GBSBookInfo = {};", { status: 200 });
      }
      if (u === "https://openlibrary.org/isbn/9780134685991.json") {
        return new Response(
          JSON.stringify({ works: [{ key: "/works/OL18125943W" }] }),
          { status: 200 },
        );
      }
      if (u === "https://openlibrary.org/works/OL18125943W.json") {
        return new Response(
          JSON.stringify({ description: { value: "Comprehensive guide to Java best practices." } }),
          { status: 200 },
        );
      }
      return new Response("miss", { status: 404 });
    };
    const gbHit = await fetchBookEnrichment("9780596158101");
    assert.equal(gbHit?.source, "Google Books");
    assert.equal(gbHit?.description, "Master Python for real applications.\n\nIncludes web and GUI tutorials.");

    const olHit = await fetchBookEnrichment("9780134685991");
    assert.equal(olHit?.source, "Open Library");
    assert.equal(olHit?.description, "Comprehensive guide to Java best practices.");
  } finally {
    globalThis.fetch = realFetch;
  }
});
