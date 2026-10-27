import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// systemd services often start Node with a restricted PATH. Resolve npm's
// JavaScript entrypoint and invoke it with the same Node binary running the
// portal, rather than relying on 'npm' being visible to child_process.spawn.
export async function locateNpmCli({
  rootDir,
  files = fs,
  env = process.env,
  nodeExecutable = process.execPath,
  candidates,
} = {}) {
  const bin = path.dirname(nodeExecutable);
  const possible = candidates ?? [
    env.NUTC_NPM_CLI_PATH,
    env.npm_execpath,
    path.join(rootDir, "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(bin, "node_modules", "npm", "bin", "npm-cli.js"),
    path.resolve(bin, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    path.resolve(bin, "..", "lib64", "node_modules", "npm", "bin", "npm-cli.js"),
    path.resolve(bin, "..", "share", "nodejs", "npm", "bin", "npm-cli.js"),
    "/usr/share/nodejs/npm/bin/npm-cli.js",
    "/usr/local/lib/node_modules/npm/bin/npm-cli.js",
    "/usr/lib/node_modules/npm/bin/npm-cli.js",
  ];
  for (const candidate of possible) {
    if (typeof candidate !== "string" || !/\.c?js$/i.test(candidate)) continue;
    try {
      if ((await files.stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
  }

  // For installations with an npm symlink in a custom bin directory, resolve
  // the symlink instead of launching a shell wrapper.
  if (candidates === undefined) {
    const dirs = (env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
    for (const dir of dirs) {
      try {
        const resolved = await files.realpath(path.join(dir, "npm"));
        if (/\.c?js$/i.test(resolved) && (await files.stat(resolved)).isFile()) {
          return resolved;
        }
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR" && error.code !== "EACCES") {
          throw error;
        }
      }
    }
  }
  return null;
}

export function updaterEnvironment({
  env = process.env,
  nodeExecutable = process.execPath,
  stagingDirectory,
} = {}) {
  const existing = env.PATH || env.Path || "";
  const directories = [
    path.dirname(nodeExecutable),
    ...(process.platform === "win32" ? [] : ["/usr/local/bin", "/usr/bin", "/bin"]),
    ...existing.split(path.delimiter).filter(Boolean),
  ];
  return {
    ...env,
    PATH: [...new Set(directories)].join(path.delimiter),
    ...(stagingDirectory ? { NUTC_BUILD_OUT_DIR: stagingDirectory } : {}),
  };
}
