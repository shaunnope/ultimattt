import { test } from "node:test";
import assert from "node:assert/strict";
import { statusText, type StatusContext } from "../../src/ui/status-text.ts";

const base: StatusContext = { variant: "classic", status: "playing", winner: null, toMove: "X", mode: "one-device", resigned: null, thinking: false, lockNote: "", where: "" };
const say = (over: Partial<StatusContext>): string => statusText({ ...base, ...over });

test("against the computer the player's own turn has no text: the pill shows it", () => {
  assert.equal(say({ mode: "computer", humanMark: "X" }), "");
  assert.equal(say({ mode: "computer", humanMark: "O", toMove: "O" }), "");
});

test("the computer's turn says it is thinking", () => {
  assert.equal(say({ mode: "computer", humanMark: "X", toMove: "O", thinking: true }), "Computer is thinking…");
});

test("on one device a plain turn has no text", () => {
  assert.equal(say({}), "");
  assert.equal(say({ toMove: "O" }), "");
});

test("on two devices your own turn has no text, and waiting for your friend is still said", () => {
  assert.equal(say({ mode: "two-device", myMark: "X" }), "");
  assert.equal(say({ mode: "two-device", myMark: "O" }), "Waiting for your friend (X).");
});

test("Ultimate keeps only where to play", () => {
  assert.equal(say({ variant: "ultimate", where: "Play in the centre board." }), "Play in the centre board.");
  assert.equal(say({ variant: "ultimate", mode: "computer", humanMark: "X", where: "Play in any open board." }), "Play in any open board.");
  assert.equal(say({ variant: "ultimate", mode: "two-device", myMark: "O", where: "Play in any open board." }), "Waiting for your friend (X). Play in any open board.");
  assert.equal(say({ variant: "ultimate" }), "");
});

test("Twist after a score asks for a layer turn, and the other device waits for it", () => {
  assert.equal(say({ variant: "cube", phase: "rotate" }), "X scored! Turn a layer of the cube.");
  assert.equal(say({ variant: "cube", phase: "rotate", mode: "two-device", myMark: "X" }), "X scored! Turn a layer of the cube.");
  assert.equal(say({ variant: "cube", phase: "rotate", mode: "two-device", myMark: "O" }), "Waiting for your friend to turn a layer.");
  assert.equal(say({ variant: "cube", phase: "place" }), "");
});

test("results: winner, draw, tie, resignation, and the note for a game that ended on locked faces", () => {
  assert.equal(say({ status: "won", winner: "O" }), "O wins!");
  assert.equal(say({ status: "draw" }), "It's a draw.");
  assert.equal(say({ variant: "cube", status: "tie", lockNote: "No open face left to play on." }), "It's a tie. No open face left to play on.");
  assert.equal(say({ variant: "cube", status: "won", winner: "X", lockNote: "No open face left to play on." }), "X wins! No open face left to play on.");
  assert.equal(say({ resigned: "X" }), "X resigned. O wins.");
});

test("a result is stated the same way whoever is playing", () => {
  for (const mode of ["one-device", "computer", "two-device"] as const) assert.equal(say({ mode, myMark: "X", humanMark: "X", status: "won", winner: "X" }), "X wins!");
});
