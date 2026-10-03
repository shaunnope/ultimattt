import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMode } from "../../src/ui/theme.ts";

test("auto follows the system; light and dark are fixed", () => {
  assert.equal(resolveMode("auto", true), "dark");
  assert.equal(resolveMode("auto", false), "light");
  assert.equal(resolveMode("light", true), "light");
  assert.equal(resolveMode("dark", false), "dark");
});

test("anything else behaves like auto", () => {
  assert.equal(resolveMode("blue" as "auto", true), "dark");
  assert.equal(resolveMode("" as "auto", false), "light");
});
