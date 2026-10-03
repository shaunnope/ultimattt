// Words for the move list in a replay. Pure: no DOM.

import type { CubeRotate, GameConfig, Mark, Move } from "../core/types.ts";
import { boardName } from "./board-ultimate.ts";
import { FACE_NAMES, rotationLabel } from "./cube-labels.ts";
import { markGlyph } from "./glyph.ts";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function describeMove(config: GameConfig, move: Move, mover: Mark, n: number): string {
  const prefix = `${n}. ${markGlyph(mover)}:`;
  if (config.variant === "classic") {
    const { cell } = move as { cell: number };
    return `${prefix} row ${Math.floor(cell / config.size) + 1}, column ${(cell % config.size) + 1}`;
  }
  if (config.variant === "ultimate") {
    const { board, cell } = move as { board: number; cell: number };
    return `${prefix} ${boardName(board)}, row ${Math.floor(cell / 3) + 1}, column ${(cell % 3) + 1}`;
  }
  if (move.t === "rotate") return `${prefix} ${lowerFirst(rotationLabel(move as CubeRotate))}`;
  const { face, cell } = move as { face: number; cell: number };
  return `${prefix} ${FACE_NAMES[face]} face, row ${Math.floor(cell / 3) + 1}, column ${(cell % 3) + 1}`;
}
