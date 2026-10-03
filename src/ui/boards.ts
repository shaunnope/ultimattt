// One place that builds the right board component for a variant.

import type { GameConfig, Mark, Move } from "../core/types.ts";
import type { AnyGameState } from "../core/variants.ts";
import type { AnyHint } from "./hints.ts";
import type { HintSet } from "../core/types.ts";
import { createClassicBoard } from "./board-classic.ts";
import { createUltimateBoard } from "./board-ultimate.ts";
import { createCubeBoard } from "./board-cube.ts";
import type { CubeState } from "../core/cube.ts";

export interface BoardView {
  element: HTMLElement;
  update(state: AnyGameState): void;
  setHints(hints: HintSet<AnyHint>): void;
}

export interface BoardOptions {
  /** A replay shows positions but takes no moves (and no layer-turn picker) */
  readOnly?: boolean;
  /** Whether this device may make the next move (two-device play); the Cube hides its layer picker when not */
  mayMove?: (state: AnyGameState) => boolean;
  glyph?: (mark: Mark) => string;
}

export function createBoard(config: GameConfig, onMove: (move: Move) => void, opts: BoardOptions = {}): BoardView {
  const glyphOption = opts.glyph ? { glyph: opts.glyph } : {};
  let view: { element: HTMLElement; update(state: never): void; setHints(hints: never): void };
  if (config.variant === "ultimate") view = createUltimateBoard({ onMove, ...glyphOption });
  else if (config.variant === "cube") view = createCubeBoard({ onMove, readOnly: opts.readOnly ?? false, ...(opts.mayMove ? { mayMove: opts.mayMove as (state: CubeState) => boolean } : {}), ...glyphOption });
  else view = createClassicBoard({ size: config.size, onCell: (cell) => onMove({ t: "place", cell }), ...glyphOption });
  if (opts.readOnly) view.element.classList.add("read-only");
  return view as unknown as BoardView;
}
