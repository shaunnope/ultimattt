import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs script, no types
import { checkThemeHtml } from "../../scripts/check-theme.mjs";
import { resolveMode } from "../../src/ui/theme.ts";

const script = (body: string) => `<html><head><script>${body}</script></head></html>`;

const GOOD = script(`(function(){try{var pref=localStorage.getItem("ttt.theme")||"auto";if(pref!=="light"&&pref!=="dark")pref="auto";var dark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var mode=pref==="auto"?(dark?"dark":"light"):pref;document.documentElement.setAttribute("data-mode",mode);}catch(e){}})();`);

// light and dark swapped for auto
const MISMATCH = script(`(function(){try{var pref=localStorage.getItem("ttt.theme")||"auto";if(pref!=="light"&&pref!=="dark")pref="auto";var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var mode=pref==="auto"?(dark?"light":"dark"):pref;document.documentElement.setAttribute("data-mode",mode);}catch(e){}})();`);

// an unknown stored value is used as the mode instead of falling back to auto
const NO_FALLBACK = script(`(function(){var pref=localStorage.getItem("ttt.theme")||"auto";var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var mode=pref==="auto"?(dark?"dark":"light"):pref;document.documentElement.setAttribute("data-mode",mode);})();`);

test("a pre-paint script that agrees with resolveMode passes", () => {
  assert.deepEqual(checkThemeHtml(GOOD, resolveMode), []);
});

test("a script that disagrees about the system theme fails", () => {
  const problems = checkThemeHtml(MISMATCH, resolveMode);
  assert.ok(problems.length > 0);
  assert.match(problems[0], /auto/);
});

test("a script that does not fall back to auto for an unknown stored value fails", () => {
  assert.ok(checkThemeHtml(NO_FALLBACK, resolveMode).length > 0);
});

test("a page with no pre-paint script fails", () => {
  const problems = checkThemeHtml("<html><head></head></html>", resolveMode);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /pre-paint/i);
});
