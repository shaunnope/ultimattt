import { test } from "node:test";
import assert from "node:assert/strict";
import { newSeed, normaliseSeedText, resolveSeed, parseSeed, rngFor, randomSource, hashString, pickMark, randomMark, SEED_ALPHABET } from "../../src/core/seed.ts";

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

// Forgiving reading of the seed box (spec 008): normaliseSeedText and resolveSeed never fail.

const CLASSIC_3 = { variant: "classic", size: 3, winLength: 3 } as const;
const ULTIMATE_4 = { variant: "ultimate", size: 4, winLength: 4 } as const;
const CANONICAL = /^[0-9A-Z]{3}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}$/;

test("normaliseSeedText upper-cases and removes spaces, dashes and underscores", () => {
  assert.equal(normaliseSeedText("c53-bxk4-m9tr"), "C53BXK4M9TR");
  assert.equal(normaliseSeedText(" c53 \t bxk4\nm9tr "), "C53BXK4M9TR");
  assert.equal(normaliseSeedText("c53_bxk4_m9tr"), "C53BXK4M9TR");
});

test("normaliseSeedText treats every dash-like character as a separator", () => {
  for (const dash of ["‐", "‑", "‒", "–", "—", "―", "−"]) {
    assert.equal(normaliseSeedText(`C53${dash}BXK4${dash}M9TR`), "C53BXK4M9TR", dash.codePointAt(0)!.toString(16));
  }
});

test("normaliseSeedText folds full-width letters and digits and keeps other characters", () => {
  assert.equal(normaliseSeedText("ＢＸＫ４"), "BXK4");
  assert.notEqual(normaliseSeedText("A.B"), normaliseSeedText("AB"));
  assert.equal(normaliseSeedText("---"), "");
  assert.equal(normaliseSeedText(" \t\n"), "");
  assert.equal(normaliseSeedText(""), "");
});

test("resolveSeed gives null for blank text", () => {
  for (const blank of ["", "   ", "---", " - _ - ", "﻿", " "]) assert.equal(resolveSeed(blank, CLASSIC_3), null, JSON.stringify(blank));
});

test("resolveSeed reads every spelling of a valid seed as that seed, with its rules", () => {
  for (const text of ["C53-BXK4-M9TR", "c53-bxk4-m9tr", "C53BXK4M9TR", " C53 BXK4 M9TR ", "c53–bxk4–m9tr", "C53_BXK4_M9TR"]) {
    const reading = resolveSeed(text, ULTIMATE_4);
    assert.ok(reading && reading.kind === "exact", text);
    if (reading && reading.kind === "exact") {
      assert.equal(reading.seed, "C53-BXK4-M9TR");
      assert.deepEqual([reading.variant, reading.size, reading.winLength], ["classic", 5, 3]);
    }
  }
});

test("resolveSeed keeps a legacy prefix in its own spelling", () => {
  for (const [text, seed] of [["3x3-bxk4-m9tr", "3X3-BXK4-M9TR"], ["ult bxk4 m9tr", "ULT-BXK4-M9TR"], ["CUBBXK4M9TR", "CUB-BXK4-M9TR"], ["5x5bxk4m9tr", "5X5-BXK4-M9TR"]] as const) {
    const reading = resolveSeed(text, CLASSIC_3);
    assert.ok(reading && reading.kind === "exact", text);
    assert.equal(reading!.seed, seed);
  }
});

test("resolveSeed puts the current rules in front of eight good characters", () => {
  const bare = resolveSeed("bxk4-m9tr", ULTIMATE_4);
  assert.deepEqual(bare, { kind: "body", seed: "U44-BXK4-M9TR" });
});

test("resolveSeed keeps a good body whose rules part is not a known rules code", () => {
  for (const text of ["XYZ-BXK4-M9TR", "C34-BXK4-M9TR", "C63-BXK4-M9TR", "D33BXK4M9TR"]) {
    assert.deepEqual(resolveSeed(text, ULTIMATE_4), { kind: "body", seed: "U44-BXK4-M9TR" }, text);
  }
});

test("resolveSeed derives a valid seed from anything else, with the current rules in front", () => {
  const awkward = [
    "nope", "banana", "3X3-AXK4-M9TR", "C53-BXK4-M9T0", "C53-BXK4-M9T", "C53-BXK4-M9TRR", "C53-BXK4-M9TO", "C53-IXK4-M9TR",
    "héllo wörld", "你好，世界", "😀", "😀😀😀", "\ud800", "a\u0000b", "<script>alert(1)</script>", "../../etc/passwd", "'; DROP TABLE seeds;--",
    "0", "1", "O", "I", "?", "!", ".", ",", "ß", "İ", "ǅ", "‮", "x".repeat(1000),
  ];
  for (const text of awkward) {
    const reading = resolveSeed(text, ULTIMATE_4);
    assert.ok(reading, JSON.stringify(text));
    assert.ok(CANONICAL.test(reading!.seed), `${JSON.stringify(text)} -> ${reading!.seed}`);
    assert.ok(reading!.seed.startsWith("U44-"), reading!.seed);
    assert.ok(!("error" in parseSeed(reading!.seed)), reading!.seed);
    if (reading!.kind !== "derived") assert.fail(`${JSON.stringify(text)} should be derived but was ${reading!.kind}`);
  }
});

test("resolveSeed never throws, whatever it is given", () => {
  for (const odd of [undefined, null, 5, {}, [], "𐀀", "\udc00"] as unknown[]) {
    assert.doesNotThrow(() => resolveSeed(odd as string, CLASSIC_3));
  }
});

test("resolveSeed reads a very long text quickly", () => {
  const started = performance.now();
  const reading = resolveSeed("a".repeat(100_000), CLASSIC_3);
  assert.ok(reading && CANONICAL.test(reading.seed));
  assert.ok(performance.now() - started < 50, "slow");
});

test("resolveSeed is deterministic and ignores spelling for derived seeds", () => {
  const a = resolveSeed("banana", CLASSIC_3)!.seed;
  assert.equal(resolveSeed("banana", CLASSIC_3)!.seed, a);
  assert.equal(resolveSeed("BANANA", CLASSIC_3)!.seed, a);
  assert.equal(resolveSeed("b-a-n-a-n-a", CLASSIC_3)!.seed, a);
  assert.equal(resolveSeed("  banana  ", CLASSIC_3)!.seed, a);
  assert.notEqual(resolveSeed("bananas", CLASSIC_3)!.seed, a);
});

test("resolveSeed gives 1,000 different texts 1,000 different seeds", () => {
  const seeds = new Set(Array.from({ length: 1000 }, (_, i) => resolveSeed(`text ${i}`, CLASSIC_3)!.seed));
  assert.equal(seeds.size, 1000);
});

test("a derived seed's own characters depend on the text only, its prefix on the rules", () => {
  const a = resolveSeed("banana", CLASSIC_3)!.seed;
  const b = resolveSeed("banana", ULTIMATE_4)!.seed;
  assert.equal(a.slice(3), b.slice(3));
  assert.notEqual(a.slice(0, 3), b.slice(0, 3));
});

test("parseSeed stays strict: links and saves still get an error for text that is not a seed", () => {
  for (const bad of ["nope", "C53BXK4M9TR", "c53 bxk4 m9tr", "BXK4M9TR", "C34-BXK4-M9TR", ""]) {
    assert.ok("error" in parseSeed(bad), bad);
  }
});
