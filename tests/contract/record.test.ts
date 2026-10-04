import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeMoves, decodeMoves, packLink, unpackLink, configFromRecord, recordFromGame, type ReplayRecord } from "../../src/core/record.ts";
import { rotations, newGame as newCube, apply as applyCube, legalMoves as cubeMoves, status as cubeStatus } from "../../src/core/cube.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { randomSource } from "../../src/core/seed.ts";
import type { CubeMove, GameConfig, Move } from "../../src/core/types.ts";

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

test("every cube rotation on every size round-trips", () => {
  for (const size of [3, 4, 5]) {
    const all = rotations(size);
    assert.equal(all.length, 9 * size);
    assert.deepEqual(decodeMoves("cube", encodeMoves("cube", all)), all);
  }
});

test("decoding rejects bad or truncated text with an error, never a throw", () => {
  for (const [variant, text] of [["classic", "0!"], ["classic", "Z"], ["ultimate", "0"], ["ultimate", "p0"], ["ultimate", "0!"], ["cube", ".x"], ["cube", ".q1+"], ["cube", ".x5+"], ["cube", ".x1*"], ["cube", "6"], ["cube", "69"]] as const) {
    const result = decodeMoves(variant, text);
    assert.ok(!Array.isArray(result) && "error" in result, `${variant} ${text}`);
  }
  assert.deepEqual(decodeMoves("classic", ""), []);
});

const cubeConfig: GameConfig = { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };

function cubeGame(seed: number): { moves: CubeMove[] } {
  const rand = randomSource(seed);
  let s = newCube(cubeConfig);
  const moves: CubeMove[] = [];
  while (cubeStatus(s).status === "playing") {
    const legal = cubeMoves(s);
    const m = legal[rand() % legal.length]!;
    moves.push(m);
    s = applyCube(s, m);
  }
  return { moves };
}

const up = (board: number, cell: number): Move => ({ t: "place", board, cell });

const RECORDS: ReplayRecord[] = [
  { rules: { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false }, moves: [0, 3, 1, 4, 2].map(place), players: { mode: "local" } },
  { rules: { variant: "classic", size: 5, winLength: 3, scoring: "lines", lockFaces: false }, seed: "C53-BXK4-M9TR", moves: [0, 5, 1, 6, 2].map(place), players: { mode: "computer", level: 3, humanMark: "X" } },
  { rules: { variant: "ultimate", size: 3, winLength: 3, scoring: "lines", lockFaces: false }, moves: [up(0, 0), up(0, 4), up(4, 0), up(0, 3), up(3, 0), up(0, 5), up(5, 0)], players: { mode: "local" } },
  { rules: { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false }, moves: cubeGame(5).moves, players: { mode: "local" } },
  { rules: { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false }, seed: "C33-BXK4-M9TR", moves: [4, 0].map(place), players: { mode: "computer", level: 5, humanMark: "O" }, end: "ro" },
  { rules: { variant: "ultimate", size: 4, winLength: 3, scoring: "lines", lockFaces: false }, moves: [], players: { mode: "network" }, end: "rx" },
];

test("a replay link round-trips for every variant, mode and end flag", () => {
  for (const record of RECORDS) {
    const link = packLink(record, 40862);
    const back = unpackLink(link);
    assert.ok(!("error" in back), JSON.stringify(back));
    if (!("error" in back)) assert.deepEqual(back, record);
  }
});

test("links carry the rules always, and the seed only for computer games", () => {
  assert.match(packLink(RECORDS[1]!, 40862), /^\?watch=40862&rules=C53&seed=C53-BXK4-M9TR&game=c3x&moves=05162(&end=\w+)?$/);
  assert.match(packLink(RECORDS[0]!, 1), /^\?watch=1&rules=C33&game=l&moves=03142$/);
  assert.match(packLink(RECORDS[5]!, 1), /rules=U43&game=n.*end=rx/);
  for (const record of RECORDS) {
    const link = packLink(record, 1);
    assert.match(link, /rules=[CUB][345][345]/);
    assert.equal(link.includes("seed="), record.players.mode === "computer");
  }
});

test("a record with a seed for a game without a computer does not write it", () => {
  const record: ReplayRecord = { ...RECORDS[0]!, seed: "C33-BXK4-M9TR" };
  assert.ok(!packLink(record, 1).includes("seed="));
});

test("the link is rebuilt into a config from the rules", () => {
  const config = configFromRecord(RECORDS[1]!);
  assert.deepEqual(config, { variant: "classic", size: 5, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 3, humanMark: "X", seed: "C53-BXK4-M9TR" });
  assert.equal(configFromRecord(RECORDS[2]!).variant, "ultimate");
  assert.equal(configFromRecord(RECORDS[3]!).variant, "cube");
  assert.ok(!("seed" in configFromRecord(RECORDS[0]!)));
});

test("a played-back link reproduces the exact game", () => {
  for (const record of RECORDS) {
    const back = unpackLink(packLink(record, 7));
    assert.ok(!("error" in back));
    if ("error" in back) continue;
    assert.deepEqual(fromMoves(configFromRecord(record), record.moves), fromMoves(configFromRecord(back), back.moves));
  }
});

test("recordFromGame takes the rules and the seed from the config", () => {
  const config: GameConfig = { variant: "classic", size: 4, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 2, humanMark: "O", seed: "C43-BXK4-M9TR" };
  const record = recordFromGame(config, [0, 1].map(place), "X");
  assert.deepEqual(record, { rules: { variant: "classic", size: 4, winLength: 3, scoring: "lines", lockFaces: false }, seed: "C43-BXK4-M9TR", moves: [0, 1].map(place), players: { mode: "computer", level: 2, humanMark: "O" }, end: "rx" });
});

test("bad links give an error: missing parts, unknown seed, bad rules, bad mode, illegal or truncated moves", () => {
  const bad = [
    "",
    "?watch=1",
    "?watch=1&game=l&moves=0", // no rules and no seed
    "?watch=1&rules=C33",
    "?watch=1&rules=C34&game=l&moves=0", // win length longer than the board
    "?watch=1&rules=Z33&game=l&moves=0",
    "?watch=1&seed=NOPE&game=l&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=z&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=c9x&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=cx3&moves=0",
    "?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=00", // same cell twice: illegal
    "?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=9", // off the board
    "?watch=1&seed=ULT-BXK4-M9TR&game=l&moves=0", // truncated pair
    "?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=22.x1", // truncated rotation
    "?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=.x1+", // rotation with none due
    "?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=22.x3+", // layer beyond the cube
    "?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=0&end=zz",
    "?watch=1&seed=CUB-BXK4-M9TR&game=c3x&moves=0", // no computer opponent in Cube
    "?watch=1&rules=B33&game=c3x&moves=0",
    "?watch=1&rules=C33&game=c3x&moves=0", // a computer game needs its seed
    "?watch=1&rules=C53&seed=C44-BXK4-M9TR&game=c3x&moves=0", // rules and seed prefix disagree
    "?watch=1&rules=C53&seed=ULT-BXK4-M9TR&game=l&moves=0",
  ];
  for (const link of bad) {
    const result = unpackLink(link);
    assert.ok("error" in result, link);
    assert.ok((result as { error: string }).error.length > 0, link);
  }
});

test("a link without rules reads them from the seed prefix: 001 links keep working", () => {
  const cases: [string, string, number, number][] = [
    ["?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=03142", "classic", 3, 3],
    ["?watch=1&seed=4X4-BXK4-M9TR&game=l&moves=0", "classic", 4, 4],
    ["?watch=1&seed=5X5-BXK4-M9TR&game=c3x&moves=0516273", "classic", 5, 4],
    ["?watch=1&seed=ULT-BXK4-M9TR&game=l&moves=0004", "ultimate", 3, 3],
    ["?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=22", "cube", 3, 3],
  ];
  for (const [link, variant, size, winLength] of cases) {
    const record = unpackLink(link);
    assert.ok(!("error" in record), link);
    if (!("error" in record)) assert.deepEqual(record.rules, { variant, size, winLength, scoring: "lines", lockFaces: false });
  }
});

test("a seed carried by a game without a computer is accepted and dropped", () => {
  const record = unpackLink("?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=03142");
  assert.ok(!("error" in record));
  if (!("error" in record)) {
    assert.equal(record.seed, undefined);
    assert.ok(!packLink(record, 1).includes("seed="));
  }
  const withRules = unpackLink("?watch=1&rules=C33&seed=C33-BXK4-M9TR&game=n&moves=03142");
  assert.ok(!("error" in withRules));
});

test("every 001 link in the fixtures opens and plays back to the recorded result", () => {
  const links = JSON.parse(readFileSync(new URL("../fixtures/001/links.json", import.meta.url), "utf8")) as { name: string; link: string; winner: string | null; status: string; moveCount: number }[];
  assert.ok(links.length >= 5);
  for (const fixture of links) {
    const record = unpackLink(fixture.link);
    assert.ok(!("error" in record), fixture.name);
    if ("error" in record) continue;
    const state = fromMoves(configFromRecord(record), record.moves);
    assert.equal(state.winner, fixture.winner, fixture.name);
    assert.equal(state.status, fixture.status, fixture.name);
    assert.equal(record.moves.length, fixture.moveCount, fixture.name);
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

// ---- scoring and lock flags (003) ----

test("scoring and lock travel in the rules code and come back from the link", () => {
  const base = { variant: "cube", size: 4, winLength: 3 } as const;
  const cases: [Partial<ReplayRecord["rules"]>, string][] = [
    [{ scoring: "faces", lockFaces: false }, "B43F"],
    [{ scoring: "lines", lockFaces: true }, "B43L"],
    [{ scoring: "faces", lockFaces: true }, "B43FL"],
  ];
  for (const [flags, code] of cases) {
    const record: ReplayRecord = { rules: { ...base, scoring: "lines", lockFaces: false, ...flags }, moves: [{ t: "place", face: 2, cell: 4 }], players: { mode: "local" } };
    const link = packLink(record, 1);
    assert.ok(link.includes(`rules=${code}&`), link);
    assert.deepEqual(unpackLink(link), record);
    const config = configFromRecord(record);
    assert.equal(config.scoring, record.rules.scoring);
    assert.equal(config.lockFaces, record.rules.lockFaces);
    assert.deepEqual(recordFromGame(config, record.moves).rules, record.rules);
  }
});

test("a 001 or 002 link opens with lines and no lock", () => {
  const links = JSON.parse(readFileSync(new URL("../fixtures/002/links.json", import.meta.url), "utf8")) as { link: string; variant: string }[];
  for (const { link, variant } of links) {
    const record = unpackLink(link);
    assert.ok(!("error" in record), link);
    if ("error" in record) continue;
    assert.equal(record.rules.variant, variant);
    assert.equal(record.rules.scoring, "lines");
    assert.equal(record.rules.lockFaces, false);
  }
  const old = unpackLink("?watch=40862&seed=3X3-BXK4-M9TR&game=l&moves=03142");
  assert.ok(!("error" in old));
  if (!("error" in old)) assert.deepEqual([old.rules.scoring, old.rules.lockFaces], ["lines", false]);
});

test("a flag on a Classic or Ultimate code is an error", () => {
  for (const rules of ["C33F", "C33L", "U33FL"]) assert.ok("error" in unpackLink(`?watch=1&rules=${rules}&game=l&moves=0`), rules);
});

test("a link or seed from before the new default still reads its win length from the legacy table", () => {
  const cases: [string, number][] = [
    ["?watch=1&seed=4X4-BXK4-M9TR&game=l&moves=0", 4],
    ["?watch=1&seed=5X5-BXK4-M9TR&game=l&moves=0", 4],
    ["?watch=1&seed=ULT-BXK4-M9TR&game=l&moves=0004", 3],
    ["?watch=1&seed=CUB-BXK4-M9TR&game=l&moves=22", 3],
    ["?watch=1&rules=U43&game=l&moves=0004", 3],
    ["?watch=1&rules=B53&game=l&moves=22", 3],
  ];
  for (const [link, winLength] of cases) {
    const record = unpackLink(link);
    assert.ok(!("error" in record), link);
    if (!("error" in record)) assert.equal(record.rules.winLength, winLength, link);
  }
});
