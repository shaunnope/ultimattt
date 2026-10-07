import { test } from "node:test";
import assert from "node:assert/strict";
import { isHelpOpen, leaveHelpAction } from "../../src/ui/help-nav.ts";

// Help opens over the current screen (a shallow route: the page state says so) or as the /help route itself (a direct
// load, an old bookmark). Leaving goes back in history when the player opened it from a screen, and home when help was
// the first thing loaded, so the Back button never leaves the app.

test("help is open for a shallow route and for the /help route, and for nothing else", () => {
  assert.equal(isHelpOpen({ help: true }, "/"), true);
  assert.equal(isHelpOpen({}, "/help"), true);
  assert.equal(isHelpOpen({}, "/"), false);
  assert.equal(isHelpOpen({ help: false }, "/play"), false);
  assert.equal(isHelpOpen({}, null), false);
});

test("leaving help opened over a screen goes back in history, so that screen is exactly as it was", () => {
  assert.equal(leaveHelpAction({ help: true }), "back");
});

test("leaving help that was the first page loaded goes home, replacing the entry", () => {
  assert.equal(leaveHelpAction({}), "home");
});
