// Light, dark and automatic appearance. The page applies the saved choice before it paints (the
// inline script in index.html); this keeps it up to date afterwards. scripts/check-theme.mjs
// checks that the two agree.

import type { Theme } from "../core/settings.ts";
import { DEFAULT_PALETTE, markColors } from "../core/palette.ts";
import { storageSet } from "../adapters/storage.ts";

export const THEME_KEY = "ttt.theme";

/** The mode to show for a preference. Anything that is not light or dark behaves like auto. */
export function resolveMode(pref: Theme, prefersDark: boolean): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return prefersDark ? "dark" : "light";
}

let watcher: { query: MediaQueryList; listener: () => void } | null = null;
let palette = DEFAULT_PALETTE;

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
  paintMarks(document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light");
}

/** Apply a preference now, and keep following the system while it is "auto". */
export function applyTheme(pref: Theme): void {
  storageSet(THEME_KEY, pref);
  const query = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const apply = () => {
    const mode = resolveMode(pref, query?.matches ?? false);
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.setAttribute("data-theme-pref", pref);
    paintMarks(mode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#14161c" : "#faf8f3");
  };
  if (watcher) watcher.query.removeEventListener("change", watcher.listener);
  watcher = null;
  apply();
  if (query && pref !== "light" && pref !== "dark") {
    query.addEventListener("change", apply);
    watcher = { query, listener: apply };
  }
}
