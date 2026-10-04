import { test } from "node:test";
import assert from "node:assert/strict";
import { replayFrames } from "../../src/core/replay.ts";
import { describeMove } from "../../src/ui/replay-text.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { recordFromGame, configFromRecord, packLink, unpackLink } from "../../src/core/record.ts";
import { applySeedToSetup, DEFAULT_SETUP } from "../../src/ui/setup.ts";
import type { CubeMove, GameConfig, Move } from "../../src/core/types.ts";

const classic: GameConfig = { variant: "classic", size: 3, winLength: 3, mode: "local" };
const cube: GameConfig = { variant: "cube", size: 3, winLength: 3, mode: "local" };
const place = (cell: number): Move => ({ t: "place", cell });
const CUBE_MOVES: CubeMove[] = [
  { t: "place", face: 2, cell: 0 }, { t: "place", face: 0, cell: 0 }, { t: "place", face: 2, cell: 1 },
  { t: "place", face: 0, cell: 1 }, { t: "place", face: 2, cell: 2 }, { t: "rotate", axis: "y", layer: 0, dir: 1 },
];

test("a replay has one frame before any move and one after each move, each equal to playing the moves", () => {
  const moves = [0, 3, 1, 4, 2].map(place);
  const frames = replayFrames(classic, moves);
  assert.equal(frames.length, 6);
  frames.forEach((frame, i) => assert.deepEqual(frame.state, fromMoves(classic, moves.slice(0, i))));
});

test("each frame says who made the move that led to it", () => {
  const frames = replayFrames(classic, [0, 3, 1].map(place));
  assert.deepEqual(frames.map((f) => f.mover), [null, "X", "O", "X"]);
});

test("in the Cube the same player places a scoring mark and then turns a layer", () => {
  const frames = replayFrames(cube, CUBE_MOVES);
  assert.equal(frames.length, 7);
  assert.deepEqual(frames.map((f) => f.mover), [null, "X", "O", "X", "O", "X", "X"]);
});

test("moves are described in words, per variant", () => {
  assert.equal(describeMove(classic, place(5), "X", 3), "3. X: row 2, column 3");
  const ultimate: GameConfig = { variant: "ultimate", size: 3, winLength: 3, mode: "local" };
  assert.equal(describeMove(ultimate, { t: "place", board: 4, cell: 2 }, "O", 2), "2. O: centre board, row 1, column 3");
  assert.equal(describeMove(cube, { t: "place", face: 2, cell: 4 }, "X", 1), "1. X: front face, row 2, column 2");
  assert.equal(describeMove(cube, { t: "rotate", axis: "y", layer: 2, dir: 1 }, "X", 6), "6. X: turn the top layer to the right");
  assert.equal(describeMove(cube, { t: "rotate", axis: "x", layer: 0, dir: 2 }, "O", 8), "8. O: half turn the left layer");
});

test("a finished game becomes a record and back, for every kind of game", () => {
  const computer: GameConfig = { variant: "classic", size: 4, winLength: 4, mode: "computer", level: 4, humanMark: "O", seed: "C44-BXK4-M9TR" };
  for (const [config, moves, resigned] of [
    [classic, [0, 4].map(place), undefined],
    [computer, [0, 5].map(place), "O"],
    [cube, CUBE_MOVES, undefined],
  ] as const) {
    const record = recordFromGame(config, moves, resigned);
    assert.deepEqual(configFromRecord(record), config);
    assert.equal(record.end, resigned === "O" ? "ro" : resigned === "X" ? "rx" : undefined);
    const back = unpackLink(packLink(record, 1));
    assert.ok(!("error" in back));
  }
});

test("a pasted seed sets the variant and board size on the start screen", () => {
  let result = applySeedToSetup(DEFAULT_SETUP, "5X5-BXK4-M9TR");
  assert.ok(!("error" in result));
  if (!("error" in result)) {
    assert.equal(result.variant, "classic");
    assert.equal(result.size, 5);
  }
  result = applySeedToSetup({ ...DEFAULT_SETUP, variant: "classic" }, "ult-bxk4-m9tr");
  assert.ok(!("error" in result));
  if (!("error" in result)) assert.equal(result.variant, "ultimate");
  result = applySeedToSetup({ ...DEFAULT_SETUP, mode: "computer" }, "CUB-BXK4-M9TR");
  assert.ok(!("error" in result));
  if (!("error" in result)) {
    assert.equal(result.variant, "cube");
    assert.equal(result.mode, "local");
  }
});

test("a bad seed is explained, not guessed at", () => {
  for (const bad of ["nope", "3X3-AXK4-M9TR", "9X9-BXK4-M9TR", ""]) {
    const result = applySeedToSetup(DEFAULT_SETUP, bad);
    assert.ok("error" in result, bad);
  }
});
