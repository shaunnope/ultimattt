// Which cells to point out to the player on their turn (only when the Show hints setting is on).

import type { GameConfig, HintSet, Mark } from "../core/types.ts";
import type { AnyGameState } from "../core/variants.ts";
import * as classic from "../core/classic.ts";
import * as ultimate from "../core/ultimate.ts";
import * as cube from "../core/cube.ts";

/** A cell to point at. Classic has only `cell`; Ultimate adds `board`; the Cube adds `face`. */
export interface AnyHint {
  cell: number;
  board?: number;
  face?: number;
}

export const NO_HINTS: HintSet<AnyHint> = { win: [], block: [] };

export function hintsFor(config: GameConfig, state: AnyGameState, mark: Mark): HintSet<AnyHint> {
  if (config.variant === "ultimate") return ultimate.hints(state as ultimate.UltimateState, mark);
  if (config.variant === "cube") return cube.hints(state as cube.CubeState, mark);
  return classic.hints(state as classic.ClassicState, mark);
}
