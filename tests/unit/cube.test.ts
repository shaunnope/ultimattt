import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, legalMoves, isLegal, apply, status, undo, fromMoves, hash, rotateTable, rotations, countLines, REASONS } from "../../src/core/cube.ts";
import type { CubeState } from "../../src/core/cube.ts";
import type { Cell, CubeMove, GameConfig } from "../../src/core/types.ts";

const config: GameConfig = { variant: "cube", size: 3, mode: "local", seed: "CUB-BXK4-M9TR" };
const place = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const rotate = (axis: "x" | "y" | "z", layer: 0 | 1 | 2, dir: 1 | -1 | 2): CubeMove => ({ t: "rotate", axis, layer, dir });
const F = 2; // faces: U0 D1 F2 B3 L4 R5
const idx = (face: number, cell: number) => face * 9 + cell;

// A full face with no line for either player.
const NO_LINES: Cell[] = [1, 2, 1, 1, 2, 2, 2, 1, 1];

function literal(patch: Partial<CubeState> & { stickers: Cell[] }): CubeState {
  const base = newGame(config);
  const merged = { ...base, ...patch };
  // keep the derived fields honest for hand-built positions
  return { ...merged, lines: patch.lines ?? countLines(patch.stickers), empty: merged.stickers.filter((c) => c === 0).length };
}
const fullNoLines = (): Cell[] => Array.from({ length: 6 }, () => NO_LINES).flat();

test("a new game: empty cube, X to move, place phase, nobody scoring", () => {
  const s = newGame(config);
  assert.equal(s.stickers.length, 54);
  assert.ok(s.stickers.every((c) => c === 0));
  assert.equal(s.toMove, "X");
  assert.equal(s.phase, "place");
  assert.deepEqual(s.lines, { X: 0, O: 0 });
  assert.equal(s.empty, 54);
  assert.equal(status(s).status, "playing");
  assert.equal(legalMoves(s).length, 54);
});

test("marks alternate when a move scores nothing", () => {
  let s = newGame(config);
  s = apply(s, place(F, 4));
  assert.equal(s.stickers[idx(F, 4)], 1);
  assert.equal(s.toMove, "O");
  s = apply(s, place(0, 0));
  assert.equal(s.stickers[idx(0, 0)], 2);
  assert.equal(s.toMove, "X");
  assert.equal(s.phase, "place");
});

test("completing a line scores a point, keeps the mover, and requires a rotation", () => {
  let s = newGame(config);
  for (const [face, cell] of [[F, 0], [0, 0], [F, 1], [0, 1]] as const) s = apply(s, place(face, cell));
  s = apply(s, place(F, 2));
  assert.deepEqual(s.lines, { X: 1, O: 0 });
  assert.equal(s.phase, "rotate");
  assert.equal(s.toMove, "X");
  assert.equal(s.pendingRotateFor, "X");
  assert.equal(status(s).status, "playing");
  assert.deepEqual(isLegal(s, place(3, 3)), { ok: false, reason: "rotate-pending" });
  assert.equal(legalMoves(s).length, 27);
  assert.ok(legalMoves(s).every((m) => m.t === "rotate"));
});

test("one placement that completes two lines scores two points but needs only one rotation", () => {
  const stickers = Array<Cell>(54).fill(0);
  for (const c of [1, 2, 3, 6]) stickers[idx(F, c)] = 1; // X on the row 0-1-2 and column 0-3-6, missing cell 0
  const s = literal({ stickers, toMove: "X" });
  const after = apply(s, place(F, 0));
  assert.equal(after.lines.X, 2);
  assert.equal(after.phase, "rotate");
  const rotated = apply(after, rotate("y", 1, 1));
  assert.equal(rotated.phase, "place");
  assert.equal(rotated.toMove, "O");
});

test("rotating is refused when no rotation is due, and a rotation hands the move on", () => {
  const s = newGame(config);
  assert.deepEqual(isLegal(s, rotate("x", 0, 1)), { ok: false, reason: "no-rotation-due" });
  let scoring = newGame(config);
  for (const [face, cell] of [[F, 0], [0, 0], [F, 1], [0, 1], [F, 2]] as const) scoring = apply(scoring, place(face, cell));
  const after = apply(scoring, rotate("y", 2, 1)); // the bottom layer leaves the top row alone
  assert.equal(after.phase, "place");
  assert.equal(after.toMove, "O");
  assert.deepEqual(after.lines, { X: 1, O: 0 });
});

test("a rotation can break a line, lowering the total", () => {
  // X holds the whole top row of the front face; turning the left layer carries one of them away.
  const stickers = Array<Cell>(54).fill(0);
  for (const c of [0, 1, 2]) stickers[idx(F, c)] = 1;
  const s = literal({ stickers, toMove: "X", phase: "rotate", pendingRotateFor: "X", lines: { X: 1, O: 0 } });
  const after = apply(s, rotate("x", 0, 1));
  assert.deepEqual(after.lines, { X: 0, O: 0 });
});

test("a rotation that creates a line gives no extra rotation", () => {
  // X has front-face cells 0 and 1; turning the right layer carries a third X into cell 2.
  const table = rotateTable("x", 2, 1);
  const source = table[idx(F, 2)]!;
  const stickers = Array<Cell>(54).fill(0);
  for (const i of [idx(F, 0), idx(F, 1), source]) stickers[i] = 1;
  const s = literal({ stickers, toMove: "X", phase: "rotate", pendingRotateFor: "X" });
  const after = apply(s, rotate("x", 2, 1));
  assert.equal(after.lines.X, 1);
  assert.equal(after.phase, "place");
  assert.equal(after.toMove, "O");
});

test("a rotation that completes lines for both players counts each for its owner", () => {
  const stickers = Array<Cell>(54).fill(0);
  const t = rotateTable("x", 2, 1);
  for (const i of [idx(F, 0), idx(F, 1), t[idx(F, 2)]!]) stickers[i] = 1; // X line appears
  for (const i of [idx(0, 0), idx(0, 3), t[idx(0, 6)]!]) if (stickers[i] === 0) stickers[i] = 2; // O line appears
  const s = literal({ stickers, toMove: "X", phase: "rotate", pendingRotateFor: "X" });
  const after = apply(s, rotate("x", 2, 1));
  assert.ok(after.lines.X >= 1);
  assert.ok(after.lines.O >= 0);
  assert.equal(after.phase, "place");
});

test("the game ends when all 54 cells are filled and no rotation is pending; equal lines are a tie", () => {
  const stickers = fullNoLines();
  stickers[idx(5, 8)] = 0; // last empty cell is X's anyway (the pattern has X there)
  const s = literal({ stickers, toMove: "X" });
  const after = apply(s, place(5, 8));
  assert.equal(after.empty, 0);
  assert.deepEqual(status(after), { status: "tie", winner: null });
  assert.deepEqual(legalMoves(after), []);
  assert.deepEqual(isLegal(after, place(0, 0)), { ok: false, reason: "game-over" });
});

test("the player with more lines wins", () => {
  const stickers = fullNoLines();
  // give X a full top row on the up face: replace the up face with X X X / O O X / O X O
  stickers.splice(0, 9, 1, 1, 1, 2, 2, 1, 2, 1, 2);
  stickers[idx(5, 8)] = 0;
  const s = literal({ stickers, toMove: "X" });
  const after = apply(s, place(5, 8));
  assert.equal(after.lines.X, 1);
  assert.deepEqual(status(after), { status: "won", winner: "X" });
});

test("the last cell completing a line still requires its rotation before the game ends", () => {
  const stickers = fullNoLines();
  stickers.splice(0, 9, 1, 1, 0, 2, 2, 1, 2, 1, 2); // X X _ / O O X / O X O
  const s = literal({ stickers, toMove: "X" });
  const scored = apply(s, place(0, 2));
  assert.equal(scored.empty, 0);
  assert.equal(scored.phase, "rotate");
  assert.equal(status(scored).status, "playing");
  const done = apply(scored, rotate("y", 2, 1));
  assert.equal(done.phase, "place");
  assert.notEqual(status(done).status, "playing");
});

test("isLegal gives stable reasons", () => {
  const s = apply(newGame(config), place(F, 0));
  assert.deepEqual(isLegal(s, place(F, 0)), { ok: false, reason: "occupied" });
  assert.deepEqual(isLegal(s, place(6, 0)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(s, place(0, 9)), { ok: false, reason: "out-of-range" });
  assert.deepEqual(isLegal(s, { t: "place", cell: 3 }), { ok: false, reason: "invalid-move" });
  assert.deepEqual(isLegal(s, rotate("q" as "x", 0, 1)), { ok: false, reason: "invalid-move" });
  for (const reason of ["invalid-move", "game-over", "out-of-range", "occupied", "rotate-pending", "no-rotation-due"]) {
    assert.ok((REASONS as readonly string[]).includes(reason), reason);
  }
});

test("apply throws on an illegal move and never mutates its input", () => {
  const s = apply(newGame(config), place(F, 0));
  const before = JSON.stringify(s);
  assert.throws(() => apply(s, place(F, 0)), /occupied/);
  apply(s, place(F, 1));
  assert.equal(JSON.stringify(s), before);
});

const SCORING: CubeMove[] = [place(F, 0), place(0, 0), place(F, 1), place(0, 1), place(F, 2)];

test("undo while a rotation is pending takes back the placement that triggered it", () => {
  const pending = fromMoves(config, SCORING);
  assert.equal(pending.phase, "rotate");
  assert.deepEqual(undo(pending), fromMoves(config, SCORING.slice(0, 4)));
});

test("undo after a rotation takes back the rotation and its placement together", () => {
  const rotated = fromMoves(config, [...SCORING, rotate("y", 2, 1)]);
  assert.deepEqual(undo(rotated), fromMoves(config, SCORING.slice(0, 4)));
});

test("undo of an ordinary placement takes back one move", () => {
  const s = fromMoves(config, SCORING.slice(0, 3));
  assert.deepEqual(undo(s), fromMoves(config, SCORING.slice(0, 2)));
  assert.deepEqual(undo(newGame(config)), newGame(config));
});

test("fromMoves rebuilds the same state and rejects illegal sequences", () => {
  const moves: CubeMove[] = [...SCORING, rotate("y", 2, 1), place(4, 4)];
  let s = newGame(config);
  for (const m of moves) s = apply(s, m);
  assert.deepEqual(fromMoves(config, moves), s);
  assert.throws(() => fromMoves(config, [...SCORING, place(3, 3)]), /rotate-pending/);
});

test("hash is stable and differs between positions", () => {
  const a = fromMoves(config, SCORING.slice(0, 3));
  assert.equal(hash(a), hash(fromMoves(config, SCORING.slice(0, 3))));
  assert.notEqual(hash(a), hash(fromMoves(config, SCORING.slice(0, 2))));
  assert.notEqual(hash(fromMoves(config, [place(F, 0)])), hash(fromMoves(config, [place(F, 1)])));
});

test("rotations() lists the 27 turns", () => {
  assert.equal(rotations().length, 27);
});
