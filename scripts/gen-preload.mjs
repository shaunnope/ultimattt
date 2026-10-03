// Writes <link rel="modulepreload"> for every module the start screen needs into site/index.html.
//
// The app is plain ES modules with no bundler, so the browser would otherwise find them one level of imports
// at a time: five round trips deep before the first screen. Listing them all up front lets it fetch them in
// parallel. Only the static imports of the entry are listed; modules reached by import() (the game, the
// replay, two-device play) load when they are needed.
//
//   node scripts/gen-preload.mjs           rewrite the block in site/index.html (runs as part of `npm run build`)
//   node scripts/gen-preload.mjs --check   fail if the block is out of date (runs as part of `npm run check`)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export const START_MARK = "<!-- modulepreload:start -->";
export const END_MARK = "<!-- modulepreload:end -->";

/** The relative modules a source file imports statically (not import() calls, not comments). */
export function staticImports(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
  const found = [];
  const pattern = /(?:\bfrom\s*|(?:^|[\n;])\s*import\s*)["'](\.{1,2}\/[^"']+)["']/g;
  let match;
  while ((match = pattern.exec(code))) found.push(match[1]);
  return found;
}

/** Every module reachable from `entry` by static imports, as paths relative to the site, sorted. */
export function startupModules(entry, read) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const source = read(path);
    if (source === null) continue;
    for (const spec of staticImports(source)) queue.push(posix.normalize(posix.join(posix.dirname(path), spec)));
  }
  // An import that could not be read is dropped from the list; the browser will report it when it loads the page.
  return [...seen].filter((p) => p === entry || read(p) !== null).sort();
}

export function injectPreload(html, modules) {
  const start = html.indexOf(START_MARK);
  const end = html.indexOf(END_MARK);
  if (start < 0 || end < 0 || end < start) throw new Error(`index.html needs the ${START_MARK} and ${END_MARK} markers`);
  const links = modules.map((m) => `  <link rel="modulepreload" href="${m}">`).join("\n");
  return `${html.slice(0, start)}${START_MARK}\n${links}\n  ${html.slice(end)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = join(process.cwd(), "site");
  const read = (path) => {
    const file = join(site, path);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  };
  const pagePath = join(site, "index.html");
  const html = readFileSync(pagePath, "utf8");
  const updated = injectPreload(html, startupModules("js/ui/app.js", read));
  if (process.argv.includes("--check")) {
    if (updated !== html) {
      console.error("check-preload: the modulepreload list in site/index.html is out of date; run `npm run build`");
      process.exit(1);
    }
  } else if (updated !== html) {
    writeFileSync(pagePath, updated);
    console.log(`modulepreload: ${startupModules("js/ui/app.js", read).length} modules listed`);
  }
}
