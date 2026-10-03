// Light, dark and automatic appearance. The page applies the saved choice before it paints (the
// inline script in index.html); this keeps it up to date afterwards. scripts/check-theme.mjs
// checks that the two agree.

import type { Theme } from "../core/settings.ts";
import { storageSet } from "../adapters/storage.ts";

export const THEME_KEY = "ttt.theme";

/** The mode to show for a preference. Anything that is not light or dark behaves like auto. */
export function resolveMode(pref: Theme, prefersDark: boolean): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return prefersDark ? "dark" : "light";
}

let watcher: { query: MediaQueryList; listener: () => void } | null = null;

/** Apply a preference now, and keep following the system while it is "auto". */
export function applyTheme(pref: Theme): void {
  storageSet(THEME_KEY, pref);
  const query = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const apply = () => {
    const mode = resolveMode(pref, query?.matches ?? false);
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.setAttribute("data-theme-pref", pref);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0c100e" : "#ccffcc");
  };
  if (watcher) watcher.query.removeEventListener("change", watcher.listener);
  watcher = null;
  apply();
  if (query && pref !== "light" && pref !== "dark") {
    query.addEventListener("change", apply);
    watcher = { query, listener: apply };
  }
}
