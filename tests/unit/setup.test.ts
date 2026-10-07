import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configFromSetup, modesFor, DEFAULT_SETUP, initialSetup, applySeedToSetup, chooseSize, chooseVariant, chooseMode, winLengthChoice, seedControlsVisible,
} from "../../src/ui/setup-model.ts";
import { parseSeed, pickMark } from "../../src/core/seed.ts";
import { winLengthOptions } from "../../src/core/rules.ts";

test("every variant can be played with a friend on this device or on another; only Classic and Ultimate have a computer", () => {
  assert.deepEqual(modesFor("cube"), ["local", "network"]);
  assert.deepEqual(modesFor("classic"), ["computer", "local", "network"]);
  assert.deepEqual(modesFor("ultimate"), ["computer", "local", "network"]);
});

test("a two-device game is set up by its host: a mark and the rules, no level and no seed", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, variant: "ultimate", size: 4, winLength: 3, mode: "network", markChoice: "O" });
  assert.equal(config.mode, "network");
  assert.equal(config.humanMark, "O");
  assert.equal(config.level, undefined);
  assert.equal(config.size, 4);
  assert.equal(config.winLength, 3);
  assert.ok(!("seed" in config));
  const decided = configFromSetup({ ...DEFAULT_SETUP, mode: "network", markChoice: "random" });
  assert.ok(decided.humanMark === "X" || decided.humanMark === "O");
  assert.equal(configFromSetup({ ...DEFAULT_SETUP, variant: "cube", mode: "network" }).mode, "network");
});

test("letting the game decide for two devices draws both marks over time", () => {
  const marks = new Set(Array.from({ length: 60 }, () => configFromSetup({ ...DEFAULT_SETUP, mode: "network", markChoice: "random" }).humanMark));
  assert.deepEqual([...marks].sort(), ["O", "X"]);
});

test("a computer game gets a level, a mark and a seed whose prefix holds the rules", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, variant: "classic", size: 5, winLength: 3, mode: "computer", level: 5, markChoice: "O" });
  assert.equal(config.variant, "classic");
  assert.equal(config.size, 5);
  assert.equal(config.winLength, 3);
  assert.equal(config.level, 5);
  assert.equal(config.humanMark, "O");
  const parsed = parseSeed(config.seed!);
  assert.ok(!("error" in parsed) && parsed.variant === "classic" && parsed.size === 5 && parsed.winLength === 3);
});

test("letting the game decide in a computer game uses the seed to pick the mark", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, mode: "computer", markChoice: "random" }, "C33-BXK4-M9TR");
  assert.equal(config.humanMark, pickMark("C33-BXK4-M9TR"));
  assert.equal(config.seed, "C33-BXK4-M9TR");
});

test("a local game has no level, human mark or seed", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, mode: "local" }, "C33-BXK4-M9TR");
  assert.equal(config.mode, "local");
  assert.equal(config.level, undefined);
  assert.equal(config.humanMark, undefined);
  assert.ok(!("seed" in config));
});

test("cube keeps its size and win length, and its computer choice becomes a local game with no seed", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, variant: "cube", mode: "computer", size: 5, winLength: 4 });
  assert.equal(config.mode, "local");
  assert.equal(config.size, 5);
  assert.equal(config.winLength, 4);
  assert.equal(config.level, undefined);
  assert.ok(!("seed" in config));
});

test("a win length that does not fit the size is replaced by the default when the game is made", () => {
  assert.equal(configFromSetup({ ...DEFAULT_SETUP, size: 3, winLength: 5, mode: "local" }).winLength, 3);
});

test("win length options are 3 up to the size, and fixed at 3 on a 3×3 board", () => {
  for (const size of [3, 4, 5] as const) {
    const choice = winLengthChoice({ ...DEFAULT_SETUP, size, winLength: 3 });
    assert.deepEqual(choice.options, winLengthOptions(size));
    assert.equal(choice.fixed, size === 3);
  }
  assert.equal(winLengthChoice({ ...DEFAULT_SETUP, variant: "ultimate", size: 3 }).value, 3);
  assert.equal(winLengthChoice({ ...DEFAULT_SETUP, variant: "cube", size: 3 }).fixed, true);
});

test("changing the size always sets that size's default win length, in every variant", () => {
  for (const variant of ["classic", "ultimate", "cube"] as const) {
    const at = (size: 3 | 4 | 5, winLength: number) => ({ ...DEFAULT_SETUP, variant, size, winLength });
    assert.equal(chooseSize(at(3, 3), 5).winLength, 4, variant);
    assert.equal(chooseSize(at(5, 5), 4).winLength, 4, variant);
    assert.equal(chooseSize(at(5, 3), 4).winLength, 4, variant);
    assert.equal(chooseSize(at(4, 3), 5).winLength, 4, variant);
    assert.equal(chooseSize(at(5, 5), 3).winLength, 3, variant);
    assert.equal(chooseSize(at(4, 4), 3).winLength, 3, variant);
    assert.equal(chooseSize(at(3, 3), 5).size, 5, variant);
  }
});

test("choosing the size that is already selected changes nothing, so an edited win length stays", () => {
  const state = { ...DEFAULT_SETUP, size: 5 as const, winLength: 5 };
  assert.equal(chooseSize(state, 5), state);
});

test("a run of size choices always ends on the default of the last size", () => {
  const sizes = [3, 4, 5] as const;
  for (const first of sizes) for (const second of sizes) for (const third of sizes) {
    let state: ReturnType<typeof initialSetup> = { ...DEFAULT_SETUP, size: 3, winLength: 3 };
    for (const size of [first, second, third]) state = chooseSize(state, size);
    assert.equal(state.winLength, third === 3 ? 3 : 4, `${first} ${second} ${third}`);
  }
});

test("a remembered valid size and win length are kept, and a seed keeps its own values", () => {
  const saved = { ...DEFAULT_SETUP, variant: "ultimate" as const, size: 5 as const, winLength: 5 };
  const opened = initialSetup(saved);
  assert.deepEqual([opened.size, opened.winLength], [5, 5]);
  const seeded = applySeedToSetup(DEFAULT_SETUP, "U54-BXK4-M9TR");
  assert.ok(!("error" in seeded));
  if (!("error" in seeded)) assert.deepEqual([seeded.size, seeded.winLength], [5, 4]);
  const legacy = applySeedToSetup(DEFAULT_SETUP, "CUB-BXK4-M9TR");
  assert.ok(!("error" in legacy));
  if (!("error" in legacy)) assert.deepEqual([legacy.size, legacy.winLength], [3, 3]);
});

test("size can be chosen for every variant", () => {
  for (const variant of ["classic", "ultimate", "cube"] as const) {
    for (const size of [3, 4, 5] as const) assert.equal(chooseSize({ ...DEFAULT_SETUP, variant }, size).size, size);
  }
});

test("changing the variant keeps the size and a valid win length, and fixes the opponent", () => {
  const next = chooseVariant({ ...DEFAULT_SETUP, size: 5, winLength: 4, mode: "computer" }, "cube");
  assert.equal(next.variant, "cube");
  assert.equal(next.size, 5);
  assert.equal(next.winLength, 4);
  assert.equal(next.mode, "local");
  assert.equal(chooseVariant({ ...DEFAULT_SETUP, size: 4, winLength: 4, variant: "classic" }, "ultimate").winLength, 4);
});

test("the seed field and paste only appear for the computer opponent; leaving it discards typed text", () => {
  assert.equal(seedControlsVisible({ ...DEFAULT_SETUP, mode: "computer" }), true);
  assert.equal(seedControlsVisible({ ...DEFAULT_SETUP, mode: "local" }), false);
  assert.equal(seedControlsVisible({ ...DEFAULT_SETUP, mode: "network" }), false);
  assert.equal(seedControlsVisible({ ...DEFAULT_SETUP, variant: "cube", mode: "local" }), false);
  const typed = { choice: { ...DEFAULT_SETUP, mode: "computer" as const, level: 5 as const }, seed: "C33-BXK4-M9TR" as string | null };
  const away = chooseMode(typed, "local");
  assert.equal(away.seed, null);
  assert.equal(away.choice.mode, "local");
  assert.equal(away.choice.level, 5, "other settings are kept");
  const back = chooseMode(away, "computer");
  assert.equal(back.seed, null, "switching back shows an empty field");
  assert.equal(chooseMode(typed, "computer").seed, "C33-BXK4-M9TR", "choosing the same opponent changes nothing");
});

test("a pasted seed sets the variant, board size and win length", () => {
  let result = applySeedToSetup(DEFAULT_SETUP, "C53-BXK4-M9TR");
  assert.ok(!("error" in result));
  if (!("error" in result)) assert.deepEqual({ v: result.variant, s: result.size, k: result.winLength }, { v: "classic", s: 5, k: 3 });
  result = applySeedToSetup(DEFAULT_SETUP, "u44-bxk4-m9tr");
  assert.ok(!("error" in result));
  if (!("error" in result)) assert.deepEqual({ v: result.variant, s: result.size, k: result.winLength }, { v: "ultimate", s: 4, k: 4 });
  result = applySeedToSetup(DEFAULT_SETUP, "5X5-BXK4-M9TR"); // a 001 seed: Classic 5×5 with its four in a row
  assert.ok(!("error" in result));
  if (!("error" in result)) assert.deepEqual({ v: result.variant, s: result.size, k: result.winLength }, { v: "classic", s: 5, k: 4 });
  assert.ok("error" in applySeedToSetup(DEFAULT_SETUP, "nope"));
});

test("with nothing remembered the start screen opens on the defaults", () => {
  assert.deepEqual(initialSetup(null), DEFAULT_SETUP);
});

test("remembered choices are what the start screen opens on", () => {
  const saved = { variant: "ultimate", size: 4, winLength: 3, scoring: "lines", lockFaces: false, mode: "local", level: 5, markChoice: "O" } as const;
  assert.deepEqual(initialSetup(saved), saved);
});

test("a remembered opponent the variant no longer offers is replaced by the first one it does", () => {
  const saved = { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 2, markChoice: "X" } as const;
  assert.equal(initialSetup(saved).mode, "local");
  assert.equal(initialSetup(saved).level, 2);
});

test("configFromSetup copies scoring and lock for a Cube setup and forces lines and no lock elsewhere", () => {
  const cube = configFromSetup({ ...DEFAULT_SETUP, variant: "cube", mode: "local", scoring: "faces", lockFaces: true });
  assert.equal(cube.scoring, "faces");
  assert.equal(cube.lockFaces, true);
  const plain = configFromSetup({ ...DEFAULT_SETUP, variant: "cube", mode: "local" });
  assert.deepEqual([plain.scoring, plain.lockFaces], ["lines", false]);
  for (const variant of ["classic", "ultimate"] as const) {
    const config = configFromSetup({ ...DEFAULT_SETUP, variant, mode: "local", scoring: "faces", lockFaces: true });
    assert.deepEqual([config.scoring, config.lockFaces], ["lines", false], variant);
  }
});

test("the Cube options do not change which controls show or which opponents exist", () => {
  const state = { ...DEFAULT_SETUP, variant: "cube", scoring: "faces", lockFaces: true } as const;
  assert.deepEqual(modesFor("cube"), ["local", "network"]);
  assert.equal(seedControlsVisible({ ...state, mode: "local" }), false);
  assert.equal(seedControlsVisible({ ...DEFAULT_SETUP, mode: "computer" }), true);
  assert.equal(chooseVariant(state, "classic").scoring, "faces", "the choice is remembered, only the config forces it off");
});
