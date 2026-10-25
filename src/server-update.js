import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// The dashboard update endpoint only orchestrates this module. Keep Git and
// Vite build lifecycle together, so UI changes are built before Node restarts.
export function createServerUpdater({
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  spawnCommand = spawn,
} = {}) {
  function runGit(args) {
    return new Promise((resolve, reject) => {
      const child = spawnCommand("git", args, {
        cwd: rootDir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout = [];
      const stderr = [];
  
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.once("error", (error) => reject(error));
      child.once("close", (code) => {
        const result = {
          code,
          stdout: Buffer.concat(stdout).toString("utf8").trim(),
          stderr: Buffer.concat(stderr).toString("utf8").trim(),
        };
  
        if (code === 0) {
          resolve(result);
          return;
        }
  
        const error = new Error(
          result.stderr ||
            result.stdout ||
            `git ${args.join(" ")} failed with exit code ${code}.`,
        );
        error.code = "SERVER_UPDATE_GIT_FAILED";
        error.statusCode = 502;
        reject(error);
      });
    });
  }
  
  // The systemd service runs node server.js directly (no npm start). After
  // pulling CSS/React changes we must build *before* restarting the process,
  // otherwise the dashboard uses new JS with old /generated/site.css.
  function rebuildFrontendAfterPull() {
    return new Promise((resolve, reject) => {
      const child = spawnCommand(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
        cwd: rootDir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const chunks = [];
      const limitBytes = 32_768;
      let timer;
      const fail = (message) => {
        const error = new Error(message);
        error.code = "SERVER_UPDATE_BUILD_FAILED";
        error.statusCode = 502;
        reject(error);
      };
      function capture(data) {
        // Bound the output retained from the build process.
        if (Buffer.concat(chunks).length < limitBytes) chunks.push(data);
      }
      child.stdout.on("data", capture);
      child.stderr.on("data", capture);
      child.once("error", (error) => {
        if (timer) clearTimeout(timer);
        fail("Unable to start frontend build: " + error.message);
      });
      child.once("close", (code) => {
        if (timer) clearTimeout(timer);
        const output = Buffer.concat(chunks).toString("utf8").slice(-limitBytes).trim();
        if (code === 0) {
          resolve(output);
        } else {
          fail("Frontend build failed (exit " + code + "): " + output);
        }
      });
      timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
      timer.unref?.();
    });
  }
  
  async function updateServerFromGitPull() {
    const before = (await runGit(["rev-parse", "HEAD"])).stdout;
    const pull = await runGit(["pull"]);
    const after = (await runGit(["rev-parse", "HEAD"])).stdout;
    const updated = Boolean(before && after && before !== after);
    const buildOutput = updated ? await rebuildFrontendAfterPull() : "";
  
    return {
      updated,
      previousCommit: before || null,
      currentCommit: after || null,
      output: [pull.stdout, pull.stderr, buildOutput].filter(Boolean).join("\n"),
    };
  }

  return { updateServerFromGitPull };
}
