import { test } from "node:test";
import assert from "node:assert/strict";
import { replayFrames } from "../../src/core/replay.ts";
import { describeMove } from "../../src/ui/replay-text.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { legalMoves, apply as applyCube, newGame as newCube } from "../../src/core/cube.ts";
import { recordFromGame, configFromRecord, packLink, unpackLink } from "../../src/core/record.ts";
import { parseSeed } from "../../src/core/seed.ts";
import { applySeedText, DEFAULT_SETUP } from "../../src/ui/setup-model.ts";
import type { CubeMove, GameConfig, Move } from "../../src/core/types.ts";

const classic: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
const cube: GameConfig = { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
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

test("placements read AcB (row, column from 1), Twist ones UAcB, with no mark; the name spells it out", () => {
  assert.deepEqual(describeMove(classic, place(5), "X", 3), { label: "3. 2c3", name: "Move 3, X, row 2, column 3" });
  const ultimate: GameConfig = { variant: "ultimate", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
  assert.deepEqual(describeMove(ultimate, { t: "place", board: 4, cell: 2 }, "O", 2), { label: "2. centre board 1c3", name: "Move 2, O, centre board, row 1, column 3" });
  assert.deepEqual(describeMove(cube, { t: "place", face: 2, cell: 4 }, "X", 1), { label: "1. F2c2", name: "Move 1, X, front face, row 2, column 2" });
  assert.deepEqual(describeMove(cube, { t: "place", face: 0, cell: 1 }, "O", 2), { label: "2. U1c2", name: "Move 2, O, top face, row 1, column 2" });
});

test("every face has its own letter in a Twist label", () => {
  const letters = [0, 1, 2, 3, 4, 5].map((face) => describeMove(cube, { t: "place", face, cell: 0 }, "X", 1).label);
  assert.deepEqual(letters, ["1. U1c1", "1. D1c1", "1. F1c1", "1. B1c1", "1. L1c1", "1. R1c1"]);
});

test("rows and columns run to 5 on the larger boards", () => {
  const classic5: GameConfig = { variant: "classic", size: 5, winLength: 4, scoring: "lines", lockFaces: false, mode: "local" };
  assert.equal(describeMove(classic5, place(24), "X", 25).label, "25. 5c5");
  assert.equal(describeMove(classic5, place(8), "O", 4).label, "4. 2c4");
  const cube5: GameConfig = { variant: "cube", size: 5, winLength: 4, scoring: "lines", lockFaces: false, mode: "local" };
  assert.equal(describeMove(cube5, { t: "place", face: 5, cell: 23 }, "X", 1).label, "1. R5c4");
});

test("no label shows the mover's mark: the move number says who moved", () => {
  const all = [
    describeMove(classic, place(0), "X", 1),
    describeMove(cube, { t: "place", face: 2, cell: 4 }, "O", 2),
    describeMove(cube, { t: "rotate", axis: "x", layer: 0, dir: 2 }, "X", 3),
  ];
  for (const { label } of all) assert.doesNotMatch(label, /[XO]/);
});

test("layer turns keep their wording, in the chosen style, without the mark", () => {
  assert.deepEqual(describeMove(cube, { t: "rotate", axis: "y", layer: 2, dir: 1 }, "X", 6), { label: "6. turn the top layer to the right", name: "Move 6, X, turn the top layer to the right" });
  assert.equal(describeMove(cube, { t: "rotate", axis: "x", layer: 0, dir: 2 }, "O", 8).label, "8. half turn the left layer");
  assert.equal(describeMove(cube, { t: "rotate", axis: "x", layer: 0, dir: 2 }, "O", 8, "cube").name, "Move 8, O, half turn the left layer");
});

test("a finished game becomes a record and back, for every kind of game", () => {
  const computer: GameConfig = { variant: "classic", size: 4, winLength: 4, scoring: "lines", lockFaces: false, mode: "computer", level: 4, humanMark: "O", seed: "C44-BXK4-M9TR" };
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
  let { state: result } = applySeedText(DEFAULT_SETUP, "5X5-BXK4-M9TR");
  assert.equal(result.variant, "classic");
  assert.equal(result.size, 5);
  ({ state: result } = applySeedText({ ...DEFAULT_SETUP, variant: "classic" }, "ult-bxk4-m9tr"));
  assert.equal(result.variant, "ultimate");
  ({ state: result } = applySeedText({ ...DEFAULT_SETUP, mode: "computer" }, "CUB-BXK4-M9TR"));
  assert.equal(result.variant, "cube");
  assert.equal(result.mode, "local");
});

test("text that is not a seed is read as a derived seed, and strict link reading still refuses it", () => {
  for (const bad of ["nope", "3X3-AXK4-M9TR", "9X9-AXK4-M9TR"]) {
    assert.equal(applySeedText(DEFAULT_SETUP, bad).reading?.kind, "derived", bad);
    assert.ok("error" in parseSeed(bad), bad);
  }
  assert.equal(applySeedText(DEFAULT_SETUP, "").reading, null);
});

test("a lock game's record replays to the same final state and status, including an early end", () => {
  const lockConfig: GameConfig = { ...cube, scoring: "faces", lockFaces: true };
  // A game played out by the rules: always the first legal move, which ends once no open face has room.
  let s = newCube(lockConfig);
  const moves: CubeMove[] = [];
  const first = (state: typeof s): CubeMove => legalMoves(state)[0]!;
  while (s.status === "playing") {
    const m = first(s);
    moves.push(m);
    s = applyCube(s, m);
  }
  const record = recordFromGame(lockConfig, moves);
  assert.deepEqual(record.rules, { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: true });
  const back = unpackLink(packLink(record, 1));
  assert.ok(!("error" in back));
  if ("error" in back) return;
  const replayed = fromMoves(configFromRecord(back), back.moves);
  assert.deepEqual(replayed, s);
  assert.equal(replayFrames(configFromRecord(back), back.moves).at(-1)!.state.status, s.status);
});
