import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { locateNpmCli, updaterEnvironment } from "../src/update-toolchain.js";

test("npm's JavaScript CLI is located without resolving bare npm on PATH", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nutc-npm-cli-"));
  try {
    const npmCli = path.join(root, "node_modules/npm/bin/npm-cli.js");
    await fs.mkdir(path.dirname(npmCli), { recursive: true });
    await fs.writeFile(npmCli, "// npm fixture");
    const found = await locateNpmCli({
      rootDir: root,
      env: { PATH: "/no/npm/here" },
      nodeExecutable: process.execPath,
      candidates: [npmCli],
    });
    assert.equal(found, npmCli);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("npm lookup can use a configured custom CLI and rejects non-JavaScript executable names", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nutc-npm-custom-"));
  try {
    const npmCli = path.join(root, "custom", "npm-cli.js");
    await fs.mkdir(path.dirname(npmCli), { recursive: true });
    await fs.writeFile(npmCli, "// npm fixture");
    assert.equal(await locateNpmCli({
      rootDir: root,
      env: { NUTC_NPM_CLI_PATH: npmCli, PATH: "/not/installed" },
      nodeExecutable: "/usr/bin/node",
    }), npmCli);
    assert.equal(await locateNpmCli({
      rootDir: root,
      candidates: [path.join(root, "npm"), npmCli],
    }), npmCli);
    assert.equal(await locateNpmCli({
      rootDir: root,
      candidates: [path.join(root, "missing.js")],
    }), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("systemd PATH is supplemented with Node's directory and standard executables", () => {
  const env = updaterEnvironment({
    env: { PATH: "/restricted", SERVICE_ID: "test" },
    nodeExecutable: "/opt/node/v20/bin/node",
    stagingDirectory: "/tmp/nutc-stage",
  });
  assert.equal(env.SERVICE_ID, "test");
  assert.equal(env.NUTC_BUILD_OUT_DIR, "/tmp/nutc-stage");
  assert.deepEqual(env.PATH.split(path.delimiter).slice(0, 2),
    process.platform === "win32"
      ? ["/opt/node/v20/bin", "/restricted"]
      : ["/opt/node/v20/bin", "/usr/local/bin"]);
  assert.ok(env.PATH.split(path.delimiter).includes("/restricted"));
});

test("no PATH-provided npm executable is required for the Vite build", async () => {
  const updater = await fs.readFile(new URL("../src/server-update.js", import.meta.url), "utf8");
  assert.match(updater, /runCommand\(nodeExecutable, \[cli, "build"\]/);
  assert.match(updater, /runCommand\(nodeExecutable, \[cli, \.\.\.args\]/);
  assert.doesNotMatch(updater, /spawnCommand\(["']npm["']/);
  assert.doesNotMatch(updater, /runCommand\(npmBinary/);
});
