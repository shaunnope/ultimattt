import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_KEY, BACKUP_KEY, parseSave, serializeSave, defaultSave, loadSave, writeSave, savedGameFrom,
  type SaveFile,
} from "../../src/adapters/store.ts";
import { restoreGame } from "../../src/adapters/restore.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/core/settings.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { encodeMoves } from "../../src/core/record.ts";
import { storageGet, storageSet, storageRemove, resetStorageForTests } from "../../src/adapters/storage.ts";
import type { GameConfig, Move } from "../../src/core/types.ts";

const g = globalThis as unknown as { localStorage?: unknown };
beforeEach(() => {
  delete g.localStorage;
  resetStorageForTests();
});

const classic: GameConfig = { variant: "classic", size: 3, mode: "computer", level: 3, humanMark: "X", seed: "3X3-BXK4-M9TR" };
const place = (cell: number): Move => ({ t: "place", cell });

test("nothing saved, or an empty value, gives the defaults", () => {
  for (const text of [null, ""]) {
    const result = parseSave(text);
    assert.ok(result.ok);
    if (result.ok) assert.deepEqual(result.save, defaultSave());
  }
  assert.equal(defaultSave().schema, 1);
  assert.equal(defaultSave().game, null);
  assert.deepEqual(defaultSave().settings, DEFAULT_SETTINGS);
});

test("a save round-trips, and the game is rebuilt by playing its moves through the rules", () => {
  const cases: { config: GameConfig; moves: Move[] }[] = [
    { config: classic, moves: [0, 4, 8].map(place) },
    { config: { variant: "ultimate", size: 3, mode: "local", seed: "ULT-BXK4-M9TR" }, moves: [{ t: "place", board: 4, cell: 2 }, { t: "place", board: 2, cell: 0 }] },
    { config: { variant: "cube", size: 3, mode: "local", seed: "CUB-BXK4-M9TR" }, moves: [{ t: "place", face: 2, cell: 0 }, { t: "place", face: 0, cell: 0 }, { t: "place", face: 2, cell: 1 }, { t: "place", face: 0, cell: 1 }, { t: "place", face: 2, cell: 2 }, { t: "rotate", axis: "y", layer: 0, dir: 1 }] },
  ];
  for (const { config, moves } of cases) {
    const save: SaveFile = { ...defaultSave(), game: savedGameFrom(config, moves, 1234) };
    const result = parseSave(serializeSave(save));
    assert.ok(result.ok);
    if (!result.ok) continue;
    assert.deepEqual(result.save, save);
    const restored = restoreGame(result.save.game!);
    assert.ok(restored);
    assert.deepEqual(restored!.state, fromMoves(config, moves));
    assert.equal(result.save.game!.moves, encodeMoves(config.variant, moves));
  }
});

test("a resignation is saved and restored", () => {
  const save: SaveFile = { ...defaultSave(), game: { ...savedGameFrom(classic, [0, 4].map(place), 1), resigned: "O" } };
  const result = parseSave(serializeSave(save));
  assert.ok(result.ok);
  if (result.ok) assert.equal(restoreGame(result.save.game!)!.resigned, "O");
});

test("an unknown schema is refused rather than guessed at", () => {
  const result = parseSave(JSON.stringify({ schema: 99, whatever: true }));
  assert.deepEqual(result, { ok: false, reason: "unknown-schema" });
});

test("corrupt text is refused", () => {
  for (const text of ["{oops", "[]", "42", "null", '"x"']) {
    const result = parseSave(text);
    assert.equal(result.ok, false, text);
  }
});

test("loading an unknown schema or corrupt save starts fresh, says so, and keeps the old text", () => {
  for (const raw of [JSON.stringify({ schema: 99, x: 1 }), "{oops"]) {
    storageRemove(BACKUP_KEY);
    storageSet(SAVE_KEY, raw);
    const { save, notice } = loadSave();
    assert.deepEqual(save, defaultSave());
    assert.ok(notice && notice.length > 0);
    // The first write after that must not destroy what was there.
    writeSave({ ...defaultSave(), settings: { ...DEFAULT_SETTINGS, hints: true } });
    assert.equal(storageGet(BACKUP_KEY), raw);
    assert.equal(parseSave(storageGet(SAVE_KEY)).ok, true);
  }
});

test("a good save loads with no notice, and writes survive a reload", () => {
  const save: SaveFile = { ...defaultSave(), settings: { ...DEFAULT_SETTINGS, hints: true, theme: "dark" }, game: savedGameFrom(classic, [0, 4].map(place), 99) };
  writeSave(save);
  const loaded = loadSave();
  assert.equal(loaded.notice, undefined);
  assert.deepEqual(loaded.save, save);
});

test("a tampered game (illegal moves, bad config) is dropped but the settings are kept", () => {
  const settings = { ...DEFAULT_SETTINGS, hints: true };
  const tamperedMoves = { schema: 1, settings, game: { config: classic, moves: "00", startedAt: 1 } };
  const parsed = parseSave(JSON.stringify(tamperedMoves));
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.save.settings.hints, true);
    assert.equal(restoreGame(parsed.save.game!), null);
  }
  const badConfig = { schema: 1, settings, game: { config: { variant: "foo", size: 3, mode: "local", seed: "x" }, moves: "", startedAt: 1 } };
  const parsed2 = parseSave(JSON.stringify(badConfig));
  assert.ok(parsed2.ok);
  if (parsed2.ok) {
    assert.equal(parsed2.save.game, null);
    assert.equal(parsed2.save.settings.hints, true);
  }
});

test("settings are normalised: anything invalid falls back to its default", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings("junk"), DEFAULT_SETTINGS);
  const s = normalizeSettings({ hints: "yes", autoReplay: 0, replaySpeed: 3, theme: "x", icons: { X: "ab", O: "O" } });
  assert.equal(s.hints, false);
  assert.equal(s.autoReplay, DEFAULT_SETTINGS.autoReplay);
  assert.equal(s.replaySpeed, 1);
  assert.equal(s.theme, "auto");
  assert.deepEqual(s.icons, DEFAULT_SETTINGS.icons);
  const ok = normalizeSettings({ hints: true, autoReplay: false, replaySpeed: 4, theme: "dark", icons: { X: "★", O: "●" } });
  assert.deepEqual(ok, { hints: true, autoReplay: false, replaySpeed: 4, theme: "dark", icons: { X: "★", O: "●" }, lastSetup: null });
});

test("by default hints are off", () => {
  assert.equal(DEFAULT_SETTINGS.hints, false);
  assert.equal(DEFAULT_SETTINGS.autoReplay, true);
  assert.equal(DEFAULT_SETTINGS.replaySpeed, 1);
  assert.equal(DEFAULT_SETTINGS.theme, "auto");
  assert.deepEqual(DEFAULT_SETTINGS.icons, { X: "X", O: "O" });
});

test("the last start-screen choices are kept in settings, and anything off about them is dropped whole", () => {
  assert.equal(DEFAULT_SETTINGS.lastSetup, null);
  const choice = { variant: "ultimate", size: 4, mode: "local", level: 5, markChoice: "O" };
  assert.deepEqual(normalizeSettings({ lastSetup: choice }).lastSetup, choice);
  for (const bad of [{ ...choice, variant: "x" }, { ...choice, size: 7 }, { ...choice, mode: "bad" }, { ...choice, level: 9 }, { ...choice, markChoice: "Z" }, "junk", 5, { variant: "classic" }]) {
    assert.equal(normalizeSettings({ lastSetup: bad }).lastSetup, null, JSON.stringify(bad));
  }
});

test("the last choices survive a save and a load", () => {
  const choice = { variant: "cube", size: 3, mode: "network", level: 3, markChoice: "random" } as const;
  const save: SaveFile = { ...defaultSave(), settings: { ...DEFAULT_SETTINGS, lastSetup: choice } };
  writeSave(save);
  assert.deepEqual(loadSave().save.settings.lastSetup, choice);
});
