import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, legalMoves, isLegal, apply, status, undo, fromMoves, hash, playable, hints, REASONS } from "../../src/core/ultimate.ts";
import type { UltimateState } from "../../src/core/ultimate.ts";
import type { Cell, GameConfig, UltimateMove } from "../../src/core/types.ts";

const config: GameConfig = { variant: "ultimate", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
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

// ---- N×N small boards on an N×N grid, with K in a row at both levels ----

const big = (size: 4 | 5, winLength = 3): GameConfig => ({ variant: "ultimate", size, winLength, scoring: "lines", lockFaces: false, mode: "local" });
const playBig = (cfg: GameConfig, moves: [number, number][]): UltimateState => moves.reduce((st, [b, c]) => apply(st, mv(b, c)), newGame(cfg));
const emptyN = (n: number): Cell[] => Array<Cell>(n * n).fill(0);

test("a new 4x4 and 5x5 game has N squared boards of N squared cells and every move free", () => {
  for (const size of [4, 5] as const) {
    const n2 = size * size;
    const s = newGame(big(size));
    assert.equal(s.boards.length, n2);
    assert.ok(s.boards.every((b) => b.length === n2));
    assert.equal(s.claims.length, n2);
    assert.equal(s.forced, null);
    assert.equal(legalMoves(s).length, n2 * n2);
    assert.equal(playable(s).length, n2);
  }
});

test("on 4x4 and 5x5 the cell index you play is the board index your opponent must play, up to N squared minus one", () => {
  for (const size of [4, 5] as const) {
    const n2 = size * size;
    for (const cell of [0, 7, n2 - 1]) {
      const s = playBig(big(size), [[3, cell]]);
      assert.equal(s.forced, cell);
      assert.deepEqual(playable(s), [cell]);
      assert.equal(legalMoves(s).length, n2);
    }
  }
});

test("indexes at or beyond N squared are out of range, and 4x4 accepts what 3x3 would not", () => {
  const s = newGame(big(4));
  assert.deepEqual(isLegal(s, mv(15, 15)), { ok: true });
  assert.deepEqual(isLegal(s, mv(16, 0)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(s, mv(0, 16)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(newGame(config), mv(9, 0)), { ok: false, reason: "out-of-range" });
});

test("a small board is claimed by K in a row, not N: K=3 on 5x5 claims on three and K=5 does not", () => {
  const three = newGame(big(5, 3));
  const boards3 = three.boards.map((b) => b.slice());
  boards3[12] = emptyN(5);
  boards3[12]![0] = 1;
  boards3[12]![1] = 1;
  boards3[12]![5] = 2;
  boards3[12]![6] = 2;
  const sa: UltimateState = { ...three, boards: boards3, forced: 12, toMove: "X" };
  assert.equal(apply(sa, mv(12, 2)).claims[12], 1);
  const five = newGame(big(5, 5));
  const sb: UltimateState = { ...five, boards: boards3, forced: 12, toMove: "X" };
  assert.equal(apply(sb, mv(12, 2)).claims[12], 0);
});

test("the grid is won by K claimed boards in a row, with the same K", () => {
  for (const [size, k] of [[4, 3], [4, 4], [5, 3]] as const) {
    const base = newGame(big(size, k));
    const boards = base.boards.map((b) => b.slice());
    boards[k - 1] = emptyN(size);
    boards[k - 1]![0] = 1;
    boards[k - 1]![1] = 1;
    boards[k - 1]![size] = 2;
    boards[k - 1]![size + 1] = 2;
    const claims = base.claims.slice();
    for (let i = 0; i < k - 1; i++) claims[i] = 1;
    // K-1 boards claimed along row 0 and X completes board K-1 with cell 2 (K=3) or a longer row: use a K-long row
    const finisher = 2;
    if (k === 4) {
      boards[k - 1] = emptyN(size);
      for (let i = 0; i < 3; i++) boards[k - 1]![i] = 1;
      boards[k - 1]![size] = 2;
      boards[k - 1]![size + 1] = 2;
      boards[k - 1]![size + 2] = 2;
      const s4: UltimateState = { ...base, boards, claims, forced: k - 1, toMove: "X" };
      const after = apply(s4, mv(k - 1, 3));
      assert.deepEqual(status(after), { status: "won", winner: "X", winLine: [0, 1, 2, 3] });
      continue;
    }
    const s: UltimateState = { ...base, boards, claims, forced: k - 1, toMove: "X" };
    const after = apply(s, mv(k - 1, finisher));
    assert.equal(after.claims[k - 1], 1);
    assert.equal(status(after).status, "won", `${size} K=${k}`);
    assert.deepEqual(status(after).winLine, [0, 1, 2]);
  }
});

test("on a larger grid a drawn small board blocks lines through it", () => {
  const base = newGame(big(4, 3));
  const claims = base.claims.slice();
  claims[0] = 1;
  claims[1] = 3; // full, nobody's
  claims[2] = 0;
  const boards = base.boards.map((b) => b.slice());
  boards[2] = emptyN(4);
  boards[2]![0] = 1;
  boards[2]![1] = 1;
  boards[2]![4] = 2;
  boards[2]![5] = 2;
  const s: UltimateState = { ...base, boards, claims, forced: 2, toMove: "X" };
  const after = apply(s, mv(2, 2));
  assert.equal(after.claims[2], 1);
  assert.equal(status(after).status, "playing", "boards 0, 1 (drawn), 2 are not three of X in a row");
});

test("sent to a claimed board on 4x4 the opponent may play any open board; a full board sends them free too", () => {
  const s = playBig(big(4), [[5, 9]]);
  const claims = s.claims.slice();
  claims[3] = 2;
  const sent = apply({ ...s, claims, forced: 5, toMove: "O" }, mv(5, 3));
  assert.equal(sent.forced, null);
  assert.ok(!playable(sent).includes(3));
  assert.equal(playable(sent).length, 15);
});

test("a 5x5 game with every board closed and no K line is a draw", () => {
  const base = newGame(big(5, 5));
  const claims = base.claims.map((_, i) => (i === 24 ? 0 : ((i * 7) % 3 === 0 ? 3 : 3))) as UltimateState["claims"];
  const boards = base.boards.map((b) => b.slice());
  boards[24] = emptyN(5);
  // a full board with no five in a row, one cell left
  const pattern = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 2, 1, 2, 0] as Cell[];
  boards[24] = pattern;
  const s: UltimateState = { ...base, boards, claims, forced: 24, toMove: "X" };
  const after = apply(s, mv(24, 24));
  assert.equal(after.claims[24], 3);
  assert.deepEqual(status(after), { status: "draw", winner: null });
});

test("fromMoves, undo and hash work on larger boards", () => {
  for (const size of [4, 5] as const) {
    const cfg = big(size);
    const moves: UltimateMove[] = [mv(0, size * size - 1), mv(size * size - 1, 0), mv(0, 5), mv(5, 5)];
    const s = fromMoves(cfg, moves);
    assert.equal(s.moves.length, 4);
    assert.deepEqual(undo(s), fromMoves(cfg, moves.slice(0, 3)));
    assert.notEqual(hash(s), hash(undo(s)));
    assert.equal(hash(s), hash(fromMoves(cfg, moves)));
    assert.throws(() => fromMoves(cfg, [mv(0, 3), mv(0, 4)]), /not-your-board/);
  }
});

test("hints on a larger board find the cell that would claim a small board", () => {
  const base = newGame(big(5, 3));
  const boards = base.boards.map((b) => b.slice());
  boards[6] = emptyN(5);
  boards[6]![0] = 1;
  boards[6]![1] = 1;
  const s: UltimateState = { ...base, boards, forced: 6, toMove: "X" };
  const h = hints(s, "X");
  assert.deepEqual(h.win, [{ board: 6, cell: 2 }]);
  assert.deepEqual(hints(s, "O").block, [{ board: 6, cell: 2 }]);
});
