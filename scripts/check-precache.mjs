// Fails when a file the app loads (everything emitted under site/js) is missing from the precache list.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function checkPrecache(root) {
  const site = join(root, "site");
  const listPath = join(site, "precache.json");
  if (!existsSync(listPath)) return ["site/precache.json is missing; run `npm run build` first"];
  const listed = new Set(JSON.parse(readFileSync(listPath, "utf8")).files);
  const jsDir = join(site, "js");
  if (!existsSync(jsDir)) return [];
  return walk(jsDir)
    .map((p) => relative(site, p).split("\\").join("/"))
    .filter((f) => !listed.has(f))
    .map((f) => `${f} is emitted but not in the precache list`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkPrecache(process.cwd());
  problems.forEach((p) => console.error("check-precache:", p));
  process.exit(problems.length ? 1 : 0);
}
