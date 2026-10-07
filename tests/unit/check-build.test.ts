import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
// @ts-expect-error plain .mjs scripts, no types
import { checkBuild } from "../../scripts/check-build.mjs";

// scripts/check-build.mjs reads a built folder (build/ or build-subpath/), the worker's source and package.json
// (contracts C2, C3; research R12). These tests build tiny fake projects in a temp folder.

const GOOD_WORKER = `import { immutable, assets, prerendered } from "$app/manifest";
import { version } from "$app/env";
const CACHE = \`ttt-\${version}\`;
addEventListener("message", (e) => { if (e.data?.type === "skip-waiting") skipWaiting(); });
addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ttt-") && k !== CACHE).map((k) => caches.delete(k))))); });
void immutable; void assets; void prerendered;
`;

const GOOD_HTML = (p: string) => `<!doctype html>
<html><head>
<meta charset="utf-8">
<link rel="manifest" href="${p}manifest.json">
<link rel="stylesheet" href="${p}css/theme.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito">
<link rel="modulepreload" href="${p}_app/immutable/entry/start.abc.js">
</head><body><script>import("${p}_app/immutable/entry/start.abc.js");</script></body></html>`;

interface Spec {
  files?: Record<string, string | Buffer>;
  worker?: string;
  pkg?: object;
  html?: string;
  skip?: string[];
  prefix?: string;
}

/** A passing project, with whatever the test wants changed. Returns the root. */
function project(spec: Spec = {}, buildDir = "build"): string {
  const root = mkdtempSync(join(tmpdir(), "ttt-build-"));
  const prefix = spec.prefix ?? "./";
  const files: Record<string, string | Buffer> = {
    "index.html": spec.html ?? GOOD_HTML(prefix),
    "service-worker.js": "// built worker\n",
    "manifest.json": "{}",
    "css/theme.css": ":root{}",
    "_app/immutable/entry/start.abc.js": "export {};",
    ...spec.files,
  };
  for (const name of spec.skip ?? []) delete files[name];
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, buildDir, name)), { recursive: true });
    writeFileSync(join(root, buildDir, name), body);
  }
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "service-worker.ts"), spec.worker ?? GOOD_WORKER);
  writeFileSync(join(root, "package.json"), JSON.stringify(spec.pkg ?? { devDependencies: { x: "1" } }));
  return root;
}

const run = (root: string, opts: { subpath?: boolean } = {}) => {
  try {
    return checkBuild(root, { buildDir: opts.subpath ? "build-subpath" : "build", ...opts }) as string[];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("check-build: a good build passes", () => {
  assert.deepEqual(run(project()), []);
});

test("check-build: a missing service-worker.js or index.html fails", () => {
  assert.ok(run(project({ skip: ["service-worker.js"] })).some((p) => /service-worker\.js is missing/.test(p)));
  assert.ok(run(project({ skip: ["index.html"] })).some((p) => /index\.html is missing/.test(p)));
});

test("check-build: a worker that does not import the build manifest and version fails", () => {
  const noManifest = GOOD_WORKER.replace(/import \{ immutable[^\n]*\n/, "");
  assert.ok(run(project({ worker: noManifest })).some((p) => /\$app\/manifest/.test(p)));
  const missingName = GOOD_WORKER.replace("immutable, assets, prerendered", "immutable, assets");
  assert.ok(run(project({ worker: missingName })).some((p) => /prerendered/.test(p)));
  const noEnv = GOOD_WORKER.replace(/import \{ version \}[^\n]*\n/, "").replace("${version}", "1");
  assert.ok(run(project({ worker: noEnv })).some((p) => /\$app\/env/.test(p)));
});

test("check-build: a cache name that does not use the build version fails", () => {
  const fixed = GOOD_WORKER.replace("`ttt-${version}`", '"ttt-1"');
  const problems = run(project({ worker: fixed }));
  assert.ok(problems.some((p) => /cache name/.test(p) && /version/.test(p)));
});

test("check-build: the shell may load only the app's own files and Google Fonts", () => {
  const html = GOOD_HTML("./").replace("</head>", '<script src="https://cdn.example.com/x.js"></script></head>');
  const problems = run(project({ html }));
  assert.ok(problems.some((p) => /cdn\.example\.com/.test(p)));
  assert.deepEqual(run(project()), []);
});

test("check-build: the sub-path build must have no root-absolute URL outside its base", () => {
  const bad = GOOD_HTML("/ultimattt/").replace("</head>", '<link rel="icon" href="/icons/logo.svg"></head>');
  const problems = run(project({ html: bad, prefix: "/ultimattt/" }, "build-subpath"), { subpath: true });
  assert.ok(problems.some((p) => /\/icons\/logo\.svg/.test(p)));
  assert.deepEqual(run(project({ html: GOOD_HTML("/ultimattt/"), prefix: "/ultimattt/" }, "build-subpath"), { subpath: true }), []);
});

test("check-build: the root build may use root-absolute URLs", () => {
  const html = GOOD_HTML("/");
  assert.deepEqual(run(project({ html, prefix: "/" })), []);
});

test("check-build: a modulepreload for a file that is not in the output fails", () => {
  const html = GOOD_HTML("./").replace("</head>", '<link rel="modulepreload" href="./_app/immutable/chunks/gone.js"></head>');
  const problems = run(project({ html }));
  assert.ok(problems.some((p) => /gone\.js/.test(p)));
});

test("check-build: a shell that points into the old site/ layout fails", () => {
  const html = GOOD_HTML("./").replace("</head>", '<link rel="icon" href="site/icons/logo.svg"></head>');
  assert.ok(run(project({ html })).some((p) => /site\//.test(p)));
});

test("check-build: first-load script plus style over 70 KB gzipped fails", () => {
  // random bytes do not compress, so the gzipped size is about the byte count
  const problems = run(project({ files: { "_app/immutable/entry/start.abc.js": randomBytes(75_000) } }));
  assert.ok(problems.some((p) => /first load/i.test(p) && /70/.test(p)));
});

test("check-build: the first load follows static imports, and leaves dynamic imports out", () => {
  const entry = (body: string) => ({ "_app/immutable/entry/start.abc.js": body, "_app/immutable/chunks/big.js": randomBytes(75_000) });
  const over = run(project({ files: entry('import { x } from "../chunks/big.js";\nexport { x };') }));
  assert.ok(over.some((p) => /first load/i.test(p)), "a static import is part of the first load");
  const minified = run(project({ files: entry('import{a as b}from"../chunks/big.js";export{b};') }));
  assert.ok(minified.some((p) => /first load/i.test(p)), "minified static imports too");
  const lazy = run(project({ files: entry('export const load = () => import("../chunks/big.js");') }));
  assert.ok(!lazy.some((p) => /first load/i.test(p)), "a dynamic import is not");
});

test("check-build: all script over 160 KB gzipped fails, even when the first load is small", () => {
  const problems = run(project({ files: { "_app/immutable/chunks/lazy.js": randomBytes(170_000) } }));
  assert.ok(problems.some((p) => /all script/i.test(p) && /160/.test(p)));
  assert.ok(!problems.some((p) => /first load/i.test(p)));
});

test("check-build: a runtime dependency in package.json fails (FR-015)", () => {
  const problems = run(project({ pkg: { dependencies: { peerjs: "1" }, devDependencies: {} } }));
  assert.ok(problems.some((p) => /dependencies/.test(p) && /peerjs/.test(p)));
  assert.deepEqual(run(project({ pkg: { dependencies: {} } })), []);
});
