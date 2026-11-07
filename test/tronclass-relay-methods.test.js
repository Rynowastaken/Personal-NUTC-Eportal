import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  handleTronclassRequest,
  isTronclassRelayMethod,
  tronclassRelayReadsBody,
} from "../src/tronclass.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const request = (method) => ({ method, headers: {} });

test("the TronClass relay accepts GET, POST and PUT", () => {
  for (const method of ["GET", "POST", "PUT"]) {
    assert.equal(isTronclassRelayMethod(request(method)), true, method + " must be relayed");
  }
  for (const method of ["DELETE", "PATCH", "HEAD", "OPTIONS"]) {
    assert.equal(isTronclassRelayMethod(request(method)), false, method + " must stay rejected");
  }
});

test("PUT reads its request body through the same path as POST", async () => {
  assert.equal(tronclassRelayReadsBody("POST"), true);
  assert.equal(tronclassRelayReadsBody("PUT"), true);
  for (const method of ["GET", "DELETE", "PATCH"]) {
    assert.equal(tronclassRelayReadsBody(method), false, method + " must not read a body");
  }

  const relay = await read("../src/tronclass.js");
  assert.match(relay, /tronclassRelayReadsBody\(req\.method\) \? await readBody\(req\) : undefined/);
  assert.match(
    relay,
    /\{ "Content-Type": req\.headers\["content-type"\] \|\| "application\/json" \}/,
  );
});

test("unsupported methods are rejected with 405 before any TronClass request", async () => {
  for (const method of ["DELETE", "PATCH", "HEAD", "OPTIONS"]) {
    const calls = [];
    const handled = await handleTronclassRequest(
      request(method),
      { headersSent: false },
      new URL("/tronclass/api/exams/1/distribute", "https://portal.test"),
      {
        sendJson() {
          assert.fail(method + " must not be relayed as JSON");
        },
        sendError(_res, status, message, code) {
          calls.push({ status, message, code });
        },
      },
    );
    assert.equal(handled, true, method);
    assert.equal(calls.length, 1, method);
    assert.equal(calls[0].status, 405, method);
    assert.match(calls[0].message, /GET, POST and PUT/, method);
  }
});
