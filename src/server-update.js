import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILES = ["site.css", "ui.js"];

function updateError(code, message) {
  return Object.assign(new Error(message), { code, statusCode: 502 });
}

// Keep update commands isolated, bounded, and testable. Nothing is evaluated
// through a shell, and we never print environment values or credentials.
export function createServerUpdater({
  rootDir = DEFAULT_ROOT,
  spawnCommand = spawn,
  files = fs,
  makeId = () => crypto.randomUUID(),
} = {}) {
  let inFlight = false;
  const npmBinary = process.platform === "win32" ? "npm.cmd" : "npm";

  function runCommand(command, args, { timeoutMs = 120_000, env = process.env, errorCode } = {}) {
    return new Promise((resolve, reject) => {
      let child;
      let finished = false;
      let timer;
      const output = [];
      let outputBytes = 0;
      const maxBytes = 32_768;

      function finish(error, result) {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (error) reject(error);
        else resolve(result);
      }

      try {
        child = spawnCommand(command, args, {
          cwd: rootDir,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        finish(updateError(errorCode, "Could not launch " + command + ": " + error.message));
        return;
      }

      function capture(chunk) {
        const data = Buffer.from(chunk);
        const remaining = maxBytes - outputBytes;
        if (remaining > 0) {
          const truncated = data.subarray(0, remaining);
          output.push(truncated);
          outputBytes += truncated.length;
        }
      }

      child.stdout?.on("data", capture);
      child.stderr?.on("data", capture);
      child.once("error", (error) => {
        finish(updateError(errorCode, command + " failed: " + error.message));
      });
      child.once("close", (code, signal) => {
        const text = Buffer.concat(output).toString("utf8").trim();
        if (code === 0) {
          finish(null, { stdout: text, code });
        } else {
          finish(updateError(
            errorCode,
            command + " " + args.join(" ") + " failed" +
              (signal ? " (" + signal + ")" : " (exit " + code + ")") +
              (text ? ": " + text : ""),
          ));
        }
      });
      timer = setTimeout(() => {
        child.kill("SIGTERM");
        finish(updateError("SERVER_UPDATE_TIMEOUT", command + " timed out after " + timeoutMs + "ms."));
      }, timeoutMs);
      timer.unref?.();
    });
  }

  async function exists(filename) {
    try {
      await files.stat(filename);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async function dependencyFingerprint() {
    const fragments = [];
    for (const filename of ["package.json", "package-lock.json", "npm-shrinkwrap.json"]) {
      try {
        fragments.push(await files.readFile(path.join(rootDir, filename)));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return crypto.createHash("sha256").update(Buffer.concat(fragments)).digest("hex");
  }

  async function verifyAssets(directory) {
    for (const filename of OUTPUT_FILES) {
      const location = path.join(directory, filename);
      const info = await files.stat(location).catch(() => null);
      if (!info?.isFile() || info.size === 0) {
        throw updateError(
          "SERVER_UPDATE_VERIFY_FAILED",
          "Frontend build is missing " + filename + ". Previous assets were preserved.",
        );
      }
    }
  }

  async function publishAssets(staged, live, backup) {
    const hadLive = await exists(live);
    if (hadLive) await files.rename(live, backup);
    try {
      await files.rename(staged, live);
    } catch (error) {
      if (hadLive) await files.rename(backup, live);
      throw updateError("SERVER_UPDATE_PUBLISH_FAILED", "Unable to publish frontend assets: " + error.message);
    }
    if (hadLive) {
      // The new assets are live. A failure deleting the old backup should
      // never misreport the update as failed or try to undo a good release.
      await files.rm(backup, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function updateServerFromGitPull({ onProgress } = {}) {
    if (inFlight) throw Object.assign(new Error("A server update is already running."), {
      code: "SERVER_UPDATE_IN_PROGRESS",
      statusCode: 409,
    });
    inFlight = true;
    const emit = (stage, detail) => onProgress?.({ stage, detail });
    const staged = path.join(rootDir, ".update-build-" + makeId());
    const backup = path.join(rootDir, ".update-backup-" + makeId());
    const live = path.join(rootDir, "public", "generated");

    try {
      emit("checking", "檢查目前版本…");
      const before = (await runCommand("git", ["rev-parse", "HEAD"], {
        errorCode: "SERVER_UPDATE_GIT_FAILED", timeoutMs: 15_000,
      })).stdout;
      emit("pulling", "正在取得最新程式碼…");
      const pull = await runCommand("git", ["pull", "--ff-only"], {
        errorCode: "SERVER_UPDATE_GIT_FAILED", timeoutMs: 90_000,
      });
      const after = (await runCommand("git", ["rev-parse", "HEAD"], {
        errorCode: "SERVER_UPDATE_GIT_FAILED", timeoutMs: 15_000,
      })).stdout;
      const updated = before !== after;

      let dependencyChanged = false;
      if (updated) {
        const diff = await runCommand(
          "git",
          ["diff", "--name-only", before, after, "--", "package.json", "package-lock.json", "npm-shrinkwrap.json"],
          { errorCode: "SERVER_UPDATE_GIT_FAILED", timeoutMs: 15_000 },
        );
        dependencyChanged = Boolean(diff.stdout);
      }

      const viteInstalled = await exists(path.join(rootDir, "node_modules", "vite"));
      const stampFile = path.join(rootDir, "node_modules", ".nutc-dependency-revision");
      const revision = await dependencyFingerprint();
      const installedRevision = await files.readFile(stampFile, "utf8").catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
      const needsInstall = dependencyChanged || !viteInstalled ||
        installedRevision.trim() !== revision;
      if (needsInstall) {
        emit("installing", "正在安裝前端依賴套件…");
        const lockFile = await exists(path.join(rootDir, "package-lock.json"));
        const npmArgs = lockFile
          ? ["ci", "--no-audit", "--no-fund"]
          : ["install", "--no-save", "--package-lock=false", "--no-audit", "--no-fund"];
        await runCommand(npmBinary, npmArgs, {
          errorCode: "SERVER_UPDATE_INSTALL_FAILED",
          timeoutMs: 240_000,
          // package.json postinstall also compiles CSS; direct that build to
          // the staging area so it never wipes the live CSS during install.
          env: { ...process.env, NUTC_BUILD_OUT_DIR: staged },
        });
        await files.mkdir(path.dirname(stampFile), { recursive: true });
        await files.writeFile(stampFile, revision + "\n");
      }

      // Rebuild on *every manual update*, even when Git has no new commits.
      // This repairs stale/missing generated CSS without requiring SSH.
      emit("building", "正在重新編譯 CSS 與 UI…");
      await runCommand(npmBinary, ["run", "build"], {
        errorCode: "SERVER_UPDATE_BUILD_FAILED",
        timeoutMs: 150_000,
        env: { ...process.env, NUTC_BUILD_OUT_DIR: staged },
      });
      emit("verifying", "正在檢查新產生的前端檔案…");
      await verifyAssets(staged);
      emit("publishing", "正在套用更新後的資源…");
      await publishAssets(staged, live, backup);
      emit("complete", "前端資源已更新，即將重新啟動 Server。");
      return {
        updated,
        rebuilt: true,
        restartRequired: true,
        previousCommit: before || null,
        currentCommit: after || null,
        dependenciesInstalled: needsInstall,
        output: pull.stdout,
      };
    } finally {
      inFlight = false;
      await files.rm(staged, { recursive: true, force: true }).catch(() => {});
    }
  }

  return { updateServerFromGitPull };
}
