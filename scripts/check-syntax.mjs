#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const searchRoots = [
  "server.js",
  "vite.config.js",
  "postcss.config.cjs",
  "tailwind.config.cjs",
  "scripts",
  "src",
  "public",
  "test",
  "frontend/src",
];
const ignoredDirs = new Set(["node_modules", "vendor", "generated", ".git"]);
const checkable = /\.(?:js|mjs|cjs)$/i;

// Automatically include newly added source files instead of maintaining one
// enormous npm script. JSX/TSX is checked by the Vite build instead.
export async function listSyntaxFiles(root = projectRoot) {
  const results = [];

  async function visit(relative) {
    const absolute = path.join(root, relative);
    let fileInfo;
    try {
      fileInfo = await stat(absolute);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (fileInfo.isFile()) {
      if (checkable.test(relative)) results.push(relative.replaceAll(path.sep, "/"));
      return;
    }
    if (!fileInfo.isDirectory()) return;
    for (const item of await readdir(absolute, { withFileTypes: true })) {
      if (item.isSymbolicLink() || (item.isDirectory() && ignoredDirs.has(item.name))) continue;
      if (!item.isDirectory() && !item.isFile()) continue;
      await visit(path.join(relative, item.name));
    }
  }

  for (const rootPath of searchRoots) await visit(rootPath);
  return [...new Set(results)].sort();
}

async function main() {
  const files = await listSyntaxFiles();
  if (process.argv.includes("--list")) {
    process.stdout.write(files.join("\n") + "\n");
    return;
  }
  let failures = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures++;
      console.error("Syntax error in " + file);
      console.error(result.stderr || result.error?.message || result.stdout);
    }
  }
  console.log(`Syntax checked ${files.length} JavaScript files: ${failures} failed.`);
  if (failures) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
