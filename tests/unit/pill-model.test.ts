import { test } from "node:test";
import assert from "node:assert/strict";
import { pillModel, type PillContext } from "../../src/ui/status-text.ts";

const base: PillContext = { variant: "classic", status: "playing", winner: null, toMove: "X", mode: "one-device", resigned: null };
const pill = (over: Partial<PillContext> = {}) => pillModel({ ...base, ...over });

test("X is first and O second, always", () => {
  for (const toMove of ["X", "O"] as const) assert.deepEqual(pill({ toMove }).segments.map((s) => s.mark), ["X", "O"]);
  assert.deepEqual(pill({ mode: "two-device", myMark: "O" }).segments.map((s) => s.mark), ["X", "O"]);
});

test("the mover is active while the game is playing", () => {
  assert.deepEqual(pill({ toMove: "X" }).segments.map((s) => s.active), [true, false]);
  assert.deepEqual(pill({ toMove: "O" }).segments.map((s) => s.active), [false, true]);
});

test("the same mover stays active through a Twist rotate phase", () => {
  const p = pill({ variant: "cube", toMove: "X", scores: { X: 1, O: 0 } });
  assert.deepEqual(p.segments.map((s) => s.active), [true, false]);
});

test("neither segment is active when the game is over", () => {
  for (const status of ["won", "draw", "tie"] as const) assert.deepEqual(pill({ status, winner: status === "won" ? "X" : null }).segments.map((s) => s.active), [false, false]);
  assert.deepEqual(pill({ resigned: "X" }).segments.map((s) => s.active), [false, false]);
});

test("the winner is flagged on a win; nobody on a tie or a draw", () => {
  assert.deepEqual(pill({ status: "won", winner: "O" }).segments.map((s) => s.winner), [false, true]);
  assert.deepEqual(pill({ status: "tie" }).segments.map((s) => s.winner), [false, false]);
  assert.deepEqual(pill({ status: "draw" }).segments.map((s) => s.winner), [false, false]);
});

test("a resignation makes the other player the winner", () => {
  assert.deepEqual(pill({ resigned: "X" }).segments.map((s) => s.winner), [false, true]);
  assert.deepEqual(pill({ resigned: "O" }).segments.map((s) => s.winner), [true, false]);
});

test("a score is present only for Twist", () => {
  assert.deepEqual(pill().segments.map((s) => s.score), [undefined, undefined]);
  assert.deepEqual(pill({ variant: "ultimate" }).segments.map((s) => s.score), [undefined, undefined]);
  assert.deepEqual(pill({ variant: "cube", scores: { X: 2, O: 1 } }).segments.map((s) => s.score), [2, 1]);
  // a score handed to a non-Twist game is ignored
  assert.deepEqual(pill({ variant: "classic", scores: { X: 2, O: 1 } }).segments.map((s) => s.score), [undefined, undefined]);
});

test("you marks the human in a computer game and myMark in a two-device game, and nobody on one device", () => {
  assert.deepEqual(pill().segments.map((s) => s.you), [false, false]);
  assert.deepEqual(pill({ mode: "computer", humanMark: "O" }).segments.map((s) => s.you), [false, true]);
  assert.deepEqual(pill({ mode: "two-device", myMark: "X" }).segments.map((s) => s.you), [true, false]);
});

test("spoken text names the mover, and the scores in Twist", () => {
  assert.equal(pill({ toMove: "O" }).spoken, "O to move");
  assert.equal(pill({ variant: "cube", toMove: "O", scores: { X: 2, O: 1 } }).spoken, "O to move, X 2, O 1");
  assert.equal(pill({ status: "won", winner: "X", variant: "cube", scores: { X: 3, O: 1 } }).spoken, "X wins, X 3, O 1");
  assert.equal(pill({ status: "won", winner: "O" }).spoken, "O wins");
  assert.equal(pill({ status: "tie", variant: "cube", scores: { X: 2, O: 2 } }).spoken, "It's a tie, X 2, O 2");
  assert.equal(pill({ status: "draw" }).spoken, "It's a draw");
  assert.equal(pill({ resigned: "X" }).spoken, "X resigned, O wins");
});
