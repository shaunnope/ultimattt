import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../../src/core/config.ts";

const base = { variant: "classic", size: 5, winLength: 3, mode: "local" };

const defaults = { scoring: "lines", lockFaces: false };

test("a valid config round-trips", () => {
  assert.deepEqual(parseConfig(base), { ...base, ...defaults });
  const computer = { ...base, mode: "computer", level: 3, humanMark: "X", seed: "C53-BXK4-M9TR" };
  assert.deepEqual(parseConfig(computer), { ...computer, ...defaults });
});

test("scoring defaults to lines and lockFaces to false; both are read for a Cube config", () => {
  const cube = { variant: "cube", size: 4, winLength: 3, mode: "local" };
  assert.deepEqual(parseConfig(cube), { ...cube, ...defaults });
  assert.deepEqual(parseConfig({ ...cube, scoring: "faces", lockFaces: true }), { ...cube, scoring: "faces", lockFaces: true });
  assert.deepEqual(parseConfig({ ...cube, scoring: "faces" }), { ...cube, scoring: "faces", lockFaces: false });
  assert.deepEqual(parseConfig({ ...cube, lockFaces: true }), { ...cube, scoring: "lines", lockFaces: true });
});

test("non-default scoring or lock on Classic or Ultimate, or a value of the wrong type, is refused", () => {
  for (const variant of ["classic", "ultimate"]) {
    assert.equal(parseConfig({ ...base, variant, scoring: "faces" }), null, variant);
    assert.equal(parseConfig({ ...base, variant, lockFaces: true }), null, variant);
  }
  const cube = { variant: "cube", size: 3, winLength: 3, mode: "local" };
  for (const bad of [{ scoring: "points" }, { scoring: 1 }, { scoring: null }, { lockFaces: "yes" }, { lockFaces: 1 }, { lockFaces: null }]) {
    assert.equal(parseConfig({ ...cube, ...bad }), null, JSON.stringify(bad));
  }
});

test("win length must be an integer from 3 to the size", () => {
  for (const winLength of [2, 6, 3.5, "3", null, Number.NaN]) assert.equal(parseConfig({ ...base, winLength }), null, String(winLength));
  assert.equal(parseConfig({ ...base, size: 3, winLength: 4 }), null);
  assert.equal(parseConfig({ ...base, size: 4, winLength: 4 })?.winLength, 4);
});

test("an absent win length takes the legacy default for the variant and size", () => {
  assert.equal(parseConfig({ variant: "classic", size: 3, mode: "local" })?.winLength, 3);
  assert.equal(parseConfig({ variant: "classic", size: 5, mode: "local" })?.winLength, 4);
  assert.equal(parseConfig({ variant: "ultimate", size: 3, mode: "local" })?.winLength, 3);
  assert.equal(parseConfig({ variant: "cube", size: 3, mode: "network" })?.winLength, 3);
});

test("every variant accepts sizes 3 to 5 and nothing else", () => {
  for (const variant of ["classic", "ultimate", "cube"]) {
    for (const size of [3, 4, 5]) assert.ok(parseConfig({ variant, size, winLength: 3, mode: "local" }), `${variant} ${size}`);
    for (const size of [2, 6, "3", undefined]) assert.equal(parseConfig({ variant, size, winLength: 3, mode: "local" }), null, `${variant} ${size}`);
  }
});

test("Cube with the computer is not a game", () => {
  assert.equal(parseConfig({ variant: "cube", size: 3, winLength: 3, mode: "computer", level: 3, seed: "C33-BXK4-M9TR" }), null);
});

test("the seed is required for computer games and ignored otherwise", () => {
  assert.equal(parseConfig({ ...base, mode: "computer", level: 3 }), null);
  assert.equal(parseConfig({ ...base, mode: "computer", level: 3, seed: 5 }), null);
  assert.equal("seed" in parseConfig({ ...base, seed: "C53-BXK4-M9TR" })!, false);
  assert.equal("seed" in parseConfig({ ...base, mode: "network", humanMark: "O", seed: "C53-BXK4-M9TR" })!, false);
});

test("level, mark, variant and mode are checked", () => {
  assert.equal(parseConfig({ ...base, level: 9 }), null);
  assert.equal(parseConfig({ ...base, humanMark: "Z" }), null);
  assert.equal(parseConfig({ ...base, variant: "nope" }), null);
  assert.equal(parseConfig({ ...base, mode: "nope" }), null);
  assert.equal(parseConfig(null), null);
  assert.equal(parseConfig("x"), null);
});
