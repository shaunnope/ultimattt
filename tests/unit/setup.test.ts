import { test } from "node:test";
import assert from "node:assert/strict";
import { configFromSetup, modesFor, DEFAULT_SETUP, initialSetup } from "../../src/ui/setup.ts";
import { parseSeed, pickMark } from "../../src/core/seed.ts";

test("every variant can be played with a friend on this device or on another; only Classic and Ultimate have a computer", () => {
  assert.deepEqual(modesFor("cube"), ["local", "network"]);
  assert.deepEqual(modesFor("classic"), ["computer", "local", "network"]);
  assert.deepEqual(modesFor("ultimate"), ["computer", "local", "network"]);
});

test("a two-device game is set up by its host: a mark and a seed, no level", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, variant: "ultimate", mode: "network", markChoice: "O" }, "ULT-BXK4-M9TR");
  assert.equal(config.mode, "network");
  assert.equal(config.humanMark, "O");
  assert.equal(config.level, undefined);
  const decided = configFromSetup({ ...DEFAULT_SETUP, mode: "network", markChoice: "random" }, "3X3-BXK4-M9TR");
  assert.equal(decided.humanMark, pickMark("3X3-BXK4-M9TR"));
  assert.equal(configFromSetup({ ...DEFAULT_SETUP, variant: "cube", mode: "network" }).mode, "network");
});

test("a computer game gets a level, a mark and a seed matching the variant and size", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, variant: "classic", size: 4, mode: "computer", level: 5, markChoice: "O" });
  assert.equal(config.variant, "classic");
  assert.equal(config.size, 4);
  assert.equal(config.level, 5);
  assert.equal(config.humanMark, "O");
  const parsed = parseSeed(config.seed);
  assert.ok(!("error" in parsed) && parsed.variant === "classic" && parsed.size === 4);
});

test("letting the game decide uses the seed to pick the mark", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, markChoice: "random" }, "3X3-BXK4-M9TR");
  assert.equal(config.humanMark, pickMark("3X3-BXK4-M9TR"));
});

test("a local game has no level or human mark", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, mode: "local" });
  assert.equal(config.mode, "local");
  assert.equal(config.level, undefined);
  assert.equal(config.humanMark, undefined);
});

test("cube ignores a computer choice and ignores board size", () => {
  const config = configFromSetup({ ...DEFAULT_SETUP, variant: "cube", mode: "computer", size: 5 });
  assert.equal(config.mode, "local");
  assert.equal(config.size, 3);
  assert.equal(config.level, undefined);
});

test("with nothing remembered the start screen opens on the defaults", () => {
  assert.deepEqual(initialSetup(null), DEFAULT_SETUP);
});

test("remembered choices are what the start screen opens on", () => {
  const saved = { variant: "ultimate", size: 4, mode: "local", level: 5, markChoice: "O" } as const;
  assert.deepEqual(initialSetup(saved), saved);
});

test("a remembered opponent the variant no longer offers is replaced by the first one it does", () => {
  const saved = { variant: "cube", size: 3, mode: "computer", level: 2, markChoice: "X" } as const;
  assert.equal(initialSetup(saved).mode, "local");
  assert.equal(initialSetup(saved).level, 2);
});
