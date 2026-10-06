import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs script, no types
import { checkThemeHtml } from "../../scripts/check-theme.mjs";
import { resolveMode } from "../../src/ui/theme.ts";

const script = (body: string) => `<html><head><script>${body}</script></head></html>`;

// the script from the design spec, reading ttt.mode and falling back to the legacy ttt.theme (auto is system)
const GOOD = script(`(function(){var m=null;try{m=localStorage.getItem("ttt.mode");if(m===null){m=localStorage.getItem("ttt.theme");if(m==="auto")m="system";}}catch(e){}if(m!=="light"&&m!=="dark")m="system";var r=document.documentElement;r.setAttribute("data-mode-preference",m);if(m==="system")m=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";r.setAttribute("data-mode",m);})();`);

// light and dark swapped for system
const MISMATCH = script(`(function(){var m=null;try{m=localStorage.getItem("ttt.mode");if(m===null){m=localStorage.getItem("ttt.theme");if(m==="auto")m="system";}}catch(e){}if(m!=="light"&&m!=="dark")m="system";var r=document.documentElement;r.setAttribute("data-mode-preference",m);if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"light":"dark";r.setAttribute("data-mode",m);})();`);

// an unknown stored value is used as the mode instead of falling back to system
const NO_FALLBACK = script(`(function(){var m=localStorage.getItem("ttt.mode")||"system";var r=document.documentElement;r.setAttribute("data-mode-preference",m);if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";r.setAttribute("data-mode",m);})();`);

// ignores the legacy key, so a returning dark-mode player would see a light flash
const NO_LEGACY = script(`(function(){var m=null;try{m=localStorage.getItem("ttt.mode");}catch(e){}if(m!=="light"&&m!=="dark")m="system";var r=document.documentElement;r.setAttribute("data-mode-preference",m);if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";r.setAttribute("data-mode",m);})();`);

// never records the preference
const NO_PREFERENCE = script(`(function(){var m=null;try{m=localStorage.getItem("ttt.mode");if(m===null){m=localStorage.getItem("ttt.theme");if(m==="auto")m="system";}}catch(e){}if(m!=="light"&&m!=="dark")m="system";if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-mode",m);})();`);

test("a pre-paint script that agrees with resolveMode passes", () => {
  assert.deepEqual(checkThemeHtml(GOOD, resolveMode), []);
});

test("a script that disagrees about the system theme fails", () => {
  const problems = checkThemeHtml(MISMATCH, resolveMode);
  assert.ok(problems.length > 0);
  assert.match(problems[0], /system/);
});

test("a script that does not fall back to system for an unknown stored value fails", () => {
  assert.ok(checkThemeHtml(NO_FALLBACK, resolveMode).length > 0);
});

test("a script that ignores the legacy ttt.theme key fails", () => {
  const problems = checkThemeHtml(NO_LEGACY, resolveMode);
  assert.ok(problems.some((p: string) => /ttt\.theme/.test(p)));
});

test("a script that does not set data-mode-preference fails", () => {
  const problems = checkThemeHtml(NO_PREFERENCE, resolveMode);
  assert.ok(problems.some((p: string) => /data-mode-preference/.test(p)));
});

test("a page with no pre-paint script fails", () => {
  const problems = checkThemeHtml("<html><head></head></html>", resolveMode);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /pre-paint/i);
});
