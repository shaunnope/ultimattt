// Writes site/precache.json: every file the app needs offline, plus a hash of their contents.
// The service worker reads it at install time; check-precache.mjs and check-version.mjs read it too.
// Runs as the last step of `npm run build`.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const EXCLUDED = new Set(["sw.js", "precache.json"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function buildPrecache(siteDir) {
  const files = walk(siteDir)
    .map((p) => relative(siteDir, p).split("\\").join("/"))
    .filter((f) => !EXCLUDED.has(f) && !f.startsWith("screenshots/") && !f.split("/").some((part) => part.startsWith(".")) && !/peerjs/i.test(f))
    .sort();
  const hash = createHash("sha256");
  for (const f of files) {
    hash.update(f);
    hash.update(readFileSync(join(siteDir, f)));
  }
  return { hash: hash.digest("hex").slice(0, 16), files: ["./", ...files] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const siteDir = join(process.cwd(), "site");
  const list = buildPrecache(siteDir);
  writeFileSync(join(siteDir, "precache.json"), JSON.stringify(list, null, 2) + "\n");
  console.log(`precache.json: ${list.files.length} files, hash ${list.hash}`);
}
