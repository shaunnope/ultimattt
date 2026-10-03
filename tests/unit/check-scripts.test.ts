import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain .mjs scripts, no types
import { checkVersion } from "../../scripts/check-version.mjs";
// @ts-expect-error plain .mjs scripts, no types
import { checkPrecache } from "../../scripts/check-precache.mjs";
// @ts-expect-error plain .mjs scripts, no types
import { checkSw } from "../../scripts/check-sw.mjs";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "fixtures", "check", name), "utf8");

function project(opts: { version: string; files: string[]; hash: string; lock?: { version: string; hash: string }; emitted?: string[] }) {
  const root = mkdtempSync(join(tmpdir(), "ttt-check-"));
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "site", "js"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "src", "sw.ts"), `const VERSION = "${opts.version}";\n`);
  writeFileSync(join(root, "site", "precache.json"), JSON.stringify({ hash: opts.hash, files: opts.files }));
  for (const f of opts.emitted ?? []) {
    mkdirSync(join(root, "site", f, ".."), { recursive: true });
    writeFileSync(join(root, "site", f), "//");
  }
  if (opts.lock) writeFileSync(join(root, "scripts", "precache.lock.json"), JSON.stringify(opts.lock));
  return root;
}

test("check-version: passes when assets are unchanged", () => {
  const root = project({ version: "3", files: ["index.html"], hash: "aaa", lock: { version: "3", hash: "aaa" } });
  assert.deepEqual(checkVersion(root), []);
});

test("check-version: passes when assets changed and version was bumped", () => {
  const root = project({ version: "4", files: ["index.html"], hash: "bbb", lock: { version: "3", hash: "aaa" } });
  assert.deepEqual(checkVersion(root), []);
});

test("check-version: fails when assets changed without a version bump", () => {
  const root = project({ version: "3", files: ["index.html"], hash: "bbb", lock: { version: "3", hash: "aaa" } });
  const problems = checkVersion(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /bump VERSION/i);
});

test("check-precache: passes when every emitted js file is listed", () => {
  const root = project({ version: "1", files: ["js/app.js", "js/core/seed.js"], hash: "x", emitted: ["js/app.js", "js/core/seed.js"] });
  assert.deepEqual(checkPrecache(root), []);
});

test("check-precache: fails when an emitted js file is missing from the list", () => {
  const root = project({ version: "1", files: ["js/app.js"], hash: "x", emitted: ["js/app.js", "js/core/seed.js"] });
  const problems = checkPrecache(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /js\/core\/seed\.js/);
});

test("check-sw: passes for a worker that skips waiting only on message and cleans stale caches", () => {
  assert.deepEqual(checkSw(fixture("sw-good.ts")), []);
});

test("check-sw: fails when skipWaiting is called outside the message handler", () => {
  const problems = checkSw(fixture("sw-bad-skipwaiting.ts"));
  assert.ok(problems.some((p: string) => /skipWaiting/.test(p)));
});

test("check-sw: fails when activate does not delete stale caches", () => {
  const problems = checkSw(fixture("sw-bad-nocleanup.ts"));
  assert.ok(problems.some((p: string) => /activate/.test(p)));
});
