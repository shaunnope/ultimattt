import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { markGlyph, setGlyphs } from "../../src/ui/glyph.ts";
import { cubeStatus } from "../../src/ui/cube-labels.ts";
import { describeMove } from "../../src/ui/replay-text.ts";
import { recordFromGame, packLink } from "../../src/core/record.ts";
import { defaultSave, savedGameFrom, serializeSave } from "../../src/adapters/store.ts";
import { DEFAULT_SETTINGS } from "../../src/core/settings.ts";
import { newGame as newCube, apply as applyCube } from "../../src/core/cube.ts";
import type { CubeMove, GameConfig, Move } from "../../src/core/types.ts";

const ICONS = { X: "★", O: "●" };
beforeEach(() => setGlyphs({ X: "X", O: "O" }));

const classic: GameConfig = { variant: "classic", size: 3, mode: "local", seed: "3X3-BXK4-M9TR" };
const cube: GameConfig = { variant: "cube", size: 3, mode: "local", seed: "CUB-BXK4-M9TR" };
const place = (cell: number): Move => ({ t: "place", cell });

test("by default the marks are drawn as X and O", () => {
  assert.equal(markGlyph("X"), "X");
  assert.equal(markGlyph("O"), "O");
});

test("chosen icons replace the letters everywhere text names a mark", () => {
  setGlyphs(ICONS);
  assert.equal(markGlyph("X"), "★");
  assert.equal(markGlyph("O"), "●");
  assert.equal(cubeStatus(newCube(cube)), "★ to move.");
  const moves: CubeMove[] = [{ t: "place", face: 2, cell: 4 }];
  assert.equal(cubeStatus(applyCube(newCube(cube), moves[0]!)), "● to move.");
  assert.equal(describeMove(classic, place(0), "O", 2), "2. ●: row 1, column 1");
});

test("icons that are not valid are ignored", () => {
  setGlyphs({ X: "ab", O: "O" });
  assert.equal(markGlyph("X"), "X");
  setGlyphs({ X: "A", O: "a" });
  assert.equal(markGlyph("O"), "O");
});

test("icons never reach a game record, a share link, a seed or the saved game", () => {
  setGlyphs(ICONS);
  const moves = [0, 4, 8].map(place);
  const record = recordFromGame(classic, moves);
  for (const text of [JSON.stringify(record), packLink(record, 1), decodeURIComponent(packLink(record, 1)), JSON.stringify(savedGameFrom(classic, moves, 1)), classic.seed]) {
    assert.ok(!text.includes("★") && !text.includes("●"), text);
  }
  assert.ok(!("icons" in classic));
  const save = { ...defaultSave(), settings: { ...DEFAULT_SETTINGS, icons: ICONS }, game: savedGameFrom(classic, moves, 1) };
  const parsed = JSON.parse(serializeSave(save));
  assert.deepEqual(parsed.settings.icons, ICONS); // a display preference, kept with the other settings
  assert.ok(!JSON.stringify(parsed.game).includes("★"));
});
