// One place that builds the right board component for a variant.

import type { GameConfig, Move } from "../core/types.ts";
import type { AnyGameState } from "../core/variants.ts";
import type { AnyHint } from "./hints.ts";
import type { HintSet } from "../core/types.ts";
import type { NotationStyle } from "../core/notation.ts";
import { createClassicBoard } from "./board-classic.ts";
import { createUltimateBoard } from "./board-ultimate.ts";
import { createCubeBoard } from "./board-cube.ts";
import type { CubeState } from "../core/cube.ts";

export interface BoardView {
  element: HTMLElement;
  update(state: AnyGameState): void;
  setHints(hints: HintSet<AnyHint>): void;
  /** Drop anything half done on the board, such as a Cube turn being previewed (undo, a new game). */
  reset(): void;
}

export interface BoardOptions {
  /** A replay shows positions but takes no moves (and no layer-turn picker) */
  readOnly?: boolean;
  /** Whether this device may make the next move (two-device play); the Cube hides its layer picker when not */
  mayMove?: (state: AnyGameState) => boolean;
  /** How Cube turns are named. Display only. */
  notation?: NotationStyle;
}

export function createBoard(config: GameConfig, onMove: (move: Move) => void, opts: BoardOptions = {}): BoardView {
  let view: { element: HTMLElement; update(state: never): void; setHints(hints: never): void; reset?: () => void };
  if (config.variant === "ultimate") view = createUltimateBoard({ size: config.size, onMove });
  else if (config.variant === "cube") {
    view = createCubeBoard({
      size: config.size,
      onMove,
      readOnly: opts.readOnly ?? false,
      ...(opts.mayMove ? { mayMove: opts.mayMove as (state: CubeState) => boolean } : {}),
      ...(opts.notation ? { notation: opts.notation } : {}),
    });
  } else view = createClassicBoard({ size: config.size, onCell: (cell) => onMove({ t: "place", cell }) });
  if (opts.readOnly) view.element.classList.add("read-only");
  const reset = view.reset;
  return Object.assign(view, { reset: () => reset?.() }) as unknown as BoardView;
}
