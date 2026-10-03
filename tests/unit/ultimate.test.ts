import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, legalMoves, isLegal, apply, status, undo, fromMoves, hash, playable, REASONS } from "../../src/core/ultimate.ts";
import type { UltimateState } from "../../src/core/ultimate.ts";
import type { Cell, GameConfig, UltimateMove } from "../../src/core/types.ts";

const config: GameConfig = { variant: "ultimate", size: 3, mode: "local", seed: "ULT-BXK4-M9TR" };
const mv = (board: number, cell: number): UltimateMove => ({ t: "place", board, cell });
const play = (moves: [number, number][]): UltimateState => moves.reduce((s, [b, c]) => apply(s, mv(b, c)), newGame(config));

// A legal opening in which O wins small board 0 on move 6 and X then sends O to the closed board 0 on move 7:
//  1 X b0c0 -> O must play b0     2 O b0c4 -> X must play b4    3 X b4c0 -> b0
//  4 O b0c3 -> b3                 5 X b3c0 -> b0                6 O b0c5 (row 3-4-5) claims b0, sends X to b5
//  7 X b5c0 -> cell 0 points at the claimed board 0, so O may play anywhere open
const OPENING: [number, number][] = [[0, 0], [0, 4], [4, 0], [0, 3], [3, 0], [0, 5], [5, 0]];

function literal(patch: Partial<UltimateState>): UltimateState {
  return { ...newGame(config), ...patch };
}
const emptyBoard = (): Cell[] => Array<Cell>(9).fill(0);

test("a new game: 81 free moves, X to move, every board playable", () => {
  const s = newGame(config);
  assert.equal(s.toMove, "X");
  assert.equal(s.forced, null);
  assert.equal(legalMoves(s).length, 81);
  assert.deepEqual(playable(s), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(status(s).status, "playing");
});

test("the cell you play inside a small board decides the board the opponent must play", () => {
  const s = play([[4, 2]]);
  assert.equal(s.forced, 2);
  assert.deepEqual(playable(s), [2]);
  const moves = legalMoves(s) as UltimateMove[];
  assert.equal(moves.length, 9);
  assert.ok(moves.every((m) => m.board === 2));
  assert.equal(s.toMove, "O");
});

test("a move in the wrong board is refused with not-your-board", () => {
  const s = play([[0, 0]]);
  assert.deepEqual(isLegal(s, mv(5, 5)), { ok: false, reason: "not-your-board" });
  assert.deepEqual(isLegal(s, mv(0, 4)), { ok: true });
});

test("a completed line claims the small board for that player", () => {
  const s = play(OPENING.slice(0, 6));
  assert.equal(s.claims[0], 2);
});

test("sent to a claimed board, the opponent may play in any open board", () => {
  const s = play(OPENING);
  assert.equal(s.claims[0], 2);
  assert.equal(s.forced, null);
  assert.deepEqual(playable(s), [1, 2, 3, 4, 5, 6, 7, 8]);
  const moves = legalMoves(s) as UltimateMove[];
  assert.ok(moves.every((m) => m.board !== 0));
  assert.ok(moves.some((m) => m.board === 8));
});

test("a claimed board accepts no more moves (closed-board)", () => {
  const s = play(OPENING);
  assert.deepEqual(isLegal(s, mv(0, 8)), { ok: false, reason: "closed-board" });
});

test("sent to a full unclaimed board, the opponent may also play anywhere open", () => {
  // Board 0 is full with no line (X O X / X O O / O X _); X plays its last cell.
  const boards = Array.from({ length: 9 }, emptyBoard);
  boards[0] = [1, 2, 1, 1, 2, 2, 2, 1, 0];
  const s = literal({ boards, forced: 0, toMove: "X" });
  const after = apply(s, mv(0, 8));
  assert.equal(after.claims[0], 3);
  // cell 8 points at board 8 (open), so play there; instead check pointing at the full board:
  const boards2 = Array.from({ length: 9 }, emptyBoard);
  boards2[0] = [1, 2, 1, 1, 2, 2, 2, 1, 1];
  boards2[3] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const full = literal({ boards: boards2, claims: [3, 0, 0, 0, 0, 0, 0, 0, 0], forced: 3, toMove: "O" });
  const next = apply(full, mv(3, 0)); // cell 0 points at the full, unclaimed board 0
  assert.equal(next.forced, null);
  assert.ok(!playable(next).includes(0));
});

test("a full unclaimed board counts for neither player's overall line", () => {
  // X has claimed boards 0 and 1; board 2 fills up with no winner, so X does not have 0-1-2.
  const boards = Array.from({ length: 9 }, emptyBoard);
  boards[2] = [1, 2, 1, 1, 2, 2, 2, 1, 0];
  const s = literal({ boards, claims: [1, 1, 0, 0, 0, 0, 0, 0, 0], forced: 2, toMove: "X" });
  const after = apply(s, mv(2, 8));
  assert.equal(after.claims[2], 3);
  assert.equal(status(after).status, "playing");
});

test("three claimed boards in a row win the game", () => {
  const boards = Array.from({ length: 9 }, emptyBoard);
  boards[2] = [1, 1, 0, 2, 2, 0, 0, 0, 0];
  const s = literal({ boards, claims: [1, 1, 0, 0, 0, 0, 0, 0, 0], forced: 2, toMove: "X" });
  const after = apply(s, mv(2, 2));
  assert.equal(after.claims[2], 1);
  assert.deepEqual(status(after), { status: "won", winner: "X", winLine: [0, 1, 2] });
  assert.deepEqual(legalMoves(after), []);
  assert.deepEqual(isLegal(after, mv(5, 5)), { ok: false, reason: "game-over" });
});

test("when every board is closed and nobody has a line, it is a draw", () => {
  // Claims leave no line for either side; board 8 fills with no winner.
  const boards = Array.from({ length: 9 }, emptyBoard);
  boards[8] = [1, 2, 1, 1, 2, 2, 2, 1, 0];
  const claims = [1, 2, 1, 2, 1, 2, 2, 1, 0] as UltimateState["claims"];
  const s = literal({ boards, claims, forced: 8, toMove: "X" });
  const after = apply(s, mv(8, 8));
  assert.equal(after.claims[8], 3);
  assert.deepEqual(status(after), { status: "draw", winner: null });
});

test("isLegal gives stable reasons for every kind of refusal", () => {
  const s = play([[0, 0]]);
  assert.deepEqual(isLegal(s, mv(0, 0)), { ok: false, reason: "occupied" });
  assert.deepEqual(isLegal(s, mv(9, 0)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(s, mv(0, 9)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(s, { t: "place", cell: 3 }), { ok: false, reason: "not-a-placement" });
  assert.deepEqual(isLegal(s, { t: "rotate", axis: "x", layer: 0, dir: 1 }), { ok: false, reason: "not-a-placement" });
  for (const reason of ["not-your-board", "closed-board", "occupied", "out-of-range", "game-over", "not-a-placement"]) {
    assert.ok((REASONS as readonly string[]).includes(reason), reason);
  }
});

test("apply throws on an illegal move and never mutates its input", () => {
  const s = play([[0, 0]]);
  const before = JSON.stringify(s);
  assert.throws(() => apply(s, mv(5, 5)), /not-your-board/);
  apply(s, mv(0, 4));
  assert.equal(JSON.stringify(s), before);
});

test("undo takes back one move and restores the exact earlier state", () => {
  const a = play(OPENING.slice(0, 5));
  const b = apply(a, mv(0, 5));
  assert.deepEqual(undo(b), a);
  assert.deepEqual(undo(newGame(config)), newGame(config));
});

test("undoing the move that claimed a board reopens it", () => {
  const claimed = play(OPENING.slice(0, 6));
  const back = undo(claimed);
  assert.equal(back.claims[0], 0);
  assert.equal(back.forced, 0);
});

test("fromMoves rebuilds the same state and rejects illegal sequences", () => {
  const moves = OPENING.map(([b, c]) => mv(b, c));
  assert.deepEqual(fromMoves(config, moves), play(OPENING));
  assert.throws(() => fromMoves(config, [mv(0, 0), mv(1, 1)]), /not-your-board/);
});

test("hash is stable, and differs between positions", () => {
  assert.equal(hash(play(OPENING)), hash(play(OPENING)));
  assert.notEqual(hash(play(OPENING)), hash(play(OPENING.slice(0, 6))));
  assert.notEqual(hash(play([[0, 0]])), hash(play([[0, 1]])));
});
