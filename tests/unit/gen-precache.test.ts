import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain .mjs script, no types
import { buildPrecache } from "../../scripts/gen-precache.mjs";

function site(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "ttt-pre-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const BASE = { "index.html": "<html>", "js/ui/app.js": "a", "js/core/seed.js": "s", "css/style.css": "c", "manifest.json": "{}" };

test("lists every emitted file, plus the app root, in a stable sorted order", () => {
  const { files } = buildPrecache(site(BASE));
  assert.deepEqual(files, ["./", "css/style.css", "index.html", "js/core/seed.js", "js/ui/app.js", "manifest.json"]);
});

test("excludes the service worker, the list itself and dotfiles", () => {
  const { files } = buildPrecache(site({ ...BASE, "sw.js": "w", "precache.json": "{}", ".nojekyll": "" }));
  assert.ok(!files.includes("sw.js"));
  assert.ok(!files.includes("precache.json"));
  assert.ok(!files.includes(".nojekyll"));
});

test("never lists PeerJS, which is loaded from a CDN and not cached", () => {
  const { files } = buildPrecache(site({ ...BASE, "vendor/peerjs.min.js": "p" }));
  assert.ok(!files.some((f: string) => /peerjs/i.test(f)));
});

test("the hash changes when a file is added or its content changes, and is stable otherwise", () => {
  const a = buildPrecache(site(BASE)).hash;
  const b = buildPrecache(site(BASE)).hash;
  const added = buildPrecache(site({ ...BASE, "js/core/new.js": "n" })).hash;
  const edited = buildPrecache(site({ ...BASE, "js/ui/app.js": "changed" })).hash;
  assert.equal(a, b);
  assert.notEqual(a, added);
  assert.notEqual(a, edited);
});

test("screenshots are left out: only the install prompt uses them, so they are not worth caching for offline play", () => {
  const { files } = buildPrecache(site({ ...BASE, "screenshots/screen-narrow.png": "x", "icons/icon-192.png": "i" }));
  assert.ok(!files.some((f: string) => f.startsWith("screenshots/")));
  assert.ok(files.includes("icons/icon-192.png"));
});
