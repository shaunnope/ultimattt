import { test } from "node:test";
import assert from "node:assert/strict";
import { refusalMessage } from "../../src/ui/messages.ts";
import { REASONS as CLASSIC_REASONS } from "../../src/core/classic.ts";
import { REASONS as ULTIMATE_REASONS } from "../../src/core/ultimate.ts";
import { REASONS as CUBE_REASONS } from "../../src/core/cube.ts";
import { NET_REASONS } from "../../src/core/protocol.ts";

// Every variant core exports the reason keys it can refuse a move with. Add each variant's list here
// as it is implemented, so a new reason can never reach the screen without words.
const ALL_REASONS: readonly string[] = [...new Set([...CLASSIC_REASONS, ...ULTIMATE_REASONS, ...CUBE_REASONS, ...NET_REASONS])];

test("every reason key has a non-empty user message", () => {
  for (const reason of ALL_REASONS) {
    const text = refusalMessage(reason);
    assert.ok(text.trim().length > 0, reason);
    assert.notEqual(text, refusalMessage("definitely-not-a-reason"), `${reason} falls back to the generic message`);
  }
});

test("an unknown key falls back to a generic message", () => {
  const text = refusalMessage("definitely-not-a-reason");
  assert.ok(text.length > 0);
  assert.match(text, /not allowed/i);
});

test("messages name the cause", () => {
  assert.match(refusalMessage("occupied"), /taken/i);
  assert.match(refusalMessage("game-over"), /over/i);
});
