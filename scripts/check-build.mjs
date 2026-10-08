// Checks the built app (build/, and build-subpath/ when it exists) against the build contract (specs/007, C2 and C3):
//  - the shell and the service worker are there, and the shell loads only the app's own files and Google Fonts
//  - the worker reads what to cache from the build ($app/manifest) and names its cache after the build version
//  - the sub-path build has no root-absolute URL outside its base
//  - nothing preloaded is missing, and nothing points into the old site/ layout
//  - size budget: first-load script plus style at most 71 KB gzipped, all script at most 160 KB gzipped
//    (the first load here is the shell's own files and what they import statically; the first load the browser really makes, which
//    includes the route nodes fetched once the page runs, is asserted by tests/e2e/budget.spec.ts)
//  - the package has no runtime dependencies (the dependency list is empty)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const KB = 1024;
export const FIRST_LOAD_BUDGET = 71 * KB;
export const ALL_SCRIPT_BUDGET = 160 * KB;
const ALLOWED_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const SUBPATH_BASE = "/ultimattt";

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const kb = (n) => (n / KB).toFixed(1);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const STATIC_IMPORT = [
  /\b(?:import|export)\s*(?:[\w$]+\s*,?\s*)?(?:\*\s*(?:as\s+[\w$]+)?\s*|\{[^}]*\}\s*)?from\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
];

/** The files a script loads by static import, resolved from its own folder. Dynamic import() calls are lazy and left out. */
function staticImports(file) {
  const text = readFileSync(file, "utf8");
  const found = [];
  for (const pattern of STATIC_IMPORT) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) if (m[1].startsWith(".")) found.push(resolve(dirname(file), m[1]));
  }
  return found;
}

/** The files plus everything they import statically, however deep. */
function withStaticImports(files) {
  const seen = new Set();
  const queue = [...files];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    if (/\.m?js$/.test(file)) queue.push(...staticImports(file));
  }
  return [...seen];
}

/** Every URL the shell names: href and src attributes, and import("...") calls in its inline scripts. */
function shellUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) urls.push(m[1]);
  return urls;
}

/** Problems with one built folder. `root` holds the build folder, src/service-worker.ts and package.json. */
export function checkBuild(root, { buildDir = "build", subpath = false, base = SUBPATH_BASE } = {}) {
  const problems = [];
  const dir = join(root, buildDir);
  if (!existsSync(dir)) return [`${buildDir}/ is missing; run npm run build first`];

  // ---- the files
  const indexPath = join(dir, "index.html");
  if (!existsSync(indexPath)) problems.push(`${buildDir}/index.html is missing`);
  if (!existsSync(join(dir, "service-worker.js"))) problems.push(`${buildDir}/service-worker.js is missing`);

  // ---- the worker's source
  const workerPath = join(root, "src", "service-worker.ts");
  if (!existsSync(workerPath)) {
    problems.push("src/service-worker.ts is missing");
  } else {
    const source = readFileSync(workerPath, "utf8");
    const manifest = /import\s*\{([^}]*)\}\s*from\s*["']\$app\/manifest["']/.exec(source);
    if (!manifest) problems.push("src/service-worker.ts does not import immutable, assets and prerendered from $app/manifest");
    else for (const name of ["immutable", "assets", "prerendered"]) {
      if (!new RegExp(`\\b${name}\\b`).test(manifest[1])) problems.push(`src/service-worker.ts does not import ${name} from $app/manifest, so that part of the build is not cached`);
    }
    if (!/import\s*\{[^}]*\bversion\b[^}]*\}\s*from\s*["']\$app\/env["']/.test(source)) problems.push("src/service-worker.ts does not import version from $app/env");
    if (!/`ttt-\$\{\s*version\s*\}`/.test(source)) problems.push("src/service-worker.ts: the cache name must be built from the build version (`ttt-${version}`)");
  }

  // ---- the shell
  const toFile = (url) => {
    let rel = url.split(/[?#]/)[0];
    if (subpath && rel.startsWith(`${base}/`)) rel = rel.slice(base.length);
    return join(dir, rel.replace(/^\.?\//, ""));
  };
  const loaded = []; // local script and style files the shell needs for its first load
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf8");
    for (const url of shellUrls(html)) {
      const external = /^(?:https?:)?\/\/([^/]+)/.exec(url);
      if (external) {
        if (!ALLOWED_HOSTS.has(external[1])) problems.push(`index.html loads from ${external[1]} (${url}); only the app's own files and Google Fonts are allowed`);
        continue;
      }
      if (/^(?:data|blob|mailto|javascript):|^#/.test(url)) continue;
      if (/(^|\/)site\//.test(url)) problems.push(`index.html points into the old site/ layout: ${url}`);
      if (subpath && url.startsWith("/") && !url.startsWith(`${base}/`)) problems.push(`index.html has a root-absolute URL outside ${base}/: ${url}`);
    }
    for (const m of html.matchAll(/<link\b[^>]*\brel\s*=\s*"modulepreload"[^>]*>/g)) {
      const href = /\bhref\s*=\s*"([^"]+)"/.exec(m[0])?.[1];
      if (href && !existsSync(toFile(href))) problems.push(`index.html preloads ${href}, which is not in ${buildDir}/`);
    }
    for (const m of html.matchAll(/<link\b[^>]*>/g)) {
      const tag = m[0];
      const href = /\bhref\s*=\s*"([^"]+)"/.exec(tag)?.[1];
      if (!href || /^(?:https?:)?\/\//.test(href)) continue;
      if (/\brel\s*=\s*"(?:modulepreload|stylesheet)"/.test(tag)) loaded.push(toFile(href));
    }
    for (const url of shellUrls(html)) {
      if (/^(?:https?:)?\/\//.test(url) || !/\.m?js(?:[?#].*)?$/.test(url)) continue;
      loaded.push(toFile(url));
    }
  }

  // ---- the budget
  const firstLoad = withStaticImports(loaded).filter((f) => existsSync(f) && /\.(?:m?js|css)$/.test(f));
  const firstBytes = firstLoad.reduce((sum, f) => sum + gz(f), 0);
  if (firstBytes > FIRST_LOAD_BUDGET) problems.push(`first load is ${kb(firstBytes)} KB gzipped (script plus style), over the 71 KB budget`);
  const scripts = walk(join(dir, "_app")).filter((f) => /\.m?js$/.test(f));
  const allBytes = scripts.reduce((sum, f) => sum + gz(f), 0);
  if (allBytes > ALL_SCRIPT_BUDGET) problems.push(`all script is ${kb(allBytes)} KB gzipped, over the 160 KB budget`);

  // ---- no runtime dependencies
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const deps = Object.keys(JSON.parse(readFileSync(pkgPath, "utf8")).dependencies ?? {});
    if (deps.length > 0) problems.push(`package.json lists runtime dependencies (${deps.join(", ")}); the app ships none`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const problems = [...checkBuild(root)];
  if (existsSync(join(root, "build-subpath"))) problems.push(...checkBuild(root, { buildDir: "build-subpath", subpath: true }));
  problems.forEach((p) => console.error("check-build:", p));
  process.exit(problems.length ? 1 : 0);
}
