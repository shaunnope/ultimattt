// What the game screen needs from a two-device session, and how the connection looks to the player. Types only: the session that
// implements them is ui/net-run.ts, and the game screen that uses them is Game.svelte.

import type { Mark, Move } from "../core/types.ts";
import type { AnyGameState } from "../core/variants.ts";

/** What the game needs from a two-device session. */
export interface NetHooks {
  readonly myMark: Mark;
  /** The position both devices share */
  state(): AnyGameState;
  resigned(): Mark | null;
  /** Each returns the reason it was refused, or null */
  move(move: Move): string | null;
  askUndo(): string | null;
  resign(): string | null;
  /** The code this device is hosting under (null for a guest) */
  readonly hostCode: string | null;
  /** The code a guest joined with, so a reload can join again */
  readonly joinCode: string | null;
  /** Leave the game and drop the connection */
  leave(): void;
  reconnect(): void;
}

export type ConnectionView = { state: "connected" } | { state: "lost"; message: string; canReconnect: boolean };
