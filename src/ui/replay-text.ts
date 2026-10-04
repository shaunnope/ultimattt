// Words for the move list in a replay. Pure: no DOM.

import type { CubeRotate, GameConfig, Mark, Move } from "../core/types.ts";
import { turnName, type NotationStyle } from "../core/notation.ts";
import { boardName } from "./board-ultimate.ts";
import { FACE_NAMES } from "./cube-labels.ts";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** One line of the move list. Cube turns are named in the player's chosen style (words by default). */
export function describeMove(config: GameConfig, move: Move, mover: Mark, n: number, notation: NotationStyle = "words"): string {
  const prefix = `${n}. ${mover}:`;
  const size = config.size;
  if (config.variant === "classic") {
    const { cell } = move as { cell: number };
    return `${prefix} row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;
  }
  if (config.variant === "ultimate") {
    const { board, cell } = move as { board: number; cell: number };
    return `${prefix} ${boardName(board, size)}, row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;
  }
  if (move.t === "rotate") {
    const text = turnName(move as CubeRotate, size, notation);
    return `${prefix} ${notation === "words" ? lowerFirst(text) : text}`;
  }
  const { face, cell } = move as { face: number; cell: number };
  return `${prefix} ${FACE_NAMES[face]} face, row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;
}
