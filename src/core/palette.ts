// The fixed X/O colour palettes (research R11). Four ready-made pairs, each with a light and a dark variant of
// both colours, picked by id. Players cannot enter a colour, so readability and distinctness are properties of
// this table, proven once in tests/unit/palette.test.ts. Pure: no DOM, storage or network.
//
// Values were chosen against flagrant's surfaces (site/css/theme.css); the default X is flagrant's accent, and
// the colour-blind safe pair follows the Okabe-Ito blue and orange.

export type Appearance = "light" | "dark";

export interface Variants {
  light: string;
  dark: string;
}

export interface Palette {
  id: string;
  label: string;
  X: Variants;
  O: Variants;
}

export const PALETTES: readonly Palette[] = [
  { id: "default", label: "Default", X: { light: "#3b5bdb", dark: "#7f9bff" }, O: { light: "#c2410c", dark: "#fb923c" } },
  { id: "cbsafe", label: "Colour-blind safe", X: { light: "#0072b2", dark: "#56b4e9" }, O: { light: "#b84a00", dark: "#e69f00" } },
  { id: "forest", label: "Forest and berry", X: { light: "#0f766e", dark: "#2dd4bf" }, O: { light: "#be185d", dark: "#f472b6" } },
  { id: "sunset", label: "Violet and amber", X: { light: "#6d28d9", dark: "#a78bfa" }, O: { light: "#a16207", dark: "#facc15" } },
];

export const DEFAULT_PALETTE = "default";

/** The palette with this id, or the default for an unknown one. */
export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE)!;
}

/** The two mark colours of a palette for one appearance. */
export function markColors(id: string, appearance: Appearance): { X: string; O: string } {
  const p = paletteById(id);
  return { X: p.X[appearance], O: p.O[appearance] };
}

function channel(hex: string, at: number): number {
  const v = parseInt(hex.slice(at, at + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG contrast ratio of two #rrggbb colours (used by tests and checks, never at runtime). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
