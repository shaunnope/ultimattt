import { test } from "node:test";
import assert from "node:assert/strict";
import { newSeed, parseSeed, rngFor, randomSource, hashString, pickMark, randomMark, SEED_ALPHABET } from "../../src/core/seed.ts";

const FORMAT = /^([CUB][345][345]|3X3|4X4|5X5|ULT|CUB)-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}$/;

test("alphabet has no vowels and no 0 O 1 I", () => {
  for (const ch of "AEIOU01") assert.ok(!SEED_ALPHABET.includes(ch), ch);
  assert.equal(new Set(SEED_ALPHABET).size, SEED_ALPHABET.length);
});

test("newSeed carries the rules code as its prefix and parses back to the same rules", () => {
  const cases = [
    ["classic", 3, 3, "C33"],
    ["classic", 4, 4, "C44"],
    ["classic", 5, 3, "C53"],
    ["ultimate", 4, 3, "U43"],
    ["ultimate", 5, 5, "U55"],
  ] as const;
  for (const [variant, size, winLength, prefix] of cases) {
    const seed = newSeed(variant, size, winLength);
    assert.match(seed, FORMAT);
    assert.ok(seed.startsWith(prefix + "-"), seed);
    const parsed = parseSeed(seed);
    assert.ok(!("error" in parsed));
    if (!("error" in parsed)) {
      assert.equal(parsed.variant, variant);
      assert.equal(parsed.size, size);
      assert.equal(parsed.winLength, winLength);
      assert.equal(parsed.body.length, 8);
    }
  }
});

test("001 prefixes still parse, with the win length a 001 game implied", () => {
  const cases = [
    ["3X3-BXK4-M9TR", "classic", 3, 3],
    ["4X4-BXK4-M9TR", "classic", 4, 4],
    ["5X5-BXK4-M9TR", "classic", 5, 4],
    ["ULT-BXK4-M9TR", "ultimate", 3, 3],
    ["CUB-BXK4-M9TR", "cube", 3, 3],
  ] as const;
  for (const [text, variant, size, winLength] of cases) {
    const parsed = parseSeed(text);
    assert.ok(!("error" in parsed), text);
    if (!("error" in parsed)) assert.deepEqual({ variant: parsed.variant, size: parsed.size, winLength: parsed.winLength }, { variant, size, winLength });
  }
});

test("a rules code in the prefix is read for any valid combination and refused for an invalid one", () => {
  const ok = parseSeed("C53-BXK4-M9TR");
  assert.ok(!("error" in ok));
  if (!("error" in ok)) assert.deepEqual({ variant: ok.variant, size: ok.size, winLength: ok.winLength }, { variant: "classic", size: 5, winLength: 3 });
  assert.ok("error" in parseSeed("C34-BXK4-M9TR"));
  assert.ok("error" in parseSeed("C63-BXK4-M9TR"));
  assert.ok("error" in parseSeed("D33-BXK4-M9TR"));
});

test("newSeed values differ between calls", () => {
  const seen = new Set(Array.from({ length: 20 }, () => newSeed("classic", 3, 3)));
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
    newSeed("classic", 3, 3);
    randomMark();
    parseSeed("3X3-BXK4-M9TR");
    rngFor("3X3-BXK4-M9TR", 1)();
    randomSource(1)();
  } finally {
    Math.random = original;
  }
});

test("pickMark is deterministic for a seed and gives both marks across seeds", () => {
  assert.equal(pickMark("3X3-BXK4-M9TR"), pickMark("3X3-BXK4-M9TR"));
  const marks = new Set(Array.from({ length: 40 }, () => pickMark(newSeed("classic", 3, 3))));
  assert.deepEqual([...marks].sort(), ["O", "X"]);
});

test("randomMark gives both marks across draws and reads crypto, never Math.random", () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error("Math.random used");
  };
  try {
    const marks = new Set(Array.from({ length: 60 }, () => randomMark()));
    assert.deepEqual([...marks].sort(), ["O", "X"]);
  } finally {
    Math.random = original;
  }
});
