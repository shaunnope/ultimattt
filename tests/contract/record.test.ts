import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeMoves, decodeMoves, packLink, unpackLink, configFromRecord, type ReplayRecord } from "../../src/core/record.ts";
import { rotations, newGame as newCube, apply as applyCube, legalMoves as cubeMoves, status as cubeStatus } from "../../src/core/cube.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { randomSource } from "../../src/core/seed.ts";
import type { CubeMove, Move } from "../../src/core/types.ts";

const place = (cell: number): Move => ({ t: "place", cell });

test("classic moves are one character each: 0-9 then a-o for cells 0 to 24", () => {
  const cells = Array.from({ length: 25 }, (_, i) => i);
  const text = encodeMoves("classic", cells.map(place));
  assert.equal(text, "0123456789abcdefghijklmno");
  assert.deepEqual(decodeMoves("classic", text), cells.map(place));
});

test("ultimate moves are two characters: board then cell", () => {
  const moves: Move[] = [{ t: "place", board: 0, cell: 0 }, { t: "place", board: 8, cell: 4 }, { t: "place", board: 3, cell: 7 }];
  assert.equal(encodeMoves("ultimate", moves), "008437");
  assert.deepEqual(decodeMoves("ultimate", "008437"), moves);
});

test("cube placements are two characters (face, cell) and rotations are a dot, axis, layer and way", () => {
  const moves: CubeMove[] = [{ t: "place", face: 2, cell: 4 }, { t: "rotate", axis: "x", layer: 1, dir: 1 }, { t: "rotate", axis: "z", layer: 0, dir: 2 }, { t: "rotate", axis: "y", layer: 2, dir: -1 }, { t: "place", face: 5, cell: 8 }];
  const text = encodeMoves("cube", moves);
  assert.equal(text, "24.x1+.z02.y2-58");
  assert.deepEqual(decodeMoves("cube", text), moves);
});

test("all 27 cube rotations round-trip", () => {
  const text = encodeMoves("cube", rotations());
  assert.deepEqual(decodeMoves("cube", text), rotations());
});

test("decoding rejects bad or truncated text with an error, never a throw", () => {
  for (const [variant, text] of [["classic", "0!"], ["classic", "Z"], ["ultimate", "0"], ["ultimate", "9a"], ["ultimate", "09"], ["cube", ".x"], ["cube", ".q1+"], ["cube", ".x3+"], ["cube", ".x1*"], ["cube", "6"], ["cube", "69"]] as const) {
    const result = decodeMoves(variant, text);
    assert.ok(!Array.isArray(result) && "error" in result, `${variant} ${text}`);
  }
  assert.deepEqual(decodeMoves("classic", ""), []);
});

function cubeGame(seed: number): { moves: CubeMove[] } {
  const rand = randomSource(seed);
  let s = newCube({ variant: "cube", size: 3, mode: "local", seed: "CUB-BXK4-M9TR" });
  const moves: CubeMove[] = [];
  while (cubeStatus(s).status === "playing") {
    const legal = cubeMoves(s);
    const m = legal[rand() % legal.length]!;
    moves.push(m);
    s = applyCube(s, m);
  }
  return { moves };
}

const RECORDS: ReplayRecord[] = [
  { variant: "classic", seed: "3X3-BXK4-M9TR", moves: [0, 3, 1, 4, 2].map(place), players: { mode: "local" } },
  { variant: "classic", seed: "5X5-BXK4-M9TR", moves: [0, 5, 1, 6, 2, 7, 3].map(place), players: { mode: "computer", level: 3, humanMark: "X" } },
  { variant: "ultimate", seed: "ULT-BXK4-M9TR", moves: [[0, 0], [0, 4], [4, 0], [0, 3], [3, 0], [0, 5], [5, 0]].map(([board, cell]) => ({ t: "place" as const, board: board!, cell: cell! })), players: { mode: "local" } },
  { variant: "cube", seed: "CUB-BXK4-M9TR", moves: cubeGame(5).moves, players: { mode: "local" } },
  { variant: "classic", seed: "3X3-BXK4-M9TR", moves: [4, 0].map(place), players: { mode: "computer", level: 5, humanMark: "O" }, end: "ro" },
  { variant: "ultimate", seed: "ULT-BXK4-M9TR", moves: [], players: { mode: "network" }, end: "rx" },
];

test("a replay link round-trips for every variant, mode and end flag", () => {
  for (const record of RECORDS) {
    const link = packLink(record, 40862);
    const back = unpackLink(link);
    assert.ok(!("error" in back), JSON.stringify(back));
    if (!("error" in back)) {
      assert.equal(back.variant, record.variant);
      assert.equal(back.seed, record.seed);
      assert.deepEqual(back.moves, record.moves);
      assert.deepEqual(back.players, record.players);
      assert.equal(back.end, record.end);
    }
  }
});

test("links look like the reference game's: watch, seed, game, moves, end", () => {
  const link = packLink(RECORDS[1]!, 40862);
  assert.match(link, /^\?watch=40862&seed=5X5-BXK4-M9TR&game=c3x&moves=0516273(&end=\w+)?$/);
  assert.match(packLink(RECORDS[0]!, 1), /game=l/);
  assert.match(packLink(RECORDS[5]!, 1), /game=n.*end=rx/);
});

test("the link is rebuilt into a config whose size and variant come from the seed", () => {
  const config = configFromRecord(RECORDS[1]!);
  assert.equal(config.variant, "classic");
  assert.equal(config.size, 5);
  assert.equal(config.mode, "computer");
  assert.equal(config.level, 3);
  assert.equal(config.humanMark, "X");
  assert.equal(configFromRecord(RECORDS[2]!).variant, "ultimate");
  assert.equal(configFromRecord(RECORDS[3]!).variant, "cube");
});

test("a played-back link reproduces the exact game", () => {
  for (const record of RECORDS) {
    const back = unpackLink(packLink(record, 7));
    assert.ok(!("error" in back));
    if ("error" in back) continue;
    const a = fromMoves(configFromRecord(record), record.moves);
    const b = fromMoves(configFromRecord(back), back.moves);
    assert.deepEqual(a, b);
  }
});

test("bad links give an error: missing parts, unknown seed, bad mode, illegal or truncated moves", () => {
  const bad = [
    "",
    "?watch=1",
    "?watch=1&seed=NOPE&game=l&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=z&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=c9x&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=cx3&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=00", // same cell twice: illegal
    "?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=9", // off the board
    "?watch=1&seed=ULT-BXK4-M9TR&game=l&moves=0", // truncated pair
    "?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=22.x1", // truncated rotation
    "?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=.x1+", // rotation with none due
    "?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=0&end=zz",
    "?watch=1&seed=CUB-BXK4-M9TR&game=c3x&moves=0", // no computer opponent in Cube
  ];
  for (const link of bad) {
    const result = unpackLink(link);
    assert.ok("error" in result, link);
    assert.ok((result as { error: string }).error.length > 0, link);
  }
});

test("a link cannot claim a result: extra parameters are ignored and the result is always recomputed", () => {
  const link = packLink(RECORDS[0]!, 3) + "&winner=O&result=draw&score=99";
  const back = unpackLink(link);
  assert.ok(!("error" in back));
  if ("error" in back) return;
  const state = fromMoves(configFromRecord(back), back.moves);
  assert.equal(state.winner, "X");
});
