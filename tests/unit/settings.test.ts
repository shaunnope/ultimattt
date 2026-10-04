import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeSettings, normalizeSetup } from "../../src/core/settings.ts";

test("defaults: default palette, words for turns, nothing remembered", () => {
  const s = normalizeSettings(undefined);
  assert.equal(s.markPalette, "default");
  assert.equal(s.cubeNotation, "words");
  assert.equal(s.lastSetup, null);
  assert.deepEqual(s, DEFAULT_SETTINGS);
  assert.ok(!("icons" in s));
});

test("a known palette id is kept; an unknown or missing one falls back to the default", () => {
  for (const id of ["default", "cbsafe", "forest", "sunset"]) assert.equal(normalizeSettings({ markPalette: id }).markPalette, id);
  for (const bad of ["neon", "", 5, null, {}]) assert.equal(normalizeSettings({ markPalette: bad }).markPalette, "default");
  assert.equal(normalizeSettings({}).markPalette, "default");
});

test("stored 001 icons and any stored colours are ignored", () => {
  const s = normalizeSettings({ icons: { X: "🐱", O: "🐶" }, markColors: { X: "#ff0000", O: "#00ff00" }, hints: true });
  assert.ok(!("icons" in s));
  assert.ok(!("markColors" in s));
  assert.equal(s.hints, true);
  assert.equal(s.markPalette, "default");
});

test("cube notation is words or cube, and anything else is words", () => {
  assert.equal(normalizeSettings({ cubeNotation: "cube" }).cubeNotation, "cube");
  assert.equal(normalizeSettings({ cubeNotation: "words" }).cubeNotation, "words");
  for (const bad of ["fancy", 1, null]) assert.equal(normalizeSettings({ cubeNotation: bad }).cubeNotation, "words");
});

test("lastSetup keeps a valid win length for its size", () => {
  const base = { variant: "classic", size: 5, mode: "local", level: 3, markChoice: "random" };
  assert.equal(normalizeSetup({ ...base, winLength: 3 })?.winLength, 3);
  assert.equal(normalizeSetup({ ...base, winLength: 5 })?.winLength, 5);
});

test("lastSetup repairs a win length that does not fit its size or is missing", () => {
  const base = { variant: "classic", size: 3, mode: "local", level: 3, markChoice: "random" };
  assert.equal(normalizeSetup({ ...base, winLength: 5 })?.winLength, 3);
  assert.equal(normalizeSetup({ ...base, size: 5, variant: "ultimate", winLength: 2 })?.winLength, 3);
  assert.equal(normalizeSetup({ ...base, size: 5 })?.winLength, 4);
  assert.equal(normalizeSetup({ ...base, size: 4, variant: "cube", winLength: "x" })?.winLength, 3);
});

test("lastSetup is still null for anything else that is off", () => {
  const ok = { variant: "classic", size: 3, winLength: 3, mode: "local", level: 3, markChoice: "X" };
  assert.ok(normalizeSetup(ok));
  for (const patch of [{ variant: "x" }, { mode: "x" }, { size: 6 }, { level: 0 }, { markChoice: "Z" }]) assert.equal(normalizeSetup({ ...ok, ...patch }), null);
  assert.equal(normalizeSetup(null), null);
  assert.equal(normalizeSetup("x"), null);
});

test("the last choices survive a round trip", () => {
  const setup = { variant: "ultimate", size: 4, winLength: 3, mode: "computer", level: 4, markChoice: "O" } as const;
  assert.deepEqual(normalizeSettings({ lastSetup: setup }).lastSetup, setup);
});
