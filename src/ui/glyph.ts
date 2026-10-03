// What to draw for each mark. The player may pick their own single characters in Settings; this is
// a display preference of this device only. It is never part of a game, a seed, a link or a message.

import type { Mark } from "../core/types.ts";
import { validateIcons } from "../core/icons.ts";

const DEFAULT = { X: "X", O: "O" };
let current = { ...DEFAULT };

/** Use these icons, or the letters if they are not valid. */
export function setGlyphs(icons: { X: string; O: string }): void {
  current = validateIcons(icons).ok ? { X: icons.X, O: icons.O } : { ...DEFAULT };
}

export function markGlyph(mark: Mark): string {
  return current[mark];
}
