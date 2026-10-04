import { test } from "node:test";
import assert from "node:assert/strict";
import { boardName, whereToPlay, cellPosition } from "../../src/ui/board-ultimate.ts";
import { newGame, apply } from "../../src/core/ultimate.ts";
import type { GameConfig, UltimateMove } from "../../src/core/types.ts";

const config = (size: 3 | 4 | 5 = 3): GameConfig => ({ variant: "ultimate", size, winLength: 3, mode: "local" });
const mv = (board: number, cell: number): UltimateMove => ({ t: "place", board, cell });

test("every small board has its own name, by position", () => {
  const names = Array.from({ length: 9 }, (_, i) => boardName(i));
  assert.equal(new Set(names).size, 9);
  assert.equal(boardName(0), "top left board");
  assert.equal(boardName(2), "top right board");
  assert.equal(boardName(4), "centre board");
  assert.equal(boardName(8), "bottom right board");
});

test("on 4×4 and 5×5 each board is named by its row and column, and all names differ", () => {
  for (const size of [4, 5] as const) {
    const names = Array.from({ length: size * size }, (_, i) => boardName(i, size));
    assert.equal(new Set(names).size, size * size);
  }
  assert.equal(boardName(0, 4), "row 1, column 1 board");
  assert.equal(boardName(15, 4), "row 4, column 4 board");
  assert.equal(boardName(12, 5), "row 3, column 3 board");
  assert.equal(boardName(24, 5), "row 5, column 5 board");
});

test("whereToPlay names the forced board, or says any open board", () => {
  assert.equal(whereToPlay(newGame(config())), "Play in any open board.");
  assert.equal(whereToPlay(apply(newGame(config()), mv(4, 2))), "Play in the top right board.");
  assert.equal(whereToPlay(apply(newGame(config(4)), mv(4, 7))), "Play in the row 2, column 4 board.");
  assert.equal(whereToPlay(apply(newGame(config(5)), mv(0, 24))), "Play in the row 5, column 5 board.");
});

test("a cell's place in the big grid, and back, for every size", () => {
  for (const size of [3, 4, 5] as const) {
    const n2 = size * size;
    const seen = new Set<string>();
    for (let board = 0; board < n2; board++) {
      for (let cell = 0; cell < n2; cell++) {
        const { row, col } = cellPosition.toGlobal(board, cell, size);
        assert.ok(row >= 0 && row < n2 && col >= 0 && col < n2);
        seen.add(`${row},${col}`);
        assert.deepEqual(cellPosition.fromGlobal(row, col, size), { board, cell });
      }
    }
    assert.equal(seen.size, n2 * n2);
  }
});
