import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleLibraryRequest, isAllowedCoverUrl } from "../src/library-portal.js";
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

  // GET /api/library/catalog/search
  {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/library/catalog/search?q=JS&field=TITLE&scope=SM&page=2"),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen[1], [
      "search",
      { q: "JS", field: "TITLE", scope: "SM", preset: "", page: "2" },
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

  // GET /api/library/cover sets strict image headers
  {
    const res = makeMockRes();
    await handleLibraryRequest(
      { method: "GET" },
      res,
      new URL("http://localhost/api/library/cover?url=https%3A%2F%2Fcdnec.sanmin.com.tw%2Fa.jpg"),
      handlers,
      deps,
    );
    assert.equal(res.statusCode, 200);
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
    /import\s*\{\s*clearLibrarySession,\s*handleLibraryRequest,?\s*\}\s*from\s*"\.\/src\/library-portal\.js"/,
  );
  assert.match(server, /await clearLibrarySession\(\)/);
  assert.match(server, /url\.pathname === "\/library" \|\| url\.pathname\.startsWith\("\/library\/"\)/);
  assert.match(server, /serveStatic\(req, res, "\/library\.html"\)/);
  assert.match(libraryHtml, /<script src="\/library\.js"><\/script>/);
  assert.match(libraryJs, /const BASE = "\/library"/);
  assert.deepEqual(libraryJs.match(/innerHTML\s*=/g), ["innerHTML ="]);
  assert.match(libraryJs, /svg\.innerHTML = ICONS\[name\] \|\| ICONS\.book;/);
  assert.doesNotMatch(libraryJs, /insertAdjacentHTML/);
});
