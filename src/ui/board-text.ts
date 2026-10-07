// The words of the Ultimate board and the layout arithmetic for moving across it with the arrow keys. Pure: no DOM.

import type { UltimateState } from "../core/ultimate.ts";
import { playable } from "../core/ultimate.ts";

const NAMES = ["top left", "top middle", "top right", "middle left", "centre", "middle right", "bottom left", "bottom middle", "bottom right"];

/** A small board's name. 3×3 uses compass words; larger grids use row and column. */
export const boardName = (board: number, size = 3): string =>
  size === 3 ? `${NAMES[board]} board` : `row ${Math.floor(board / size) + 1}, column ${(board % size) + 1} board`;

/** Where the next player must play, in words. */
export function whereToPlay(state: UltimateState): string {
  const open = playable(state);
  if (open.length === 0) return "";
  if (state.forced === null) return "Play in any open board.";
  return `Play in the ${boardName(state.forced, state.config.size)}.`;
}

/** A cell's row and column in the N²×N² layout, and back. */
export const cellPosition = {
  toGlobal(board: number, cell: number, n: number): { row: number; col: number } {
    return { row: Math.floor(board / n) * n + Math.floor(cell / n), col: (board % n) * n + (cell % n) };
  },
  fromGlobal(row: number, col: number, n: number): { board: number; cell: number } {
    return { board: Math.floor(row / n) * n + Math.floor(col / n), cell: (row % n) * n + (col % n) };
  },
};
