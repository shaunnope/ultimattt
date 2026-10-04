// Words for the move list in a replay. Pure: no DOM.

import type { CubeRotate, GameConfig, Mark, Move } from "../core/types.ts";
import { turnName, type NotationStyle } from "../core/notation.ts";
import { boardName } from "./board-ultimate.ts";
import { FACE_LETTERS, FACE_NAMES } from "./cube-labels.ts";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** One entry of the move list: the short `label` shown (no mark, since the move number says who moved) and a words-only
 *  `name` for assistive technology, which does say who. */
export interface MoveText {
  label: string;
  name: string;
}

/** A cell as AcB: row A, column B, both counted from 1. */
const cellLabel = (cell: number, size: number): string => `${Math.floor(cell / size) + 1}c${(cell % size) + 1}`;
const cellWords = (cell: number, size: number): string => `row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;

/** Cube turns are named in the player's chosen style (words by default). */
export function describeMove(config: GameConfig, move: Move, mover: Mark, n: number, notation: NotationStyle = "words"): MoveText {
  const size = config.size;
  const entry = (label: string, words: string): MoveText => ({ label: `${n}. ${label}`, name: `Move ${n}, ${mover}, ${words}` });
  if (config.variant === "classic") {
    const { cell } = move as { cell: number };
    return entry(cellLabel(cell, size), cellWords(cell, size));
  }
  if (config.variant === "ultimate") {
    const { board, cell } = move as { board: number; cell: number };
    return entry(`${boardName(board, size)} ${cellLabel(cell, size)}`, `${boardName(board, size)}, ${cellWords(cell, size)}`);
  }
  if (move.t === "rotate") {
    const text = turnName(move as CubeRotate, size, notation);
    const turn = notation === "words" ? lowerFirst(text) : text;
    return entry(turn, notation === "words" ? turn : lowerFirst(turnName(move as CubeRotate, size, "words")));
  }
  const { face, cell } = move as { face: number; cell: number };
  return entry(`${FACE_LETTERS[face]}${cellLabel(cell, size)}`, `${FACE_NAMES[face]} face, ${cellWords(cell, size)}`);
}
