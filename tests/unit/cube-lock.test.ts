import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, apply, isLegal, legalMoves, hints, undo, fromMoves, lockedFaces, countLines, scoreOf, REASONS } from "../../src/core/cube.ts";
import type { CubeState } from "../../src/core/cube.ts";
import type { Cell, CubeMove, GameConfig } from "../../src/core/types.ts";

const cfg = (size: 3 | 4 | 5, winLength: number, lockFaces: boolean, scoring: "lines" | "faces" = "lines"): GameConfig =>
  ({ variant: "cube", size, winLength, scoring, lockFaces, mode: "local" });
const place = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const rotate = (axis: "x" | "y" | "z", layer: number, dir: 1 | -1 | 2): CubeMove => ({ t: "rotate", axis, layer, dir });
const F = 2;
const D = 1;

function literal(config: GameConfig, stickers: Cell[], patch: Partial<CubeState> = {}): CubeState {
  const { size, winLength, scoring } = config;
  return {
    ...newGame(config),
    stickers,
    lines: countLines(stickers, size, winLength),
    scores: scoreOf(stickers, size, winLength, scoring),
    empty: stickers.filter((c) => c === 0).length,
    ...patch,
  };
}

const NO_LINES: Cell[] = [1, 2, 1, 1, 2, 2, 2, 1, 1];
/** Five full faces with no lines, and face F holding an X line on its top row with only its centre empty. */
const lockedFaceFull = (): Cell[] => Array.from({ length: 6 }, (_, f) => (f === F ? ([1, 1, 1, 2, 0, 2, 2, 1, 2] as Cell[]) : NO_LINES)).flat();

/** X makes a line on the front face's top row, then turns the middle slice (which leaves that row alone). */
const lineThenTurn = (turn: CubeMove = rotate("z", 1, 1)): CubeMove[] =>
  [place(F, 0), place(D, 0), place(F, 1), place(D, 1), place(F, 2), turn];

test("REASONS includes face-locked", () => {
  assert.ok((REASONS as readonly string[]).includes("face-locked"));
});

test("a face with a line of either player is locked; no lines means none; rotations recompute it", () => {
  const empty = newGame(cfg(3, 3, true));
  assert.deepEqual(lockedFaces(empty.stickers, 3, 3), []);
  const state = fromMoves(cfg(3, 3, true), lineThenTurn());
  assert.deepEqual(lockedFaces(state.stickers, 3, 3), [F]);
  // O's line locks a face too
  const o = literal(cfg(3, 3, true), Array.from({ length: 54 }, (_, i) => (i >= 9 * 3 && i < 9 * 3 + 3 ? 2 : 0)) as Cell[]);
  assert.deepEqual(lockedFaces(o.stickers, 3, 3), [3]);
  // turning a layer that carries the line's marks away reopens the face
  const broken = apply(fromMoves(cfg(3, 3, true), lineThenTurn().slice(0, 5)), rotate("x", 0, 1));
  assert.deepEqual(lockedFaces(broken.stickers, 3, 3), []);
});

test("with the lock on, placing on a locked face is refused as face-locked; with it off it is fine", () => {
  const on = fromMoves(cfg(3, 3, true), lineThenTurn());
  assert.deepEqual(isLegal(on, place(F, 3)), { ok: false, reason: "face-locked" });
  assert.deepEqual(isLegal(on, place(0, 0)), { ok: true });
  assert.throws(() => apply(on, place(F, 3)), /face-locked/);
  const off = fromMoves(cfg(3, 3, false), lineThenTurn());
  assert.deepEqual(isLegal(off, place(F, 3)), { ok: true });
});

test("rotations are never refused by the lock", () => {
  const scored = fromMoves(cfg(3, 3, true), lineThenTurn().slice(0, 5));
  assert.equal(scored.phase, "rotate");
  for (const m of legalMoves(scored)) assert.deepEqual(isLegal(scored, m), { ok: true });
});

test("the first line on an open face is allowed and still forces a turn", () => {
  const s = fromMoves(cfg(3, 3, true), lineThenTurn().slice(0, 5));
  assert.equal(s.phase, "rotate");
  assert.equal(s.pendingRotateFor, "X");
  assert.equal(s.toMove, "X");
  assert.deepEqual(s.lines, { X: 1, O: 0 });
});

test("legalMoves leaves out placements on locked faces", () => {
  const s = fromMoves(cfg(3, 3, true), lineThenTurn());
  const moves = legalMoves(s);
  assert.ok(moves.every((m) => m.t === "place" && m.face !== F));
  assert.equal(moves.length, 54 - 5 - 6);
  const off = fromMoves(cfg(3, 3, false), lineThenTurn());
  assert.equal(legalMoves(off).length, 54 - 5);
});

test("hints give nothing on a locked face", () => {
  const stickers: Cell[] = Array<Cell>(54).fill(0);
  for (const cell of [0, 1, 2, 3, 4]) stickers[F * 9 + cell] = 1;
  const on = literal(cfg(3, 3, true), stickers);
  const off = literal(cfg(3, 3, false), stickers);
  assert.ok(hints(off, "X").win.some((h) => h.face === F && h.cell === 5));
  assert.deepEqual(hints(on, "X"), { win: [], block: [] });
});

test("the game ends at once when no empty sticker lies on an open face: after a placement", () => {
  const stickers = lockedFaceFull();
  stickers[1 * 9 + 8] = 0; // one empty sticker on the open face D, the other on locked F
  const s = literal(cfg(3, 3, true), stickers, { toMove: "O" });
  assert.equal(s.empty, 2);
  const done = apply(s, place(1, 8));
  assert.equal(done.status, "won");
  assert.equal(done.winner, "X");
  assert.equal(done.phase, "place");
  assert.deepEqual(legalMoves(done), []);
  // lock off: the centre of F is still playable, so the game goes on
  const off = apply(literal(cfg(3, 3, false), stickers, { toMove: "O" }), place(1, 8));
  assert.equal(off.status, "playing");
});

test("the game ends at once when no empty sticker lies on an open face: after a rotation, and ties are ties", () => {
  const pending = { phase: "rotate" as const, pendingRotateFor: "X" as const, toMove: "X" as const };
  const s = literal(cfg(3, 3, true), lockedFaceFull(), pending);
  const done = apply(s, rotate("y", 0, 1));
  assert.deepEqual(done.lines, s.lines, "turning the bottom layer makes and breaks nothing here");
  assert.equal(done.status, "won");
  assert.equal(done.winner, "X");
  // an O line elsewhere as well: lines are level, so it is a tie
  const stickers = lockedFaceFull();
  [2, 2, 2, 1, 1, 2, 1, 2, 1].forEach((v, c) => (stickers[c] = v as Cell)); // face U: one O line
  const level = apply(literal(cfg(3, 3, true), stickers, pending), rotate("y", 0, 1));
  assert.deepEqual(level.lines, { X: 1, O: 1 });
  assert.equal(level.status, "tie");
  assert.equal(level.winner, null);
});

test("undo restores the position and the locks", () => {
  const config = cfg(3, 3, true);
  const moves = lineThenTurn();
  const s = fromMoves(config, moves);
  const back = undo(s);
  assert.deepEqual(back, fromMoves(config, moves.slice(0, 4)));
  assert.deepEqual(lockedFaces(back.stickers, 3, 3), []);
  assert.deepEqual(isLegal(back, place(F, 3)), { ok: true });
});

test("a 4×4 cube with win length 3 locks and refuses the same way", () => {
  const config = cfg(4, 3, true);
  const s = fromMoves(config, lineThenTurn());
  assert.deepEqual(lockedFaces(s.stickers, 4, 3), [F]);
  assert.deepEqual(isLegal(s, place(F, 3)), { ok: false, reason: "face-locked" });
  assert.deepEqual(isLegal(s, place(0, 3)), { ok: true });
});
