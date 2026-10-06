import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveMode, loadModePref, normaliseMode, themeToMode, modeToTheme, cssColourToHex, MODE_KEY, LEGACY_THEME_KEY } from "../../src/ui/theme.ts";
import { resetStorageForTests, storageGet, storageSet } from "../../src/adapters/storage.ts";

beforeEach(() => resetStorageForTests());
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  resetStorageForTests();
});

test("system follows the device; light and dark are fixed", () => {
  assert.equal(resolveMode("system", true), "dark");
  assert.equal(resolveMode("system", false), "light");
  assert.equal(resolveMode("light", true), "light");
  assert.equal(resolveMode("dark", false), "dark");
});

test("anything else, including nothing, behaves like system", () => {
  assert.equal(resolveMode("blue", true), "dark");
  assert.equal(resolveMode("", false), "light");
  assert.equal(resolveMode(null, true), "dark");
  assert.equal(resolveMode("auto", true), "dark");
});

test("normaliseMode keeps light, dark and system and turns everything else into system", () => {
  assert.equal(normaliseMode("light"), "light");
  assert.equal(normaliseMode("dark"), "dark");
  assert.equal(normaliseMode("system"), "system");
  assert.equal(normaliseMode("auto"), "system");
  assert.equal(normaliseMode("blue"), "system");
  assert.equal(normaliseMode(null), "system");
  assert.equal(normaliseMode(undefined), "system");
});

test("the saved game's theme maps to a mode and back (auto is system)", () => {
  assert.equal(themeToMode("auto"), "system");
  assert.equal(themeToMode("light"), "light");
  assert.equal(themeToMode("dark"), "dark");
  assert.equal(modeToTheme("system"), "auto");
  assert.equal(modeToTheme("light"), "light");
  assert.equal(modeToTheme("dark"), "dark");
});

test("loadModePref returns the stored preference", () => {
  storageSet(MODE_KEY, "dark");
  assert.equal(loadModePref(), "dark");
  storageSet(MODE_KEY, "light");
  assert.equal(loadModePref(), "light");
  storageSet(MODE_KEY, "system");
  assert.equal(loadModePref(), "system");
});

test("with nothing stored the preference is system", () => {
  assert.equal(loadModePref(), "system");
});

test("a legacy ttt.theme choice moves to ttt.mode (auto becomes system) and the old key is removed", () => {
  for (const [legacy, expected] of [["auto", "system"], ["light", "light"], ["dark", "dark"]] as const) {
    resetStorageForTests();
    storageSet(LEGACY_THEME_KEY, legacy);
    assert.equal(loadModePref(), expected);
    assert.equal(storageGet(MODE_KEY), expected);
    assert.equal(storageGet(LEGACY_THEME_KEY), null);
  }
});

test("ttt.mode wins over a legacy key, and the legacy key is still removed", () => {
  storageSet(MODE_KEY, "light");
  storageSet(LEGACY_THEME_KEY, "dark");
  assert.equal(loadModePref(), "light");
  assert.equal(storageGet(LEGACY_THEME_KEY), null);
});

test("a corrupt stored value reads as system", () => {
  storageSet(MODE_KEY, "blue");
  assert.equal(loadModePref(), "system");
  resetStorageForTests();
  storageSet(LEGACY_THEME_KEY, "purple");
  assert.equal(loadModePref(), "system");
});

test("a storage that throws never breaks loading", () => {
  const boom = () => {
    throw new Error("blocked");
  };
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: boom, setItem: boom, removeItem: boom };
  assert.equal(loadModePref(), "system");
});

test("cssColourToHex reads the forms getComputedStyle gives", () => {
  assert.equal(cssColourToHex("rgb(243, 242, 240)"), "#f3f2f0");
  assert.equal(cssColourToHex("rgba(37, 40, 48, 1)"), "#252830");
  assert.equal(cssColourToHex("color(srgb 0.9529 0.949 0.9412)"), "#f3f2f0");
  assert.equal(cssColourToHex("#ABCDEF"), "#abcdef");
  assert.equal(cssColourToHex("not a colour"), null);
});
