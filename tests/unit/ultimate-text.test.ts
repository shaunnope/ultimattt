import { test } from "node:test";
import assert from "node:assert/strict";
import { boardName, whereToPlay } from "../../src/ui/board-ultimate.ts";
import { newGame, apply } from "../../src/core/ultimate.ts";
import type { GameConfig, UltimateMove } from "../../src/core/types.ts";

const config: GameConfig = { variant: "ultimate", size: 3, mode: "local", seed: "ULT-BXK4-M9TR" };
const mv = (board: number, cell: number): UltimateMove => ({ t: "place", board, cell });

test("every small board has its own name, by position", () => {
  const names = Array.from({ length: 9 }, (_, i) => boardName(i));
  assert.equal(new Set(names).size, 9);
  assert.equal(boardName(0), "top left board");
  assert.equal(boardName(2), "top right board");
  assert.equal(boardName(4), "centre board");
  assert.equal(boardName(8), "bottom right board");
});

test("whereToPlay names the forced board, or says any open board", () => {
  assert.equal(whereToPlay(newGame(config)), "Play in any open board.");
  assert.equal(whereToPlay(apply(newGame(config), mv(4, 2))), "Play in the top right board.");
});
