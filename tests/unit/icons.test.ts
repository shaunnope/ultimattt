import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIcons, ICON_REASONS } from "../../src/core/icons.ts";

test("single characters are accepted, including emoji and symbols", () => {
  assert.deepEqual(validateIcons({ X: "X", O: "O" }), { ok: true });
  assert.deepEqual(validateIcons({ X: "★", O: "●" }), { ok: true });
  assert.deepEqual(validateIcons({ X: "🙂", O: "👍🏽" }), { ok: true }); // one grapheme each, though several code points
  assert.deepEqual(validateIcons({ X: "é", O: "ß" }), { ok: true });
});

test("a blank icon is refused", () => {
  assert.deepEqual(validateIcons({ X: "", O: "O" }), { ok: false, reason: "blank", mark: "X" });
  assert.deepEqual(validateIcons({ X: "X", O: " " }), { ok: false, reason: "blank", mark: "O" });
  assert.deepEqual(validateIcons({ X: "X", O: "\n" }), { ok: false, reason: "blank", mark: "O" });
});

test("more than one character is refused", () => {
  assert.deepEqual(validateIcons({ X: "ab", O: "O" }), { ok: false, reason: "too-long", mark: "X" });
  assert.deepEqual(validateIcons({ X: "X", O: "🙂🙂" }), { ok: false, reason: "too-long", mark: "O" });
});

test("both marks must differ, ignoring case", () => {
  assert.deepEqual(validateIcons({ X: "A", O: "A" }), { ok: false, reason: "same", mark: "O" });
  assert.deepEqual(validateIcons({ X: "a", O: "A" }), { ok: false, reason: "same", mark: "O" });
});

test("every reason the validator can give is listed", () => {
  for (const reason of ["blank", "too-long", "same"]) assert.ok((ICON_REASONS as readonly string[]).includes(reason));
});
