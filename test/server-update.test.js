import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServerUpdater } from "../src/server-update.js";

function fakeProcessQueue(steps) {
  const calls = [];
  function spawnCommand(command, args, options) {
    calls.push({ command, args: [...args], cwd: options.cwd });
    const step = steps.shift();
    assert.ok(step, "unexpected subprocess " + command + " " + args.join(" "));
    assert.equal(command, step.command);
    assert.deepEqual(args, step.args);

    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => {
      if (step.stdout) child.stdout.emit("data", Buffer.from(step.stdout));
      if (step.stderr) child.stderr.emit("data", Buffer.from(step.stderr));
      child.emit("close", step.exitCode ?? 0);
    });
    return child;
  }
  return { spawnCommand, calls, remaining: () => steps.length };
}

const git = (args, stdout, exitCode = 0) => ({
  command: "git", args, stdout, exitCode,
});
const build = (exitCode = 0) => ({
  command: process.platform === "win32" ? "npm.cmd" : "npm",
  args: ["run", "build"], stdout: "vite completed", exitCode,
});

test("unchanged server checkout does not rebuild or restart", async () => {
  const tasks = fakeProcessQueue([
    git(["rev-parse", "HEAD"], "aaa"),
    git(["pull"], "Already up to date."),
    git(["rev-parse", "HEAD"], "aaa"),
  ]);
  const updater = createServerUpdater({
    rootDir: "/mock/portal", spawnCommand: tasks.spawnCommand,
  });
  const result = await updater.updateServerFromGitPull();
  assert.equal(result.updated, false);
  assert.equal(result.currentCommit, "aaa");
  assert.equal(tasks.calls.length, 3);
  assert.equal(tasks.remaining(), 0);
});

test("changed checkout builds generated frontend assets before reporting success", async () => {
  const tasks = fakeProcessQueue([
    git(["rev-parse", "HEAD"], "aaa"),
    git(["pull"], "Fast-forward"),
    git(["rev-parse", "HEAD"], "bbb"),
    build(),
  ]);
  const updater = createServerUpdater({
    rootDir: "/mock/portal", spawnCommand: tasks.spawnCommand,
  });
  const result = await updater.updateServerFromGitPull();
  assert.equal(result.updated, true);
  assert.equal(result.previousCommit, "aaa");
  assert.equal(result.currentCommit, "bbb");
  assert.match(result.output, /vite completed/);
  assert.deepEqual(tasks.calls.map(c => c.command), ["git", "git", "git",
    process.platform === "win32" ? "npm.cmd" : "npm"]);
  assert.ok(tasks.calls.every(c => c.cwd === "/mock/portal"));
  assert.equal(tasks.remaining(), 0);
});

test("build failures prevent the API from reporting a successful update", async () => {
  const tasks = fakeProcessQueue([
    git(["rev-parse", "HEAD"], "aaa"),
    git(["pull"], "Fast-forward"),
    git(["rev-parse", "HEAD"], "bbb"),
    build(1),
  ]);
  const updater = createServerUpdater({ spawnCommand: tasks.spawnCommand });
  await assert.rejects(updater.updateServerFromGitPull(), {
    code: "SERVER_UPDATE_BUILD_FAILED",
    statusCode: 502,
  });
});

test("Git errors short-circuit before the frontend build", async () => {
  const tasks = fakeProcessQueue([
    git(["rev-parse", "HEAD"], "aaa"),
    { command: "git", args: ["pull"], stderr: "merge conflict", exitCode: 1 },
  ]);
  const updater = createServerUpdater({ spawnCommand: tasks.spawnCommand });
  await assert.rejects(updater.updateServerFromGitPull(), {
    code: "SERVER_UPDATE_GIT_FAILED",
    statusCode: 502,
  });
  assert.equal(tasks.remaining(), 0);
});
