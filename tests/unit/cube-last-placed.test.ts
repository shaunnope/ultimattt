import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, apply, undo, fromMoves, rotateTable, lastPlacedSticker } from "../../src/core/cube.ts";
import type { CubeMove, GameConfig } from "../../src/core/types.ts";

const cfg = (size: 3 | 4 | 5, winLength = 3): GameConfig => ({ variant: "cube", size, winLength, scoring: "lines", lockFaces: false, mode: "local" });
const place = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const rotate = (axis: "x" | "y" | "z", layer: number, dir: 1 | -1 | 2): CubeMove => ({ t: "rotate", axis, layer, dir });
const F = 2;
const D = 1;

/** X scores on the front face's top row; O has two marks on the top face. The next move is X's layer turn. */
const scoring = (size: 3 | 4 | 5, winLength = 3) => {
  const moves = [place(F, 0), place(0, 0), place(F, 1), place(0, 1), place(F, 2)];
  return fromMoves(cfg(size, winLength), moves);
};

test("a new game has no last placed sticker", () => {
  assert.equal(lastPlacedSticker(newGame(cfg(3))), null);
});

test("after one placement it is that sticker", () => {
  const s = apply(newGame(cfg(3)), place(F, 4));
  assert.equal(lastPlacedSticker(s), F * 9 + 4);
});

test("a later placement replaces it", () => {
  const s = fromMoves(cfg(3), [place(F, 4), place(D, 1)]);
  assert.equal(lastPlacedSticker(s), D * 9 + 1);
});

test("a layer turn that does not include the mark leaves it alone", () => {
  // the middle z slice leaves the front face's top row (cells 0..2) ... check with a mark the slice does not carry
  const s = apply(scoring(3), rotate("z", 1, 1));
  // last placed is F cell 2; the z middle layer (layer 1) carries stickers at z = 0 only, F is the outer z = +2 plane
  assert.equal(lastPlacedSticker(s), F * 9 + 2);
});

test("a layer turn that includes the mark moves it to where the sticker went", () => {
  for (const size of [3, 4, 5] as const) {
    const before = scoring(size);
    const idx = lastPlacedSticker(before)!;
    const turn = rotate("z", size - 1, 1); // the face layer holding F (z is the axis towards the viewer)
    const after = apply(before, turn);
    const table = rotateTable(size, "z", size - 1, 1);
    const expected = table.findIndex((src) => src === idx);
    assert.equal(lastPlacedSticker(after), expected, `size ${size}`);
    assert.equal(after.stickers[expected], before.stickers[idx], "the mark really is there");
    assert.notEqual(expected, idx);
  }
});

test("it follows two successive turns", () => {
  // only the move list matters to lastPlacedSticker, so a literal list can chain turns without scoring in between
  const moves: CubeMove[] = [place(F, 2), rotate("z", 2, 1), rotate("y", 2, 1)];
  const state = { ...newGame(cfg(3)), moves };
  const step = (idx: number, axis: "x" | "y" | "z", dir: 1 | -1 | 2) => rotateTable(3, axis, 2, dir).findIndex((src) => src === idx);
  const expected = step(step(F * 9 + 2, "z", 1), "y", 1);
  assert.equal(lastPlacedSticker(state), expected);
});

test("turns after the last placement still give the mark's current index", () => {
  const s = apply(scoring(3), rotate("y", 2, 1));
  const idx = lastPlacedSticker(s)!;
  assert.equal(s.stickers[idx], 1, "it is an X sticker");
  assert.equal(s.moves.at(-1)!.t, "rotate");
});

test("after undo it follows the move list: a turn is undone with the placement that caused it", () => {
  const s = apply(scoring(3), rotate("z", 2, 1));
  const back = undo(s);
  assert.equal(back.moves.length, 4);
  assert.equal(lastPlacedSticker(back), 0 * 9 + 1);
  let g = back;
  while (g.moves.length > 0) g = undo(g);
  assert.equal(lastPlacedSticker(g), null);
});

test("it works on 4×4 and 5×5", () => {
  for (const size of [4, 5] as const) {
    const s = fromMoves(cfg(size, 3), [place(F, 0), place(0, 0)]);
    assert.equal(lastPlacedSticker(s), 0);
  }
});
