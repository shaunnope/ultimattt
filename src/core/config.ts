// Reading a game setup from untrusted data (a save file, a message from the other device).

import type { GameConfig, Level, Mark, Mode, Variant } from "./types.ts";
import { legacyWinLength } from "./rules.ts";

const VARIANTS: Variant[] = ["classic", "ultimate", "cube"];
const MODES: Mode[] = ["computer", "local", "network"];

/** A valid GameConfig, or null when anything about it is off. A config with no win length is a 001 one and gets its legacy default. */
export function parseConfig(raw: unknown): GameConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!VARIANTS.includes(c.variant as Variant) || !MODES.includes(c.mode as Mode)) return null;
  if (![3, 4, 5].includes(c.size as number)) return null;
  const variant = c.variant as Variant;
  const size = c.size as 3 | 4 | 5;
  let winLength = legacyWinLength(variant, size);
  if (c.winLength !== undefined) {
    if (typeof c.winLength !== "number" || !Number.isInteger(c.winLength) || c.winLength < 3 || c.winLength > size) return null;
    winLength = c.winLength;
  }
  const mode = c.mode as Mode;
  if (variant === "cube" && mode === "computer") return null;
  const config: GameConfig = { variant, size, winLength, mode };
  if (mode === "computer") {
    if (typeof c.seed !== "string") return null;
    config.seed = c.seed;
  }
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
