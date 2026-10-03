// Validation for the characters players choose to show instead of X and O.
// Icons are a display preference only: they never reach game state, seeds, share links or the network.

import type { Mark } from "./types.ts";

export const ICON_REASONS = ["blank", "too-long", "same"] as const;
export type IconReason = (typeof ICON_REASONS)[number];

export type IconCheck = { ok: true } | { ok: false; reason: IconReason; mark: Mark };

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function graphemes(text: string): number {
  if (segmenter) return [...segmenter.segment(text)].length;
  return [...text].length;
}

const isBlank = (text: string) => /^[\s\p{C}]*$/u.test(text);

export function validateIcons(icons: { X: string; O: string }): IconCheck {
  for (const mark of ["X", "O"] as const) {
    const text = icons[mark];
    if (isBlank(text)) return { ok: false, reason: "blank", mark };
    if (graphemes(text) > 1) return { ok: false, reason: "too-long", mark };
  }
  if (icons.X.normalize("NFC").toLowerCase() === icons.O.normalize("NFC").toLowerCase()) return { ok: false, reason: "same", mark: "O" };
  return { ok: true };
}
