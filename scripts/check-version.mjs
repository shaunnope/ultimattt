// Fails when the set of cached assets changed without a bumped VERSION in src/sw.ts.
// scripts/precache.lock.json records the VERSION and asset hash of the last release.
// After a release, refresh it with: node scripts/check-version.mjs --update
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function readVersion(root) {
  const src = readFileSync(join(root, "src", "sw.ts"), "utf8");
  const m = src.match(/const\s+VERSION\s*=\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}

export function checkVersion(root) {
  const version = readVersion(root);
  if (version === null) return ["src/sw.ts has no `const VERSION = \"…\"`"];
  const precachePath = join(root, "site", "precache.json");
  if (!existsSync(precachePath)) return ["site/precache.json is missing; run `npm run build` first"];
  const { hash } = JSON.parse(readFileSync(precachePath, "utf8"));
  const lockPath = join(root, "scripts", "precache.lock.json");
  if (!existsSync(lockPath)) return [];
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  if (lock.hash !== hash && lock.version === version) {
    return [`Cached assets changed but VERSION is still "${version}": bump VERSION in src/sw.ts`];
  }
  return [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  if (process.argv.includes("--update")) {
    const { hash } = JSON.parse(readFileSync(join(root, "site", "precache.json"), "utf8"));
    writeFileSync(join(root, "scripts", "precache.lock.json"), JSON.stringify({ version: readVersion(root), hash }, null, 2) + "\n");
    console.log("precache.lock.json updated");
  } else {
    const problems = checkVersion(root);
    problems.forEach((p) => console.error("check-version:", p));
    process.exit(problems.length ? 1 : 0);
  }
}
