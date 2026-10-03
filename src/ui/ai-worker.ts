// The computer's Web Worker. It rebuilds the position from the config and move list, so
// the page only has to send plain data, and answers with the chosen move.

import type { GameConfig, Level, Move } from "../core/types.ts";
import { chooseMove } from "../core/ai.ts";
import { rngFor } from "../core/seed.ts";
import { fromMoves } from "../core/variants.ts";

interface Request {
  id: number;
  config: GameConfig;
  moves: Move[];
  level: Level;
}

/** Shared by the worker and the page's inline fallback. */
export function solve(req: Request): Move {
  const state = fromMoves(req.config, req.moves);
  return chooseMove(req.config.variant, state, req.level, rngFor(req.config.seed, req.moves.length));
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<Request>) => void) | null; postMessage(message: unknown): void };
if (typeof (self as { document?: unknown }).document === "undefined") {
  scope.onmessage = (e) => {
    scope.postMessage({ id: e.data.id, move: solve(e.data) });
  };
}
