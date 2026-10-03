// Rebuilding a saved game by playing its moves through the rules. Kept apart from store.ts so the start
// screen can load without the rules; it is loaded only when there is a game to pick up.

import type { Mark } from "../core/types.ts";
import { decodeMoves } from "../core/tokens.ts";
import type { AnyGameState } from "../core/variants.ts";
import { fromMoves } from "../core/variants.ts";
import type { SavedGame } from "./store.ts";

/** Rebuild the position of a saved game, or null when its moves do not play. */
export function restoreGame(saved: SavedGame): { state: AnyGameState; resigned: Mark | null } | null {
  const moves = decodeMoves(saved.config.variant, saved.moves);
  if (!Array.isArray(moves)) return null;
  try {
    return { state: fromMoves(saved.config, moves), resigned: saved.resigned ?? null };
  } catch {
    return null;
  }
}
