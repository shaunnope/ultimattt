// A finished (or watched) game as a list of positions, one before any move and one after each,
// each with who made the move that led there. Pure: every frame is the rules played to that point.

import type { GameConfig, Mark, Move } from "./types.ts";
import type { AnyGameState } from "./variants.ts";
import { moduleFor } from "./variants.ts";

export interface Frame {
  state: AnyGameState;
  /** Who made the move that led to this frame; null for the starting position */
  mover: Mark | null;
}

export function replayFrames(config: GameConfig, moves: readonly Move[]): Frame[] {
  const mod = moduleFor(config);
  let state = mod.newGame(config);
  const frames: Frame[] = [{ state, mover: null }];
  for (const move of moves) {
    const mover = state.toMove;
    state = mod.apply(state, move);
    frames.push({ state, mover });
  }
  return frames;
}
