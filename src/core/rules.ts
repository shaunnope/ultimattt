// The two numbers that define a game besides its variant: board size N (3 to 5) and win length K (3 to N).
// Pure: no DOM, storage, network or clock.

import type { Scoring, Variant } from "./types.ts";

export type Size = 3 | 4 | 5;

export interface Rules {
  variant: Variant;
  size: Size;
  winLength: number;
  scoring: Scoring;
  lockFaces: boolean;
}

const LETTERS: Record<Variant, string> = { classic: "C", ultimate: "U", cube: "B" };
const VARIANT_OF: Record<string, Variant> = { C: "classic", U: "ultimate", B: "cube" };

/** The win lengths a board of this size allows: 3 up to the size. */
export function winLengthOptions(size: number): number[] {
  return Array.from({ length: Math.max(0, size - 2) }, (_, i) => 3 + i);
}

/** The win length a size starts on, in every variant: three on a 3×3 board, four on 4×4 and 5×5. */
export function defaultWinLength(size: number): number {
  return size === 3 ? 3 : 4;
}

/** The win length a 001 game implied, which never carried one: only Classic 4×4 and 5×5 reached four. This is a
 *  separate table on purpose: old saves, links and seeds must keep meaning what they meant. */
export function legacyWinLength(variant: Variant, size: number): number {
  return variant === "classic" && size >= 4 ? 4 : 3;
}

/** `current` when it is valid for this size, otherwise the default. */
export function clampWinLength(_variant: Variant, size: number, current: number): number {
  return Number.isInteger(current) && current >= 3 && current <= size ? current : defaultWinLength(size);
}

/** `<V><N><K>` plus, for Cube only, `F` (face-count scoring) then `L` (lock scored faces). */
export function rulesCode(variant: Variant, size: number, winLength: number, scoring: Scoring = "lines", lockFaces = false): string {
  return `${LETTERS[variant]}${size}${winLength}${scoring === "faces" ? "F" : ""}${lockFaces ? "L" : ""}`;
}

export function parseRulesCode(text: string): Rules | { error: string } {
  const m = /^([CUB])([345])([345])(F?)(L?)$/.exec(String(text ?? "").trim().toUpperCase());
  if (!m) return { error: `"${text}" is not a game code.` };
  const size = Number(m[2]) as Size;
  const winLength = Number(m[3]);
  if (winLength < 3 || winLength > size) return { error: "The win length cannot be longer than the board." };
  const variant = VARIANT_OF[m[1]!]!;
  if (variant !== "cube" && (m[4] || m[5])) return { error: "Only the Cube has scoring and lock options." };
  return { variant, size, winLength, scoring: m[4] ? "faces" : "lines", lockFaces: m[5] === "L" };
}
