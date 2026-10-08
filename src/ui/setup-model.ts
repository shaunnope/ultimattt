// The start screen's rules, with no DOM: what the choices mean, which ones go together, and how they become a game config.
// Setup.svelte shows them; they are unit-tested in tests/unit/setup.test.ts. Against the computer a seed can be pasted: it
// decides the variant, size and win length, and the game uses that seed; any other text is turned into a seed. Only games with a computer have a seed at all.

import type { GameConfig, Level, Mode, Variant } from "../core/types.ts";
import { newSeed, parseSeed, pickMark, randomMark, resolveSeed, type SeedReading } from "../core/seed.ts";
import { clampWinLength, defaultWinLength, winLengthOptions } from "../core/rules.ts";
import type { SetupChoice } from "../core/settings.ts";

export const LEVEL_NAMES: Record<Level, string> = {
  1: "Beginner",
  2: "Casual",
  3: "Steady",
  4: "Sharp",
  5: "Master",
};

export type SetupState = SetupChoice;

export const DEFAULT_SETUP: SetupState = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 3, markChoice: "random" };

export const VARIANTS: { value: Variant; title: string; blurb: string }[] = [
  { value: "classic", title: "Classic", blurb: "One board; get a line in a row" },
  { value: "ultimate", title: "Ultimate", blurb: "Boards within boards; your move picks their board" },
  { value: "cube", title: "Twist", blurb: "Six faces in 3D; score, then turn a layer" },
];

/** Opponents a variant offers. Every variant can be played on one device or on two; the Cube has no computer opponent. */
export function modesFor(variant: Variant): Mode[] {
  return variant === "cube" ? ["local", "network"] : ["computer", "local", "network"];
}

/** What the start screen opens on: the last choices, or the defaults. */
export function initialSetup(saved: SetupChoice | null): SetupState {
  const state: SetupState = { ...(saved ?? DEFAULT_SETUP) };
  const allowed = modesFor(state.variant);
  if (!allowed.includes(state.mode)) state.mode = allowed[0]!;
  state.winLength = clampWinLength(state.variant, state.size, state.winLength);
  return state;
}

/** The win length choice for the chosen size: 3 up to the size, and fixed (no real choice) on a 3×3 board. */
export function winLengthChoice(state: SetupState): { options: number[]; fixed: boolean; value: number } {
  return { options: winLengthOptions(state.size), fixed: state.size === 3, value: clampWinLength(state.variant, state.size, state.winLength) };
}

/** A new board size always sets that size's default win length, in every variant. The same size changes nothing. */
export function chooseSize(state: SetupState, size: 3 | 4 | 5): SetupState {
  if (size === state.size) return state;
  return { ...state, size, winLength: defaultWinLength(size) };
}

/** A new variant keeps the board size and a valid win length, and moves to an opponent the variant offers. */
export function chooseVariant(state: SetupState, variant: Variant): SetupState {
  const allowed = modesFor(variant);
  return { ...state, variant, mode: allowed.includes(state.mode) ? state.mode : allowed[0]!, winLength: clampWinLength(variant, state.size, state.winLength) };
}

/** The start screen's choices plus the seed text typed so far (null when there is none). */
export interface SetupForm {
  choice: SetupState;
  seed: string | null;
}

/** Only a game against the computer has a seed. */
export const seedControlsVisible = (state: SetupState): boolean => state.mode === "computer" && state.variant !== "cube";

/** Choosing another opponent: leaving the computer discards any typed seed, and coming back starts with an empty field. */
export function chooseMode(form: SetupForm, mode: Mode): SetupForm {
  const choice = { ...form.choice, mode };
  return { choice, seed: seedControlsVisible(choice) ? form.seed : null };
}

/** Turn the choices into a game config. A seed is made (or the given one used) only for a computer game. */
export function configFromSetup(state: SetupState, seed?: string): GameConfig {
  const mode = modesFor(state.variant).includes(state.mode) ? state.mode : modesFor(state.variant)[0]!;
  const winLength = clampWinLength(state.variant, state.size, state.winLength);
  const cube = state.variant === "cube";
  const config: GameConfig = { variant: state.variant, size: state.size, winLength, scoring: cube ? state.scoring : "lines", lockFaces: cube && state.lockFaces, mode };
  if (mode === "computer") {
    const gameSeed = seed ?? newSeed(state.variant, state.size, winLength);
    config.seed = gameSeed;
    config.level = state.level;
    config.humanMark = state.markChoice === "random" ? pickMark(gameSeed) : state.markChoice;
  } else if (mode === "network") {
    // In a two-device game the host picks a mark (or one is drawn now); the guest takes the other one.
    config.humanMark = state.markChoice === "random" ? randomMark() : state.markChoice;
  }
  return config;
}

/** What the seed box says. A seed in any spelling decides the variant, board size and win length (and Cube is never against
 *  the computer); any other text decides nothing but the seed, which is made from it. Blank text has no reading. */
export function applySeedText(state: SetupState, text: string): { state: SetupState; reading: SeedReading | null } {
  const reading = resolveSeed(text, { variant: state.variant, size: state.size, winLength: clampWinLength(state.variant, state.size, state.winLength) });
  if (reading?.kind !== "exact") return { state, reading };
  const next: SetupState = { ...state, variant: reading.variant, size: reading.size, winLength: reading.winLength };
  if (!modesFor(reading.variant).includes(next.mode)) next.mode = modesFor(reading.variant)[0]!;
  return { state: next, reading };
}

/** The seed shown in an empty seed box, and played when the box stays empty: kept while the rules it carries are the ones
 *  chosen, and made anew when they change. Level, mark and opponent do not matter to it. */
export function placeholderFor({ variant, size, winLength }: Pick<SetupState, "variant" | "size" | "winLength">, previous: string | null): string {
  const kept = previous === null ? null : parseSeed(previous);
  winLength = clampWinLength(variant, size, winLength);
  return kept && !("error" in kept) && kept.variant === variant && kept.size === size && kept.winLength === winLength ? previous! : newSeed(variant, size, winLength);
}
