import { test } from "node:test";
import assert from "node:assert/strict";
import { ICON_PATHS, ICON_STROKE } from "../../src/ui/icons.ts";

test("the lock icon has a padlock path (body and shackle)", () => {
  const d = ICON_PATHS.lock;
  assert.ok(d.length > 0);
  assert.match(d, /^M/);
  assert.ok((d.match(/M/g) ?? []).length >= 2, "body and shackle are separate subpaths");
});

test("icons are stroked with round caps and joins", () => {
  assert.equal(ICON_STROKE["stroke-linecap"], "round");
  assert.equal(ICON_STROKE["stroke-linejoin"], "round");
});

test("the appearance icons exist: sun, moon, system and palette", () => {
  for (const name of ["sun", "moon", "system", "palette"] as const) {
    assert.ok(ICON_PATHS[name], `${name} is missing`);
  }
});

test("every icon path is made of path commands and numbers only", () => {
  for (const [name, d] of Object.entries(ICON_PATHS)) {
    assert.match(d, /^M[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$/, `${name} has an unexpected character`);
  }
});

test("the whole core set exists, so every app shell can use the same names", () => {
  const core = ["sun", "moon", "system", "close", "back", "search", "help", "info", "palette", "share", "copy", "check", "cross", "timer", "lock", "flag", "heart"];
  for (const name of core) assert.ok(name in ICON_PATHS, `${name} is missing from the core set`);
});

test("each game mode and each hint type has its own icon", () => {
  const domain = ["mode-classic", "mode-ultimate", "mode-twist", "hint-win", "hint-block"];
  for (const name of domain) assert.ok(name in ICON_PATHS, `${name} is missing`);
  const paths = domain.map((name) => (ICON_PATHS as Record<string, string>)[name]);
  assert.equal(new Set(paths).size, paths.length, "no two concepts share a drawing");
});
