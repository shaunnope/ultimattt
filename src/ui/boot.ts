// What the app opens on. The order is the one the start-up has always used: a ?join= code first, then a good ?watch= replay link
// (a bad one is explained and the rest carries on), then a game left in progress, then the start screen. A pure decision, so
// it is unit-tested; the routes carry it out (specs/007 data-model, Boot decision).

import type { SaveFile } from "../adapters/store.ts";
import { restoreGame } from "../adapters/restore.ts";
import { codeFromSearch } from "../core/pairing.ts";
import { unpackLink, type ReplayRecord } from "../core/record.ts";
import type { GameConfig, Mark, Move } from "../core/types.ts";
import type { AnyGameState } from "../core/variants.ts";

/** A game picked up where it was left. */
export interface RestoredGame {
  state: AnyGameState;
  resigned: Mark | null;
  startedAt: number;
}

/** What to do besides opening the screen. Only the keys that apply are present. */
interface Extras {
  /** Messages to show, in order. */
  toasts: string[];
  /** Take ?join= or ?watch= out of the address. */
  clearQuery?: true;
  /** The saved game is no use any more: forget it. */
  clearSave?: true;
}

export type Boot = Extras &
  (
    | { screen: "join"; code: string }
    | { screen: "watch"; record: ReplayRecord }
    | { screen: "host"; config: GameConfig; code: string; moves: Move[] }
    | { screen: "rejoin"; code: string }
    | { screen: "game"; config: GameConfig; restored: RestoredGame }
    | { screen: "setup" }
  );

/** The game left in progress, if there is one worth picking up. `extras` says what else to do. */
function ownGame(save: SaveFile, extras: Extras): Boot {
  const game = save.game;
  if (!game) return { screen: "setup", ...extras };
  const restored = restoreGame(game);
  if (!restored) return { screen: "setup", ...extras };
  if (game.config.mode === "network") {
    // A game this device was hosting carries on under the same code, and one it joined as a guest is joined again, unless it was finished.
    const over = restored.resigned !== null || restored.state.status !== "playing";
    if (game.hostCode && !over) return { screen: "host", config: game.config, code: game.hostCode, moves: restored.state.moves as Move[], ...extras };
    if (game.joinCode && !over) return { screen: "rejoin", code: game.joinCode, ...extras };
    return { screen: "setup", ...extras, clearSave: true };
  }
  return { screen: "game", config: game.config, restored: { state: restored.state, resigned: restored.resigned, startedAt: game.startedAt }, ...extras };
}

/**
 * Decide the opening screen from the address's query string and the saved file. `notice` is what reading the save had to say
 * (a corrupt save set aside, for one); it is shown only when the app goes on to the player's own game or the start screen.
 */
export function decideBoot(search: string, save: SaveFile, notice?: string): Boot {
  const code = codeFromSearch(search);
  if (code) return { screen: "join", code, clearQuery: true, toasts: [] };

  const extras: Extras = { toasts: [] };
  if (new URLSearchParams(search).has("watch")) {
    const record = unpackLink(search);
    if (!("error" in record)) return { screen: "watch", record, toasts: [] };
    extras.toasts.push(record.error);
    extras.clearQuery = true;
  }
  if (notice) extras.toasts.push(notice);
  return ownGame(save, extras);
}
