import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, legalMoves, isLegal, apply, status, undo, fromMoves, hash, lines } from "../../src/core/classic.ts";
import type { ClassicMove, GameConfig } from "../../src/core/types.ts";

const config = (size: 3 | 4 | 5 = 3): GameConfig => ({ variant: "classic", size, mode: "local", seed: `${size}X${size}-BXK4-M9TR` });
const place = (cell: number): ClassicMove => ({ t: "place", cell });

function play(size: 3 | 4 | 5, cells: number[]) {
  return cells.reduce((s, c) => apply(s, place(c)), newGame(config(size)));
}

test("line enumeration: 3x3 has 8 lines, 4x4 has 10, 5x5 (four in a row) has 28", () => {
  assert.equal(lines(3).length, 8);
  assert.equal(lines(4).length, 10);
  assert.equal(lines(5).length, 28);
  for (const line of lines(3)) assert.equal(line.length, 3);
  for (const line of lines(4)) assert.equal(line.length, 4);
  for (const line of lines(5)) assert.equal(line.length, 4);
});

test("a new game is empty, X to move, playing", () => {
  const s = newGame(config(3));
  assert.deepEqual(s.cells, Array(9).fill(0));
  assert.equal(s.toMove, "X");
  assert.equal(status(s).status, "playing");
  assert.equal(s.winLength, 3);
  assert.equal(newGame(config(4)).winLength, 4);
  assert.equal(newGame(config(5)).winLength, 4);
});

test("X moves first and marks alternate", () => {
  const s = play(3, [4, 0]);
  assert.equal(s.cells[4], 1);
  assert.equal(s.cells[0], 2);
  assert.equal(s.toMove, "X");
});

test("three in a row wins on 3x3 (row, column, both diagonals)", () => {
  assert.equal(status(play(3, [0, 3, 1, 4, 2])).winner, "X");
  assert.equal(status(play(3, [0, 1, 3, 2, 6])).winner, "X");
  assert.equal(status(play(3, [0, 1, 4, 2, 8])).winner, "X");
  assert.equal(status(play(3, [2, 0, 4, 1, 6])).winner, "X");
  const o = play(3, [8, 0, 7, 3, 1, 6]);
  assert.equal(status(o).winner, "O");
  assert.deepEqual(status(o).winLine, [0, 3, 6]);
});

test("on 4x4 three in a row does not win; four does", () => {
  const three = play(4, [0, 4, 1, 5, 2]);
  assert.equal(status(three).status, "playing");
  const four = apply(apply(three, place(8)), place(3));
  assert.equal(status(four).winner, "X");
  assert.deepEqual(status(four).winLine, [0, 1, 2, 3]);
});

test("on 5x5 four in a row wins, including an offset run", () => {
  const s = play(5, [1, 5, 2, 6, 3, 7, 4]);
  assert.equal(status(s).winner, "X");
  assert.deepEqual(status(s).winLine, [1, 2, 3, 4]);
});

test("a full board with no line is a draw", () => {
  const s = play(3, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert.equal(status(s).status, "draw");
  assert.equal(status(s).winner, null);
  assert.deepEqual(legalMoves(s), []);
});

test("isLegal gives stable reasons", () => {
  const s = play(3, [0]);
  assert.deepEqual(isLegal(s, place(1)), { ok: true });
  assert.deepEqual(isLegal(s, place(0)), { ok: false, reason: "occupied" });
  assert.deepEqual(isLegal(s, place(9)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(s, place(-1)), { ok: false, reason: "out-of-range" });
  const won = play(3, [0, 3, 1, 4, 2]);
  assert.deepEqual(isLegal(won, place(8)), { ok: false, reason: "game-over" });
  assert.deepEqual(isLegal(s, { t: "rotate", axis: "x", layer: 0, dir: 1 }), { ok: false, reason: "not-a-placement" });
});

test("apply throws on an illegal move and never mutates its input", () => {
  const s = play(3, [0]);
  const before = JSON.stringify(s);
  assert.throws(() => apply(s, place(0)), /occupied/);
  apply(s, place(1));
  assert.equal(JSON.stringify(s), before);
});

test("legalMoves lists exactly the empty cells while playing", () => {
  const s = play(3, [0, 4]);
  assert.deepEqual(legalMoves(s).map((m) => (m as ClassicMove).cell), [1, 2, 3, 5, 6, 7, 8]);
});

test("undo pops one move and restores the exact earlier state", () => {
  const a = play(3, [0, 4]);
  const b = apply(a, place(8));
  const back = undo(b);
  assert.deepEqual(back, a);
  assert.deepEqual(undo(newGame(config(3))), newGame(config(3)));
});

test("undoing a winning move reopens the game", () => {
  const won = play(3, [0, 3, 1, 4, 2]);
  const back = undo(won);
  assert.equal(status(back).status, "playing");
  assert.equal(back.toMove, "X");
});

test("fromMoves rebuilds the same state and rejects illegal sequences", () => {
  const moves = [0, 4, 8].map(place);
  const s = fromMoves(config(3), moves);
  assert.deepEqual(s, play(3, [0, 4, 8]));
  assert.throws(() => fromMoves(config(3), [place(0), place(0)]), /occupied/);
});

test("hash is stable, equal for equal positions and different otherwise", () => {
  assert.equal(hash(play(3, [0, 4])), hash(play(3, [0, 4])));
  assert.notEqual(hash(play(3, [0, 4])), hash(play(3, [0, 5])));
  assert.notEqual(hash(play(3, [0, 4])), hash(play(3, [0])));
  assert.ok(Number.isInteger(hash(newGame(config(3)))));
});
