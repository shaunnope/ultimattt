import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, apply, legalMoves, fromMoves, countLines, scoreOf } from "../../src/core/cube.ts";
import type { CubeState } from "../../src/core/cube.ts";
import { randomSource } from "../../src/core/seed.ts";
import type { Cell, CubeMove, GameConfig } from "../../src/core/types.ts";

const cfg = (scoring: "lines" | "faces", lockFaces = false): GameConfig => ({ variant: "cube", size: 3, winLength: 3, scoring, lockFaces, mode: "local" });
const place = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const rotate = (axis: "x" | "y" | "z", layer: number, dir: 1 | -1 | 2): CubeMove => ({ t: "rotate", axis, layer, dir });
const F = 2;
const D = 1;

function literal(config: GameConfig, stickers: Cell[], patch: Partial<CubeState> = {}): CubeState {
  return {
    ...newGame(config),
    stickers,
    lines: countLines(stickers, 3, 3),
    scores: scoreOf(stickers, 3, 3, config.scoring),
    empty: stickers.filter((c) => c === 0).length,
    ...patch,
  };
}
const blank = (): Cell[] => Array<Cell>(54).fill(0);
const NO_LINES: Cell[] = [1, 2, 1, 1, 2, 2, 2, 1, 1];
const faces = (patch: Record<number, Cell[]>): Cell[] => Array.from({ length: 6 }, (_, f) => patch[f] ?? NO_LINES).flat();

test("in lines mode scores always equal lines, move after move", () => {
  const rand = randomSource(11);
  let s = newGame(cfg("lines"));
  while (s.status === "playing") {
    const legal = legalMoves(s);
    s = apply(s, legal[rand() % legal.length]!);
    assert.deepEqual(s.scores, s.lines);
  }
});

test("scoreOf in faces mode counts a face once however many lines it holds, and both players can hold a face", () => {
  const s = blank();
  s.fill(1, F * 9, F * 9 + 9); // eight X lines on one face
  assert.deepEqual(scoreOf(s, 3, 3, "faces"), { X: 1, O: 0 });
  assert.deepEqual(scoreOf(s, 3, 3, "lines"), { X: 8, O: 0 });
  const both = blank();
  [0, 1, 2].forEach((c) => { both[F * 9 + c] = 1; both[F * 9 + 6 + c] = 2; });
  assert.deepEqual(scoreOf(both, 3, 3, "faces"), { X: 1, O: 1 });
});

test("a second line on a counted face adds nothing to the score but still forces a turn", () => {
  const stickers = blank();
  for (const c of [0, 1, 2, 3, 4]) stickers[F * 9 + c] = 1;
  stickers[D * 9 + 0] = 2;
  const s = literal(cfg("faces"), stickers);
  assert.deepEqual(s.scores, { X: 1, O: 0 });
  const next = apply(s, place(F, 5));
  assert.deepEqual(next.lines, { X: 2, O: 0 });
  assert.deepEqual(next.scores, { X: 1, O: 0 });
  assert.equal(next.phase, "rotate");
  assert.equal(next.pendingRotateFor, "X");
});

test("a turn that breaks a face's last line lowers the score", () => {
  const config = cfg("faces");
  const s = fromMoves(config, [place(F, 0), place(D, 0), place(F, 1), place(D, 1), place(F, 2)]);
  assert.deepEqual(s.scores, { X: 1, O: 0 });
  const after = apply(s, rotate("x", 0, 1)); // carries the left column of the front face away
  assert.deepEqual(after.lines, { X: 0, O: 0 });
  assert.deepEqual(after.scores, { X: 0, O: 0 });
});

/** Full but for the front face's last corner. X has five lines on F; O has one line on each of D and U. */
function nearlyDone(config: GameConfig, upLine = true): CubeState {
  const OLINE: Cell[] = [2, 2, 2, 1, 1, 2, 1, 2, 1];
  const stickers = faces({ [F]: [1, 1, 1, 1, 1, 1, 1, 1, 0], [D]: OLINE, 0: upLine ? OLINE : NO_LINES });
  return literal(config, stickers, { toMove: "O" });
}

test("the winner is decided by scores: faces and lines can disagree", () => {
  const lines = apply(nearlyDone(cfg("lines")), place(F, 8));
  assert.deepEqual(lines.lines, { X: 5, O: 2 });
  assert.equal(lines.status, "won");
  assert.equal(lines.winner, "X");
  const byFaces = apply(nearlyDone(cfg("faces")), place(F, 8));
  assert.deepEqual(byFaces.scores, { X: 1, O: 2 });
  assert.equal(byFaces.status, "won");
  assert.equal(byFaces.winner, "O");
});

test("equal face scores tie even when the lines differ", () => {
  const done = apply(nearlyDone(cfg("faces"), false), place(F, 8));
  assert.deepEqual(done.scores, { X: 1, O: 1 });
  assert.equal(done.status, "tie");
  assert.equal(done.winner, null);
});

test("lock and faces together end the game by the lock and score by faces", () => {
  const stickers = faces({ [F]: [1, 1, 1, 2, 0, 2, 2, 1, 2] });
  // F has an X line and one empty sticker, every other face is full: no open face has room
  const s = literal(cfg("faces", true), stickers, { phase: "rotate", pendingRotateFor: "X", toMove: "X" });
  const done = apply(s, rotate("y", 0, 1));
  assert.equal(done.status, "won");
  assert.equal(done.winner, "X");
  assert.deepEqual(done.scores, { X: 1, O: 0 });
});
