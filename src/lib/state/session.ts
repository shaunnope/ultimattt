// What the next screen should do, handed over when one route sends the player to another (Start on the start screen goes to the
// game, a ?join= link goes to the game, and so on). A page that is opened cold, by a reload or a typed address, finds nothing
// here and works it out from the address and the saved game instead (ui/boot.ts).
import type { ReplayRecord } from "../../core/record.ts";
import type { GameConfig, Move } from "../../core/types.ts";
import type { RestoredGame } from "../../ui/boot.ts";

export type Intent =
  | { kind: "new"; config: GameConfig }
  | { kind: "resume"; config: GameConfig; restored: RestoredGame }
  | { kind: "host"; config: GameConfig; resume?: { code: string; moves: Move[] } }
  | { kind: "join"; code: string }
  | { kind: "watch"; record: ReplayRecord };

let intent: Intent | null = null;
let setupSeed: string | null = null;

export function setIntent(next: Intent): void {
  intent = next;
}

/** The pending intent, once: reading it clears it, so a reload does not repeat it. */
export function takeIntent(): Intent | null {
  const now = intent;
  intent = null;
  return now;
}

/** A seed for the start screen to open with (from "Play this seed" on a replay link). */
export function setSetupSeed(seed: string | null): void {
  setupSeed = seed;
}

export function takeSetupSeed(): string | null {
  const now = setupSeed;
  setupSeed = null;
  return now;
}
