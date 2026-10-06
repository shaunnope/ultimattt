// Light, dark and system appearance. The page applies the saved choice before it paints (the inline script in
// index.html); this keeps it up to date afterwards. scripts/check-theme.mjs checks that the two agree.
//
// The preference is "light", "dark" or "system" and is kept under ttt.mode. The saved game's settings keep the older
// spelling (Theme: "auto" | "light" | "dark") so every earlier save still opens; themeToMode and modeToTheme map
// between the two. CSS selects on data-mode only (always light or dark); data-mode-preference records the choice.

import type { Theme } from "../core/settings.ts";
import { DEFAULT_PALETTE, markColors } from "../core/palette.ts";
import { storageGet, storageRemove, storageSet } from "../adapters/storage.ts";

export type ModePref = "system" | "light" | "dark";

export const MODE_KEY = "ttt.mode";
/** The key earlier versions used for the same thing, with "auto" where this one says "system". */
export const LEGACY_THEME_KEY = "ttt.theme";
/** Fired on window after the mode in force changes (a choice, or the device switching while System is chosen). */
export const MODE_EVENT = "ttt:mode";

/** The mode to show for a preference. Anything that is not light or dark follows the device. */
export function resolveMode(pref: string | null, prefersDark: boolean): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return prefersDark ? "dark" : "light";
}

/** A stored or saved value as a preference: light and dark as themselves, everything else (auto, junk, nothing) system. */
export function normaliseMode(value: unknown): ModePref {
  return value === "light" || value === "dark" ? value : "system";
}

export const themeToMode = (theme: Theme): ModePref => normaliseMode(theme);
export const modeToTheme = (mode: ModePref): Theme => (mode === "system" ? "auto" : mode);

/**
 * The saved preference. A choice kept under the old key moves to the new one (auto becomes system) and the old key
 * is removed, so nobody loses their appearance on the update. Never throws.
 */
export function loadModePref(): ModePref {
  const current = storageGet(MODE_KEY);
  const legacy = storageGet(LEGACY_THEME_KEY);
  let pref: ModePref;
  if (current !== null) pref = normaliseMode(current);
  else if (legacy !== null) {
    pref = normaliseMode(legacy);
    storageSet(MODE_KEY, pref);
  } else pref = "system";
  if (legacy !== null) storageRemove(LEGACY_THEME_KEY);
  return pref;
}

let palette = DEFAULT_PALETTE;
let current: ModePref = "system";
let query: MediaQueryList | null = null;

/** Put the chosen palette's X and O colours for the current appearance into --mark-x and --mark-o. */
function paintMarks(mode: "light" | "dark"): void {
  const { X, O } = markColors(palette, mode);
  const style = document.documentElement.style;
  style.setProperty("--mark-x", X);
  style.setProperty("--mark-o", O);
}

/** Use this mark palette (an id from core/palette.ts) now and whenever the appearance changes. */
export function applyMarkPalette(id: string): void {
  palette = id;
  paintMarks(currentMode());
}

export function currentMode(): "light" | "dark" {
  return document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light";
}

/** A computed colour (rgb(), rgba(), color(srgb ...) or hex) as #rrggbb; null when it is none of those. */
export function cssColourToHex(text: string): string | null {
  const byte = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  const hex = /^#([0-9a-f]{6})$/i.exec(text.trim());
  if (hex) return `#${hex[1]!.toLowerCase()}`;
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(text.trim());
  if (rgb) return `#${byte(Number(rgb[1]))}${byte(Number(rgb[2]))}${byte(Number(rgb[3]))}`;
  const srgb = /^color\(\s*srgb\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)/.exec(text.trim());
  if (srgb) return `#${byte(Number(srgb[1]) * 255)}${byte(Number(srgb[2]) * 255)}${byte(Number(srgb[3]) * 255)}`;
  return null;
}

/** The page colour of the current mode as #rrggbb, read from the --page token so it can never drift from the CSS. */
function pageColour(): string | null {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;background-color:var(--page)";
  document.documentElement.append(probe);
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return cssColourToHex(colour);
}

function paint(): void {
  const mode = resolveMode(current, query?.matches ?? false);
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  root.setAttribute("data-mode-preference", current);
  paintMarks(mode);
  const colour = pageColour();
  if (colour) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colour);
  window.dispatchEvent(new Event(MODE_EVENT));
}

/**
 * Apply a preference now and remember it. The device's light or dark setting is watched from the first call on, so
 * choosing System takes effect at once; a change by the device only repaints colours and never moves focus.
 */
export function applyMode(pref: ModePref): void {
  current = pref;
  storageSet(MODE_KEY, pref);
  storageRemove(LEGACY_THEME_KEY);
  if (!query && typeof matchMedia === "function") {
    query = matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", () => {
      if (current === "system") paint();
    });
  }
  paint();
}

/** The preference now in force (what the theme dialog shows as pressed). */
export function currentPreference(): ModePref {
  return current;
}
