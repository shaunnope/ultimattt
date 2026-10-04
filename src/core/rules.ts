// The two numbers that define a game besides its variant: board size N (3 to 5) and win length K (3 to N).
// Pure: no DOM, storage, network or clock.

import type { Variant } from "./types.ts";

export type Size = 3 | 4 | 5;

export interface Rules {
  variant: Variant;
  size: Size;
  winLength: number;
}

const LETTERS: Record<Variant, string> = { classic: "C", ultimate: "U", cube: "B" };
const VARIANT_OF: Record<string, Variant> = { C: "classic", U: "ultimate", B: "cube" };

/** The win lengths a board of this size allows: 3 up to the size. */
export function winLengthOptions(size: number): number[] {
  return Array.from({ length: Math.max(0, size - 2) }, (_, i) => 3 + i);
}

/** Classic 4×4 and 5×5 default to four in a row; everything else to three. */
export function defaultWinLength(variant: Variant, size: number): number {
  return variant === "classic" && size >= 4 ? 4 : 3;
}

/** The win length a 001 game implied, which never carried one. */
export function legacyWinLength(variant: Variant, size: number): number {
  return defaultWinLength(variant, size);
}

/** `current` when it is valid for this size, otherwise the default. */
export function clampWinLength(variant: Variant, size: number, current: number): number {
  return Number.isInteger(current) && current >= 3 && current <= size ? current : defaultWinLength(variant, size);
}

export function rulesCode(variant: Variant, size: number, winLength: number): string {
  return `${LETTERS[variant]}${size}${winLength}`;
}

export function parseRulesCode(text: string): Rules | { error: string } {
  const m = /^([CUB])([345])([345])$/.exec(String(text ?? "").trim().toUpperCase());
  if (!m) return { error: `"${text}" is not a game code.` };
  const size = Number(m[2]) as Size;
  const winLength = Number(m[3]);
  if (winLength < 3 || winLength > size) return { error: "The win length cannot be longer than the board." };
  return { variant: VARIANT_OF[m[1]!]!, size, winLength };
}
