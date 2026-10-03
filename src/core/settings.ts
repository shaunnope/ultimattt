// What a player can change. Pure: validation only, no storage.
// Icons are a display preference of this device; they never reach game state, seeds, links or the network.

import type { Level, Mark, Mode, Variant } from "./types.ts";
import { validateIcons } from "./icons.ts";

export type Theme = "auto" | "light" | "dark";
export type ReplaySpeed = 0.5 | 1 | 2 | 4;

/** What the start screen was last set to, so it opens on the same choices next time. */
export interface SetupChoice {
  variant: Variant;
  size: 3 | 4 | 5;
  mode: Mode;
  level: Level;
  markChoice: Mark | "random";
}

export interface Settings {
  hints: boolean;
  autoReplay: boolean;
  replaySpeed: ReplaySpeed;
  theme: Theme;
  icons: { X: string; O: string };
  /** The last start-screen choices, or null before there are any */
  lastSetup: SetupChoice | null;
}

export const DEFAULT_SETTINGS: Settings = {
  hints: false,
  autoReplay: true,
  replaySpeed: 1,
  theme: "auto",
  icons: { X: "X", O: "O" },
  lastSetup: null,
};

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
const THEMES: Theme[] = ["auto", "light", "dark"];

const VARIANTS: Variant[] = ["classic", "ultimate", "cube"];
const MODES: Mode[] = ["computer", "local", "network"];

/** The remembered start-screen choices, or null when anything about them is off. */
export function normalizeSetup(raw: unknown): SetupChoice | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!VARIANTS.includes(c.variant as Variant) || !MODES.includes(c.mode as Mode)) return null;
  if (![3, 4, 5].includes(c.size as number) || ![1, 2, 3, 4, 5].includes(c.level as number)) return null;
  if (c.markChoice !== "X" && c.markChoice !== "O" && c.markChoice !== "random") return null;
  return { variant: c.variant as Variant, size: c.size as 3 | 4 | 5, mode: c.mode as Mode, level: c.level as Level, markChoice: c.markChoice as Mark | "random" };
}

/** Anything that is not a valid setting becomes its default. */
export function normalizeSettings(input: unknown): Settings {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const icons = raw.icons as { X?: unknown; O?: unknown } | undefined;
  const wanted = { X: typeof icons?.X === "string" ? icons.X : "", O: typeof icons?.O === "string" ? icons.O : "" };
  return {
    hints: raw.hints === true,
    autoReplay: typeof raw.autoReplay === "boolean" ? raw.autoReplay : DEFAULT_SETTINGS.autoReplay,
    replaySpeed: SPEEDS.includes(raw.replaySpeed as ReplaySpeed) ? (raw.replaySpeed as ReplaySpeed) : DEFAULT_SETTINGS.replaySpeed,
    theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : DEFAULT_SETTINGS.theme,
    icons: validateIcons(wanted).ok ? wanted : { ...DEFAULT_SETTINGS.icons },
    lastSetup: normalizeSetup(raw.lastSetup),
  };
}
