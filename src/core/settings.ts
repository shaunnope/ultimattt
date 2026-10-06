// What a player can change. Pure: validation only, no storage.
// Mark colours and turn notation are display preferences of this device; they never reach game state,
// seeds, links or the network.

import type { Level, Mark, Mode, Scoring, Variant } from "./types.ts";
import { clampWinLength } from "./rules.ts";
import { DEFAULT_PALETTE, paletteById } from "./palette.ts";

/** The saved appearance. "auto" is what the interface calls System: the spelling stays so every earlier save opens (see ui/theme.ts). */
export type Theme = "auto" | "light" | "dark";
export type ReplaySpeed = 0.5 | 1 | 2 | 4;
/** How Cube turns are named: in plain words, or in cube-solving notation (R, U', 2L, ...) */
export type CubeNotation = "words" | "cube";

/** What the start screen was last set to, so it opens on the same choices next time. */
export interface SetupChoice {
  variant: Variant;
  size: 3 | 4 | 5;
  winLength: number;
  /** Cube only; "lines" and false everywhere else */
  scoring: Scoring;
  lockFaces: boolean;
  mode: Mode;
  level: Level;
  markChoice: Mark | "random";
}

export interface Settings {
  hints: boolean;
  autoReplay: boolean;
  replaySpeed: ReplaySpeed;
  theme: Theme;
  /** Id of one of the fixed X/O colour palettes (core/palette.ts) */
  markPalette: string;
  cubeNotation: CubeNotation;
  /** The last start-screen choices, or null before there are any */
  lastSetup: SetupChoice | null;
}

export const DEFAULT_SETTINGS: Settings = {
  hints: false,
  autoReplay: true,
  replaySpeed: 1,
  theme: "auto",
  markPalette: DEFAULT_PALETTE,
  cubeNotation: "words",
  lastSetup: null,
};

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
const THEMES: Theme[] = ["auto", "light", "dark"];
const NOTATIONS: CubeNotation[] = ["words", "cube"];

const VARIANTS: Variant[] = ["classic", "ultimate", "cube"];
const MODES: Mode[] = ["computer", "local", "network"];

/** The remembered start-screen choices, or null when anything about them is off. A missing or impossible win length becomes the default. */
export function normalizeSetup(raw: unknown): SetupChoice | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!VARIANTS.includes(c.variant as Variant) || !MODES.includes(c.mode as Mode)) return null;
  if (![3, 4, 5].includes(c.size as number) || ![1, 2, 3, 4, 5].includes(c.level as number)) return null;
  if (c.markChoice !== "X" && c.markChoice !== "O" && c.markChoice !== "random") return null;
  const variant = c.variant as Variant;
  const size = c.size as 3 | 4 | 5;
  const scoring = c.scoring === "faces" ? "faces" : "lines";
  return {
    variant,
    size,
    winLength: clampWinLength(variant, size, typeof c.winLength === "number" ? c.winLength : Number.NaN),
    scoring,
    lockFaces: c.lockFaces === true,
    mode: c.mode as Mode,
    level: c.level as Level,
    markChoice: c.markChoice as Mark | "random",
  };
}

/** Anything that is not a valid setting becomes its default. A stored 001 `icons` field is ignored. */
export function normalizeSettings(input: unknown): Settings {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return {
    hints: raw.hints === true,
    autoReplay: typeof raw.autoReplay === "boolean" ? raw.autoReplay : DEFAULT_SETTINGS.autoReplay,
    replaySpeed: SPEEDS.includes(raw.replaySpeed as ReplaySpeed) ? (raw.replaySpeed as ReplaySpeed) : DEFAULT_SETTINGS.replaySpeed,
    theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : DEFAULT_SETTINGS.theme,
    markPalette: typeof raw.markPalette === "string" ? paletteById(raw.markPalette).id : DEFAULT_PALETTE,
    cubeNotation: NOTATIONS.includes(raw.cubeNotation as CubeNotation) ? (raw.cubeNotation as CubeNotation) : DEFAULT_SETTINGS.cubeNotation,
    lastSetup: normalizeSetup(raw.lastSetup),
  };
}
