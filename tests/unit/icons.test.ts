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
