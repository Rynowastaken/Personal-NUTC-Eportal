import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServerUpdater } from "../src/server-update.js";

const node = process.execPath;
const npmCli = "node_modules/npm/bin/npm-cli.js";
const viteCli = "node_modules/vite/bin/vite.js";
const git = (args, stdout = "", exitCode = 0) =>
  ({ command: "git", args, stdout, exitCode });
const install = () => ({ command: node, args: [
  npmCli, "install", "--no-save", "--package-lock=false", "--no-audit", "--no-fund",
] });
const build = (exitCode = 0, missing = false) =>
  ({ command: node, args: [viteCli, "build"], exitCode, build: true, missing });

function fakeQueue(steps) {
  const calls = [];
  function spawnCommand(command, args, options) {
    const step = steps.shift();
    assert.ok(step, "unexpected subprocess: " + command + " " + args.join(" "));
    assert.equal(command, step.command);
    const relativeArgs = args.map(value =>
      typeof value === "string" && value.startsWith(options.cwd + path.sep)
        ? path.relative(options.cwd, value).split(path.sep).join("/")
        : value,
    );
    assert.deepEqual(relativeArgs, step.args);
    calls.push({ command, args: relativeArgs, options });

    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(async () => {
      try {
        if (step.beforeClose) await step.beforeClose(options);
        if (step.build && step.exitCode !== 1) {
          const staging = options.env.NUTC_BUILD_OUT_DIR;
          assert.ok(staging.includes(".update-build-"), "build must use staging");
          await fs.mkdir(staging, { recursive: true });
          await fs.writeFile(path.join(staging, "site.css"), "/* fresh CSS */");
          if (!step.missing) await fs.writeFile(path.join(staging, "ui.js"), "/* fresh JS */");
        }
        if (step.stdout) child.stdout.emit("data", Buffer.from(step.stdout));
        if (step.stderr) child.stderr.emit("data", Buffer.from(step.stderr));
        child.emit("close", step.exitCode ?? 0);
      } catch (error) {
        child.emit("error", error);
      }
    });
    return child;
  }
  return { spawnCommand, calls, remaining: () => steps.length };
}

async function fixture(fn) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "nutc-updater-"));
  try {
    await fs.mkdir(path.join(rootDir, "public", "generated"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "node_modules", "vite", "bin"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "node_modules", "npm", "bin"), { recursive: true });
    await fs.writeFile(path.join(rootDir, npmCli), "// fixture npm");
    await fs.writeFile(path.join(rootDir, viteCli), "// fixture vite");
    await fs.writeFile(path.join(rootDir, "package.json"), '{"name":"test"}');
    await fs.writeFile(path.join(rootDir, "public", "generated", "site.css"), "old css");
    await fs.writeFile(path.join(rootDir, "public", "generated", "ui.js"), "old js");
    let counter = 0;
    return await fn({ rootDir, makeId: () => String(++counter) });
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

const unchangedGit = [
  git(["rev-parse", "HEAD"], "aaa"),
  git(["pull", "--ff-only"], "Already up to date."),
  git(["rev-parse", "HEAD"], "aaa"),
];

test("even unchanged Git builds/repairs frontend and requests restart", () =>
  fixture(async ({ rootDir, makeId }) => {
    const tasks = fakeQueue([...unchangedGit, install(), build()]);
    const updater = createServerUpdater({ rootDir, makeId, spawnCommand: tasks.spawnCommand });
    const phases = [];
    const result = await updater.updateServerFromGitPull({
      onProgress: ({ stage }) => phases.push(stage),
    });

    assert.equal(result.updated, false);
    assert.equal(result.rebuilt, true);
    assert.equal(result.restartRequired, true);
    assert.equal(result.dependenciesInstalled, true);
    assert.deepEqual(phases, ["checking", "pulling", "installing", "building",
      "verifying", "publishing", "complete"]);
    assert.equal(
      await fs.readFile(path.join(rootDir, "public/generated/site.css"), "utf8"),
      "/* fresh CSS */",
    );
    assert.equal(tasks.remaining(), 0);
    assert.ok(!tasks.calls.some(c => c.command === "sh" || c.command === "bash"));
  })
);

test("rebuild runs without reinstalling dependencies when fingerprint matches", () =>
  fixture(async ({ rootDir, makeId }) => {
    const initial = fakeQueue([...unchangedGit, install(), build()]);
    await createServerUpdater({ rootDir, makeId, spawnCommand: initial.spawnCommand })
      .updateServerFromGitPull();
    const next = fakeQueue([...unchangedGit, build()]);
    const result = await createServerUpdater({
      rootDir, makeId, spawnCommand: next.spawnCommand,
    }).updateServerFromGitPull();
    assert.equal(result.dependenciesInstalled, false);
    assert.equal(next.remaining(), 0);
  })
);

test("package changes reinstall dependencies before staging build", () =>
  fixture(async ({ rootDir, makeId }) => {
    const tasks = fakeQueue([
      git(["rev-parse", "HEAD"], "aaa"),
      git(["pull", "--ff-only"], "Updated."),
      git(["rev-parse", "HEAD"], "bbb"),
      git(["diff", "--name-only", "aaa", "bbb", "--",
        "package.json", "package-lock.json", "npm-shrinkwrap.json"], "package.json"),
      install(), build(),
    ]);
    const result = await createServerUpdater({
      rootDir, makeId, spawnCommand: tasks.spawnCommand,
    }).updateServerFromGitPull();
    assert.equal(result.updated, true);
    assert.equal(result.dependenciesInstalled, true);
    assert.equal(result.currentCommit, "bbb");
    assert.equal(tasks.remaining(), 0);
  })
);

test("failed build preserves the old working CSS and JS", () =>
  fixture(async ({ rootDir, makeId }) => {
    const tasks = fakeQueue([...unchangedGit, install(), build(1)]);
    await assert.rejects(
      createServerUpdater({ rootDir, makeId, spawnCommand: tasks.spawnCommand })
        .updateServerFromGitPull(),
      { code: "SERVER_UPDATE_BUILD_FAILED", statusCode: 502 },
    );
    assert.equal(await fs.readFile(path.join(rootDir, "public/generated/site.css"), "utf8"), "old css");
    assert.equal(await fs.readFile(path.join(rootDir, "public/generated/ui.js"), "utf8"), "old js");
    assert.equal(await fs.stat(path.join(rootDir, ".update-build-1")).catch(() => null), null);
  })
);

test("incomplete build is rejected before swapping assets", () =>
  fixture(async ({ rootDir, makeId }) => {
    const tasks = fakeQueue([...unchangedGit, install(), build(0, true)]);
    await assert.rejects(
      createServerUpdater({ rootDir, makeId, spawnCommand: tasks.spawnCommand })
        .updateServerFromGitPull(),
      { code: "SERVER_UPDATE_VERIFY_FAILED", statusCode: 502 },
    );
    assert.equal(await fs.readFile(path.join(rootDir, "public/generated/ui.js"), "utf8"), "old js");
  })
);

test("Git errors stop the update before installing or building", () =>
  fixture(async ({ rootDir, makeId }) => {
    const tasks = fakeQueue([
      git(["rev-parse", "HEAD"], "aaa"),
      git(["pull", "--ff-only"], "merge conflict", 1),
    ]);
    await assert.rejects(
      createServerUpdater({ rootDir, makeId, spawnCommand: tasks.spawnCommand })
        .updateServerFromGitPull(),
      { code: "SERVER_UPDATE_GIT_FAILED", statusCode: 502 },
    );
    assert.equal(tasks.remaining(), 0);
  })
);

test("a second update cannot run while another is already active", () =>
  fixture(async ({ rootDir, makeId }) => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const tasks = fakeQueue([
      { ...git(["rev-parse", "HEAD"], "aaa"), beforeClose: async () => pending },
      ...unchangedGit.slice(1), install(), build(),
    ]);
    const updater = createServerUpdater({ rootDir, makeId, spawnCommand: tasks.spawnCommand });
    const first = updater.updateServerFromGitPull();
    await assert.rejects(updater.updateServerFromGitPull(), {
      code: "SERVER_UPDATE_IN_PROGRESS", statusCode: 409,
    });
    release();
    await first;
    assert.equal(tasks.remaining(), 0);
  })
);

test("failed dependency installation remains retryable even without new Git commits", () =>
  fixture(async ({ rootDir, makeId }) => {
    const brokenInstall = { ...install(), exitCode: 1, stderr: "network unavailable" };
    const failed = fakeQueue([...unchangedGit, brokenInstall]);
    await assert.rejects(
      createServerUpdater({ rootDir, makeId, spawnCommand: failed.spawnCommand })
        .updateServerFromGitPull(),
      { code: "SERVER_UPDATE_INSTALL_FAILED", statusCode: 502 },
    );
    assert.equal(await fs.stat(path.join(rootDir, "node_modules/.nutc-dependency-revision"))
      .catch(() => null), null);
    const retried = fakeQueue([...unchangedGit, install(), build()]);
    const result = await createServerUpdater({
      rootDir, makeId, spawnCommand: retried.spawnCommand,
    }).updateServerFromGitPull();
    assert.equal(result.dependenciesInstalled, true);
    assert.equal(retried.remaining(), 0);
  })
);

test("publish failure restores the previous verified assets", () =>
  fixture(async ({ rootDir, makeId }) => {
    let intercepted = false;
    const files = {
      ...fs,
      async rename(from, to) {
        if (!intercepted && from.includes(".update-build-") && to.endsWith("generated")) {
          intercepted = true;
          throw Object.assign(new Error("simulated disk failure"), { code: "EIO" });
        }
        return fs.rename(from, to);
      },
    };
    const tasks = fakeQueue([...unchangedGit, install(), build()]);
    await assert.rejects(
      createServerUpdater({ rootDir, makeId, files, spawnCommand: tasks.spawnCommand })
        .updateServerFromGitPull(),
      { code: "SERVER_UPDATE_PUBLISH_FAILED", statusCode: 502 },
    );
    assert.equal(intercepted, true);
    assert.equal(await fs.readFile(path.join(rootDir, "public/generated/site.css"), "utf8"), "old css");
    assert.equal(await fs.readFile(path.join(rootDir, "public/generated/ui.js"), "utf8"), "old js");
  })
);
