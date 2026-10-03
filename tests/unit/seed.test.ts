import { test } from "node:test";
import assert from "node:assert/strict";
import { newSeed, parseSeed, rngFor, randomSource, hashString, pickMark, SEED_ALPHABET } from "../../src/core/seed.ts";

const FORMAT = /^(3X3|4X4|5X5|ULT|CUB)-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}$/;

test("alphabet has no vowels and no 0 O 1 I", () => {
  for (const ch of "AEIOU01") assert.ok(!SEED_ALPHABET.includes(ch), ch);
  assert.equal(new Set(SEED_ALPHABET).size, SEED_ALPHABET.length);
});

test("newSeed produces a parseable seed for each variant and size", () => {
  const cases = [
    ["classic", 3, "3X3"],
    ["classic", 4, "4X4"],
    ["classic", 5, "5X5"],
    ["ultimate", undefined, "ULT"],
    ["cube", undefined, "CUB"],
  ] as const;
  for (const [variant, size, prefix] of cases) {
    const seed = newSeed(variant, size);
    assert.match(seed, FORMAT);
    assert.ok(seed.startsWith(prefix + "-"), seed);
    const parsed = parseSeed(seed);
    assert.ok(!("error" in parsed));
    if (!("error" in parsed)) {
      assert.equal(parsed.variant, variant);
      assert.equal(parsed.size, variant === "classic" ? size : undefined);
      assert.equal(parsed.body.length, 8);
    }
  }
});

test("newSeed values differ between calls", () => {
  const seen = new Set(Array.from({ length: 20 }, () => newSeed("classic", 3)));
  assert.ok(seen.size > 15);
});

test("parseSeed normalises case and surrounding space", () => {
  const parsed = parseSeed("  3x3-bxk4-m9tr ");
  assert.ok(!("error" in parsed));
  if (!("error" in parsed)) assert.equal(parsed.body, "BXK4M9TR");
});

test("parseSeed rejects bad prefix, length and characters", () => {
  for (const bad of ["", "XYZ-BXK4-M9TR", "3X3-BXK-M9TR", "3X3-BXK4-M9T", "3X3-BXK4-M9T0", "3X3-AXK4-M9TR", "3X3BXK4M9TR", "6X6-BXK4-M9TR"]) {
    const parsed = parseSeed(bad);
    assert.ok("error" in parsed, bad);
  }
});

test("same seed gives the same random sequence; different seeds differ", () => {
  const a = randomSource(hashString("3X3-BXK4-M9TR"));
  const b = randomSource(hashString("3X3-BXK4-M9TR"));
  const c = randomSource(hashString("3X3-BXK4-M9TS"));
  const sa = Array.from({ length: 10 }, a);
  const sb = Array.from({ length: 10 }, b);
  const sc = Array.from({ length: 10 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const n of sa) assert.ok(Number.isInteger(n) && n >= 0 && n <= 0xffffffff);
});

test("hashString is stable", () => {
  assert.equal(hashString("abc"), hashString("abc"));
  assert.notEqual(hashString("abc"), hashString("abd"));
  assert.ok(hashString("") >= 0);
});

test("rngFor is deterministic per seed and move index", () => {
  const seed = "ULT-BXK4-M9TR";
  assert.equal(rngFor(seed, 3)(), rngFor(seed, 3)());
  assert.notEqual(rngFor(seed, 3)(), rngFor(seed, 4)());
  assert.notEqual(rngFor(seed, 3)(), rngFor("ULT-BXK4-M9TS", 3)());
});

test("core seed code never touches Math.random", () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error("Math.random used");
  };
  try {
    newSeed("classic", 3);
    parseSeed("3X3-BXK4-M9TR");
    rngFor("3X3-BXK4-M9TR", 1)();
    randomSource(1)();
  } finally {
    Math.random = original;
  }
});

test("pickMark is deterministic for a seed and gives both marks across seeds", () => {
  assert.equal(pickMark("3X3-BXK4-M9TR"), pickMark("3X3-BXK4-M9TR"));
  const marks = new Set(Array.from({ length: 40 }, () => pickMark(newSeed("classic", 3))));
  assert.deepEqual([...marks].sort(), ["O", "X"]);
});
