// Reading a game setup from untrusted data (a save file, a message from the other device).

import type { GameConfig, Level, Mark, Mode, Variant } from "./types.ts";

const VARIANTS: Variant[] = ["classic", "ultimate", "cube"];
const MODES: Mode[] = ["computer", "local", "network"];

/** A valid GameConfig, or null when anything about it is off. */
export function parseConfig(raw: unknown): GameConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!VARIANTS.includes(c.variant as Variant) || !MODES.includes(c.mode as Mode)) return null;
  if (![3, 4, 5].includes(c.size as number) || typeof c.seed !== "string") return null;
  const config: GameConfig = { variant: c.variant as Variant, size: c.size as 3 | 4 | 5, mode: c.mode as Mode, seed: c.seed };
  if (c.level !== undefined) {
    if (![1, 2, 3, 4, 5].includes(c.level as number)) return null;
    config.level = c.level as Level;
  }
  if (c.humanMark !== undefined) {
    if (c.humanMark !== "X" && c.humanMark !== "O") return null;
    config.humanMark = c.humanMark as Mark;
  }
  return config;
}
