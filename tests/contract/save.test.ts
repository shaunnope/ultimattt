import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SAVE_KEY, BACKUP_KEY, parseSave, serializeSave, defaultSave, loadSave, writeSave, savedGameFrom, migrate1to2, migrate2to3,
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

const classic: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 3, humanMark: "X", seed: "C33-BXK4-M9TR" };
const place = (cell: number): Move => ({ t: "place", cell });

test("nothing saved, or an empty value, gives the defaults", () => {
  for (const text of [null, ""]) {
    const result = parseSave(text);
    assert.ok(result.ok);
    if (result.ok) assert.deepEqual(result.save, defaultSave());
  }
  assert.equal(defaultSave().schema, 3);
  assert.equal(defaultSave().game, null);
  assert.deepEqual(defaultSave().settings, DEFAULT_SETTINGS);
});

test("a save round-trips, and the game is rebuilt by playing its moves through the rules", () => {
  const cases: { config: GameConfig; moves: Move[] }[] = [
    { config: classic, moves: [0, 4, 8].map(place) },
    { config: { variant: "ultimate", size: 4, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" }, moves: [{ t: "place", board: 4, cell: 2 }, { t: "place", board: 2, cell: 0 }] },
    { config: { variant: "cube", size: 5, winLength: 4, scoring: "lines", lockFaces: false, mode: "local" }, moves: [{ t: "place", face: 2, cell: 24 }, { t: "place", face: 0, cell: 0 }] },
    { config: { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: true, mode: "local" }, moves: [{ t: "place", face: 2, cell: 0 }, { t: "place", face: 0, cell: 0 }, { t: "place", face: 2, cell: 1 }, { t: "place", face: 0, cell: 1 }, { t: "place", face: 2, cell: 2 }, { t: "rotate", axis: "y", layer: 0, dir: 1 }] },
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
  const tamperedMoves = { schema: 2, settings, game: { config: classic, moves: "00", startedAt: 1 } };
  const parsed = parseSave(JSON.stringify(tamperedMoves));
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.save.settings.hints, true);
    assert.equal(restoreGame(parsed.save.game!), null);
  }
  const badConfig = { schema: 2, settings, game: { config: { variant: "foo", size: 3, winLength: 3, mode: "local" }, moves: "", startedAt: 1 } };
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
  const s = normalizeSettings({ hints: "yes", autoReplay: 0, replaySpeed: 3, theme: "x", markPalette: "neon", cubeNotation: "?" });
  assert.equal(s.hints, false);
  assert.equal(s.autoReplay, DEFAULT_SETTINGS.autoReplay);
  assert.equal(s.replaySpeed, 1);
  assert.equal(s.theme, "auto");
  assert.equal(s.markPalette, "default");
  assert.equal(s.cubeNotation, "words");
  const ok = normalizeSettings({ hints: true, autoReplay: false, replaySpeed: 4, theme: "dark", markPalette: "forest", cubeNotation: "cube" });
  assert.deepEqual(ok, { hints: true, autoReplay: false, replaySpeed: 4, theme: "dark", markPalette: "forest", cubeNotation: "cube", lastSetup: null });
});

test("by default hints are off", () => {
  assert.equal(DEFAULT_SETTINGS.hints, false);
  assert.equal(DEFAULT_SETTINGS.autoReplay, true);
  assert.equal(DEFAULT_SETTINGS.replaySpeed, 1);
  assert.equal(DEFAULT_SETTINGS.theme, "auto");
  assert.equal(DEFAULT_SETTINGS.markPalette, "default");
  assert.equal(DEFAULT_SETTINGS.cubeNotation, "words");
});

test("the last start-screen choices are kept in settings, and anything off about them is dropped whole", () => {
  assert.equal(DEFAULT_SETTINGS.lastSetup, null);
  const choice = { variant: "ultimate", size: 4, winLength: 3, scoring: "lines", lockFaces: false, mode: "local", level: 5, markChoice: "O" };
  assert.deepEqual(normalizeSettings({ lastSetup: choice }).lastSetup, choice);
  const { scoring: _s, lockFaces: _l, ...old } = choice;
  assert.deepEqual(normalizeSettings({ lastSetup: old }).lastSetup, choice, "a stored choice without the options means lines and no lock");
  for (const bad of [{ ...choice, variant: "x" }, { ...choice, size: 7 }, { ...choice, mode: "bad" }, { ...choice, level: 9 }, { ...choice, markChoice: "Z" }, "junk", 5, { variant: "classic" }]) {
    assert.equal(normalizeSettings({ lastSetup: bad }).lastSetup, null, JSON.stringify(bad));
  }
});

test("the last choices survive a save and a load", () => {
  const choice = { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: true, mode: "network", level: 3, markChoice: "random" } as const;
  const save: SaveFile = { ...defaultSave(), settings: { ...DEFAULT_SETTINGS, lastSetup: choice } };
  writeSave(save);
  assert.deepEqual(loadSave().save.settings.lastSetup, choice);
});

test("a hosted game keeps its host code, and a joined game keeps its join code, never both", () => {
  const net: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "network", humanMark: "X" };
  const hosted = savedGameFrom(net, [place(0)], 1, undefined, "BCD234");
  assert.equal(hosted.hostCode, "BCD234");
  assert.equal(hosted.joinCode, undefined);
  const joined = savedGameFrom(net, [place(0)], 1, undefined, undefined, "bcd234");
  assert.equal(joined.joinCode, "bcd234");
  assert.equal(joined.hostCode, undefined);
  assert.equal(savedGameFrom(net, [], 1, undefined, "BCD234", "XYZ789").joinCode, undefined);

  writeSave({ ...defaultSave(), game: joined });
  assert.equal(loadSave().save.game?.joinCode, "BCD234"); // read back in its normal form
  writeSave({ ...defaultSave(), game: hosted });
  assert.equal(loadSave().save.game?.hostCode, "BCD234");
  assert.equal(loadSave().save.game?.joinCode, undefined);
});

test("a join code that is not a code is dropped, and a game saved without one has none", () => {
  const net: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "network", humanMark: "X" };
  const raw = (extra: object) => JSON.stringify({ schema: 2, settings: {}, game: { config: net, moves: "", startedAt: 1, ...extra } });
  for (const bad of ["", "abc", "ABC 23", 5, null]) {
    const result = parseSave(raw({ joinCode: bad }));
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.save.game?.joinCode, undefined, JSON.stringify(bad));
  }
  const none = parseSave(raw({}));
  assert.ok(none.ok);
  if (none.ok) assert.equal(none.save.game?.joinCode, undefined);
});

// ---- schema 1 saves (001) and the migration to schema 2 ----

const fixture = (name: string): string => readFileSync(new URL(`../fixtures/001/${name}`, import.meta.url), "utf8");

test("every 001 save in the fixtures loads, plays on and is written back as schema 3", () => {
  for (const name of ["save-classic3.json", "save-classic5.json", "save-ultimate.json", "save-cube.json", "save-icons.json"]) {
    const result = parseSave(fixture(name));
    assert.ok(result.ok, name);
    if (!result.ok) continue;
    assert.equal(result.save.schema, 3, name);
    assert.ok(result.save.game, name);
    const restored = restoreGame(result.save.game!);
    assert.ok(restored, name);
    // and the game carries on: any legal move is accepted
    const state = restored!.state;
    assert.ok(state.moves.length > 0, name);
    const again = parseSave(serializeSave(result.save));
    assert.ok(again.ok, name);
    if (again.ok) assert.deepEqual(again.save, result.save, name);
  }
});

test("migration gives each 001 game the win length it implied, and drops seeds from games without a computer", () => {
  const classic3 = parseSave(fixture("save-classic3.json"));
  const classic5 = parseSave(fixture("save-classic5.json"));
  const ultimate = parseSave(fixture("save-ultimate.json"));
  assert.ok(classic3.ok && classic5.ok && ultimate.ok);
  if (!(classic3.ok && classic5.ok && ultimate.ok)) return;
  assert.equal(classic3.save.game!.config.winLength, 3);
  assert.equal(classic3.save.game!.config.seed, "3X3-BXK4-M9TR"); // computer game: seed kept
  assert.equal(classic5.save.game!.config.winLength, 4);
  assert.equal(classic5.save.game!.config.mode, "local");
  assert.ok(!("seed" in classic5.save.game!.config));
  assert.equal(ultimate.save.game!.config.winLength, 3);
  assert.ok(!("seed" in ultimate.save.game!.config));
});

test("migrating drops custom icons and adds the palette and notation; other settings stay", () => {
  const result = parseSave(fixture("save-icons.json"));
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.ok(!("icons" in result.save.settings));
  assert.equal(result.save.settings.markPalette, "default");
  assert.equal(result.save.settings.cubeNotation, "words");
  assert.equal(result.save.settings.theme, "dark");
  assert.ok(!serializeSave(result.save).includes("🐱"));
});

test("migrate1to2 is pure and adds winLength to lastSetup", () => {
  const input = {
    schema: 1,
    settings: { hints: true, icons: { X: "a", O: "b" }, lastSetup: { variant: "classic", size: 5, mode: "local", level: 3, markChoice: "random" } },
    game: { config: { variant: "ultimate", size: 3, mode: "network", seed: "ULT-BXK4-M9TR" }, moves: "", startedAt: 1 },
  };
  const before = JSON.stringify(input);
  const out = migrate1to2(input) as { schema: number; settings: Record<string, unknown>; game: { config: Record<string, unknown> } };
  assert.equal(JSON.stringify(input), before);
  assert.equal(out.schema, 2);
  assert.equal(out.settings.hints, true);
  assert.equal((out.settings.lastSetup as { winLength: number }).winLength, 4);
  assert.equal(out.game.config.winLength, 3);
  assert.ok(!("seed" in out.game.config));
  assert.deepEqual(migrate1to2({ schema: 1, settings: {}, game: null }).game, null);
});

test("a schema newer than 3 is kept untouched, the game starts fresh and a notice is shown", () => {
  const raw = JSON.stringify({ schema: 4, settings: {}, game: null, future: true });
  storageRemove(BACKUP_KEY);
  storageSet(SAVE_KEY, raw);
  const { save, notice } = loadSave();
  assert.deepEqual(save, defaultSave());
  assert.ok(notice);
  assert.equal(storageGet(BACKUP_KEY), raw);
  assert.equal(storageGet(SAVE_KEY), raw, "reading never overwrites the file");
});

test("a save that cannot be migrated behaves like an unknown schema", () => {
  const poisoned = { schema: 1, get settings(): never { throw new Error("cannot read"); } };
  assert.throws(() => migrate1to2(poisoned as unknown as Record<string, unknown>));
  const storage = JSON.stringify({ schema: 1, settings: 5, game: 7 });
  const result = parseSave(storage);
  assert.ok(result.ok); // odd shapes are tolerated and repaired to defaults
  if (result.ok) assert.deepEqual(result.save, defaultSave());
});

// ---- schema 2 saves (002) and the migration to schema 3 ----

const fixture2 = (name: string): string => readFileSync(new URL(`../fixtures/002/${name}`, import.meta.url), "utf8");

test("a schema 2 save migrates to schema 3 with lines scoring and no lock", () => {
  const result = parseSave(fixture2("save-cube.json"));
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.save.schema, 3);
  assert.equal(result.save.game!.config.scoring, "lines");
  assert.equal(result.save.game!.config.lockFaces, false);
  const restored = restoreGame(result.save.game!);
  assert.ok(restored);
  assert.ok(restored!.state.moves.length > 0);

  const setup = parseSave(fixture2("save-setup.json"));
  assert.ok(setup.ok);
  if (!setup.ok) return;
  assert.equal(setup.save.settings.lastSetup?.scoring, "lines");
  assert.equal(setup.save.settings.lastSetup?.lockFaces, false);
  assert.equal(setup.save.settings.lastSetup?.size, 4);
  assert.equal(setup.save.settings.lastSetup?.winLength, 3);
});

test("migrate2to3 is pure and adds the two options to the game and the remembered setup", () => {
  const input = {
    schema: 2,
    settings: { hints: true, lastSetup: { variant: "cube", size: 4, winLength: 3, mode: "local", level: 3, markChoice: "X" } },
    game: { config: { variant: "cube", size: 4, winLength: 3, mode: "local" }, moves: "", startedAt: 1 },
  };
  const before = JSON.stringify(input);
  const out = migrate2to3(input) as { schema: number; settings: { hints: boolean; lastSetup: Record<string, unknown> }; game: { config: Record<string, unknown> } };
  assert.equal(JSON.stringify(input), before);
  assert.equal(out.schema, 3);
  assert.equal(out.settings.hints, true);
  assert.equal(out.settings.lastSetup.scoring, "lines");
  assert.equal(out.settings.lastSetup.lockFaces, false);
  assert.equal(out.game.config.scoring, "lines");
  assert.equal(out.game.config.lockFaces, false);
  assert.equal(migrate2to3({ schema: 2, settings: {}, game: null }).game, null);
});

test("schema 1 still migrates through 2 to 3", () => {
  const result = parseSave(fixture("save-cube.json"));
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual([result.save.schema, result.save.game!.config.scoring, result.save.game!.config.lockFaces], [3, "lines", false]);
});

test("a schema 3 save with both options round-trips, and a game with them on a non-Cube variant is dropped", () => {
  const cube: GameConfig = { variant: "cube", size: 4, winLength: 3, scoring: "faces", lockFaces: true, mode: "local" };
  const save: SaveFile = { ...defaultSave(), game: savedGameFrom(cube, [{ t: "place", face: 1, cell: 3 }], 5) };
  const back = parseSave(serializeSave(save));
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.save, save);
  const bad = parseSave(JSON.stringify({ schema: 3, settings: {}, game: { config: { ...classic, lockFaces: true }, moves: "", startedAt: 1 } }));
  assert.ok(bad.ok);
  if (bad.ok) assert.equal(bad.save.game, null);
});

test("schema 4 is refused as unknown", () => {
  assert.deepEqual(parseSave(JSON.stringify({ schema: 4, settings: {}, game: null })), { ok: false, reason: "unknown-schema" });
});

// ---- the default win length changed in 003; saved data must not feel it ----

test("a 001 or 002 save with no win length still resolves through the legacy table, never the new default", () => {
  const config = (variant: string, size: number) => ({ variant, size, mode: "local" });
  for (const [variant, size, expected] of [["ultimate", 4, 3], ["ultimate", 5, 3], ["cube", 4, 3], ["cube", 5, 3], ["classic", 4, 4], ["classic", 5, 4], ["classic", 3, 3]] as const) {
    for (const schema of [1, 2]) {
      const result = parseSave(JSON.stringify({ schema, settings: {}, game: { config: config(variant, size), moves: "", startedAt: 1 } }));
      assert.ok(result.ok);
      if (result.ok) assert.equal(result.save.game?.config.winLength, expected, `${variant} ${size} schema ${schema}`);
    }
  }
});

test("a saved win length is kept exactly, whatever the new default for that size would be", () => {
  const raw = { schema: 2, settings: {}, game: { config: { variant: "ultimate", size: 5, winLength: 5, mode: "local" }, moves: "", startedAt: 1 } };
  const result = parseSave(JSON.stringify(raw));
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.save.game?.config.winLength, 5);
});
