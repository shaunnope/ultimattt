import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame as classicGame, apply as classicApply, hints as classicHints } from "../../src/core/classic.ts";
import { newGame as ultimateGame, hints as ultimateHints } from "../../src/core/ultimate.ts";
import type { UltimateState } from "../../src/core/ultimate.ts";
import { newGame as cubeGame, apply as cubeApply, hints as cubeHints } from "../../src/core/cube.ts";
import type { CubeState } from "../../src/core/cube.ts";
import { countLines } from "../../src/core/cube.ts";
import type { Cell, ClassicMove, CubeMove, GameConfig } from "../../src/core/types.ts";

const classicConfig = (size: 3 | 4 | 5): GameConfig => ({ variant: "classic", size, winLength: size === 3 ? 3 : 4, mode: "local" });
const place = (cell: number): ClassicMove => ({ t: "place", cell });
const play = (size: 3 | 4 | 5, cells: number[]) => cells.reduce((s, c) => classicApply(s, place(c)), classicGame(classicConfig(size)));

test("Classic: a winning cell for me and a cell I must block, in order and without repeats", () => {
  // X: 0,1  O: 3,4  -> X wins at 2, and must block O at 5
  const s = play(3, [0, 3, 1, 4]);
  assert.deepEqual(classicHints(s, "X"), { win: [{ cell: 2 }], block: [{ cell: 5 }] });
  // from O's side it is the other way round
  assert.deepEqual(classicHints(s, "O"), { win: [{ cell: 5 }], block: [{ cell: 2 }] });
});

test("Classic: a fork shows every winning cell once", () => {
  // X: 0,2,6  threatens 1 (0-1-2), 3 (0-3-6) and 4 (2-4-6)
  const s = play(3, [0, 5, 2, 7, 6]);
  assert.deepEqual(classicHints(s, "X").win.map((h) => h.cell), [1, 3, 4]);
});

test("Classic: on 4x4 three in a row with an open end is a threat; two is not", () => {
  const s = play(4, [0, 4, 1, 5, 2, 15]);
  assert.deepEqual(classicHints(s, "X").win, [{ cell: 3 }]);
  assert.deepEqual(classicHints(play(4, [0, 4, 1]), "X").win, []);
});

test("Classic: nothing to show on an empty board or once the game is over", () => {
  assert.deepEqual(classicHints(classicGame(classicConfig(3)), "X"), { win: [], block: [] });
  const over = play(3, [0, 3, 1, 4, 2]);
  assert.deepEqual(classicHints(over, "O"), { win: [], block: [] });
});

const ultimateConfig: GameConfig = { variant: "ultimate", size: 3, winLength: 3, mode: "local" };

function ultimateWith(boards: Record<number, Cell[]>, patch: Partial<UltimateState> = {}): UltimateState {
  const base = ultimateGame(ultimateConfig);
  const all = base.boards.map((b, i) => boards[i] ?? b);
  return { ...base, boards: all, ...patch };
}

test("Ultimate: hints cover only the board(s) you may play", () => {
  // Forced into board 4: X has 0,1 there; O has 3,4 there. Board 0 also has X 0,1 but is not playable.
  const s = ultimateWith({ 4: [1, 1, 0, 2, 2, 0, 0, 0, 0], 0: [1, 1, 0, 0, 0, 0, 0, 0, 0] }, { forced: 4, toMove: "X" });
  assert.deepEqual(ultimateHints(s, "X"), { win: [{ board: 4, cell: 2 }], block: [{ board: 4, cell: 5 }] });
});

test("Ultimate: with a free choice every open board is covered", () => {
  const s = ultimateWith({ 0: [1, 1, 0, 0, 0, 0, 0, 0, 0], 8: [2, 2, 0, 0, 0, 0, 0, 0, 0] }, { forced: null, toMove: "X" });
  const h = ultimateHints(s, "X");
  assert.deepEqual(h.win, [{ board: 0, cell: 2 }]);
  assert.deepEqual(h.block, [{ board: 8, cell: 2 }]);
});

test("Ultimate: a claimed board shows nothing", () => {
  const s = ultimateWith({ 0: [1, 1, 1, 2, 2, 0, 0, 0, 0] }, { claims: [1, 0, 0, 0, 0, 0, 0, 0, 0], forced: null, toMove: "O" });
  assert.deepEqual(ultimateHints(s, "O").block, []);
});

const cubeConfig: GameConfig = { variant: "cube", size: 3, winLength: 3, mode: "local" };
const cplace = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const cubeFrom = (moves: CubeMove[]) => moves.reduce((s, m) => cubeApply(s, m), cubeGame(cubeConfig));

test("Cube: a cell that would complete a line is a win; the opponent's is a block", () => {
  // X: front 0,1   O: top 0,3
  const s = cubeFrom([cplace(2, 0), cplace(0, 0), cplace(2, 1), cplace(0, 3)]);
  assert.deepEqual(cubeHints(s, "X"), { win: [{ face: 2, cell: 2 }], block: [{ face: 0, cell: 6 }] });
});

test("Cube: hints look only at placing a mark, not at what a later layer turn would do", () => {
  const s = cubeFrom([cplace(2, 0), cplace(0, 0), cplace(2, 1), cplace(0, 1)]);
  for (const hint of [...cubeHints(s, "X").win, ...cubeHints(s, "X").block]) {
    const stickers = s.stickers.slice() as Cell[];
    assert.equal(stickers[hint.face * 9 + hint.cell], 0);
  }
  // no rotation can ever be listed as a hint
  assert.ok(cubeHints(s, "X").win.every((h) => "face" in h && "cell" in h));
});

test("Cube: nothing to show while a layer turn is due, or after the game", () => {
  const scored = cubeFrom([cplace(2, 0), cplace(0, 0), cplace(2, 1), cplace(0, 1), cplace(2, 2)]) as CubeState;
  assert.equal(scored.phase, "rotate");
  assert.deepEqual(cubeHints(scored, "X"), { win: [], block: [] });
  assert.equal(countLines(scored.stickers, 3, 3).X, 1);
});
