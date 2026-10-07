import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The build output contract (specs/007-sveltekit-ui-migration/contracts/ui-contracts.md, C2 and C3): `node scripts/build.mjs`
// writes build/ with everything a static host needs, and the worker's cache name follows the build.

const root = join(import.meta.dirname, "..", "..");
const build = join(root, "build");
const read = (name: string) => readFileSync(join(build, name), "utf8");

function runBuild(): void {
  execFileSync(process.execPath, [join(root, "scripts", "build.mjs")], { cwd: root, stdio: "pipe" });
}

before(() => {
  runBuild();
});

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

test("the shell links the three stylesheets, and the pre-paint script comes before any module script", () => {
  const html = read("index.html");
  for (const sheet of ["theme", "style", "cube"]) assert.match(html, new RegExp(`<link[^>]+href="[^"]*css/${sheet}\\.css"`), `${sheet}.css linked`);
  const prePaint = html.indexOf("ttt.mode");
  assert.ok(prePaint > 0, "the pre-paint theme script is in the shell");
  const firstModule = Math.min(...[html.indexOf("import("), html.indexOf('type="module"'), html.indexOf('rel="modulepreload"')].filter((i) => i >= 0));
  assert.ok(prePaint < firstModule, "pre-paint script before any module script or preload");
});

test("the files a static host needs are all there", () => {
  for (const file of ["index.html", "404.html", "manifest.json", "service-worker.js", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"]) {
    assert.ok(existsSync(join(build, file)), `${file} is in build/`);
  }
  assert.ok(existsSync(join(build, "screenshots")) && readdirSync(join(build, "screenshots")).length >= 2, "screenshots/ has the install screenshots");
  assert.ok(existsSync(join(build, "_app", "immutable")), "_app/immutable holds the hashed app files");
});

test("nothing from the old layout is emitted: no precache.json, no site/ path in the shell", () => {
  for (const file of walk(build)) assert.notEqual(file.split(/[\\/]/).pop(), "precache.json", file);
  assert.ok(!/\bsite\//.test(read("index.html")));
});

test("the build version is new for every build and the worker's cache name is made from it (FR-008)", () => {
  const v1 = (JSON.parse(read("_app/version.json")) as { version: string }).version;
  assert.ok(v1, "version.json names a version");
  const worker = readFileSync(join(root, "src", "service-worker.ts"), "utf8");
  assert.match(worker, /`ttt-\$\{version\}`/, "the cache name is built from the build version");
  // change a static file, build again: the version moves
  const marker = join(root, "static", "build-test-marker.txt");
  writeFileSync(marker, "changed");
  try {
    runBuild();
  } finally {
    rmSync(marker, { force: true });
  }
  const v2 = (JSON.parse(read("_app/version.json")) as { version: string }).version;
  assert.notEqual(v2, v1);
  runBuild(); // leave build/ as the plain output of the tree
});
