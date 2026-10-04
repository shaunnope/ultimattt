import { test } from "node:test";
import assert from "node:assert/strict";
import { winLengthOptions, defaultWinLength, legacyWinLength, clampWinLength, rulesCode, parseRulesCode } from "../../src/core/rules.ts";
import type { Variant } from "../../src/core/types.ts";

const VARIANTS: Variant[] = ["classic", "ultimate", "cube"];

test("win length options run from 3 up to the board size", () => {
  assert.deepEqual(winLengthOptions(3), [3]);
  assert.deepEqual(winLengthOptions(4), [3, 4]);
  assert.deepEqual(winLengthOptions(5), [3, 4, 5]);
});

test("the default win length depends on the size alone: 3 on 3×3, 4 on 4×4 and 5×5", () => {
  assert.equal(defaultWinLength(3), 3);
  assert.equal(defaultWinLength(4), 4);
  assert.equal(defaultWinLength(5), 4);
});

test("legacy win lengths are what a 001 config implied: only Classic 4×4 and 5×5 reach four", () => {
  assert.equal(legacyWinLength("classic", 3), 3);
  assert.equal(legacyWinLength("classic", 4), 4);
  assert.equal(legacyWinLength("classic", 5), 4);
  for (const v of ["ultimate", "cube"] as const) {
    for (const size of [3, 4, 5]) assert.equal(legacyWinLength(v, size), 3, `${v} ${size}`);
  }
});

test("clampWinLength keeps a valid value and otherwise falls back to the default", () => {
  assert.equal(clampWinLength("classic", 5, 3), 3);
  assert.equal(clampWinLength("classic", 5, 5), 5);
  assert.equal(clampWinLength("classic", 3, 5), 3);
  assert.equal(clampWinLength("classic", 4, 5), 4);
  assert.equal(clampWinLength("ultimate", 4, 2), 4);
  assert.equal(clampWinLength("cube", 5, 2.5), 4);
  assert.equal(clampWinLength("cube", 5, 3), 3);
  assert.equal(clampWinLength("classic", 3, Number.NaN), 3);
});

test("rules codes are letter, size and win length", () => {
  assert.equal(rulesCode("classic", 5, 3), "C53");
  assert.equal(rulesCode("ultimate", 4, 3), "U43");
  assert.equal(rulesCode("cube", 3, 3), "B33");
});

test("every valid combination round-trips through its code", () => {
  for (const variant of VARIANTS) {
    for (const size of [3, 4, 5] as const) {
      for (const winLength of winLengthOptions(size)) {
        assert.deepEqual(parseRulesCode(rulesCode(variant, size, winLength)), { variant, size, winLength, scoring: "lines", lockFaces: false });
      }
    }
  }
});

test("bad codes give an error, never a throw", () => {
  for (const bad of ["", "C", "C5", "C533", "X33", "C23", "C63", "C34", "C54x", "c53!", "C5-", "33C", "CUB", "3X3"]) {
    const result = parseRulesCode(bad);
    assert.ok("error" in result, bad);
  }
});

test("a lower-case code is read as upper case", () => {
  assert.deepEqual(parseRulesCode("c53"), { variant: "classic", size: 5, winLength: 3, scoring: "lines", lockFaces: false });
});

test("cube rules codes carry the scoring flag F and then the lock flag L", () => {
  assert.equal(rulesCode("cube", 4, 3, "faces", true), "B43FL");
  assert.equal(rulesCode("cube", 4, 3, "faces"), "B43F");
  assert.equal(rulesCode("cube", 4, 3, "lines", true), "B43L");
  assert.equal(rulesCode("cube", 3, 3), "B33");
  assert.equal(rulesCode("cube", 3, 3, "lines", false), "B33");
});

test("flags parse to scoring and lockFaces; 001 and 002 codes mean lines and no lock", () => {
  assert.deepEqual(parseRulesCode("B33F"), { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: false });
  assert.deepEqual(parseRulesCode("B33L"), { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: true });
  assert.deepEqual(parseRulesCode("B33FL"), { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: true });
  assert.deepEqual(parseRulesCode("b54fl"), { variant: "cube", size: 5, winLength: 4, scoring: "faces", lockFaces: true });
  assert.deepEqual(parseRulesCode("B33"), { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false });
  assert.deepEqual(parseRulesCode("U43"), { variant: "ultimate", size: 4, winLength: 3, scoring: "lines", lockFaces: false });
});

test("flags in the wrong order, repeated, or on Classic and Ultimate codes are errors", () => {
  for (const bad of ["B33LF", "B33FF", "B33LL", "B33X", "C33F", "C33L", "U33L", "U33FL", "B33FLL"]) {
    assert.ok("error" in parseRulesCode(bad), bad);
  }
});
