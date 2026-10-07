import { test } from "node:test";
import assert from "node:assert/strict";
import { replayFrames } from "../../src/core/replay.ts";
import { frameView } from "../../src/ui/replay-model.ts";
import type { GameConfig, Move } from "../../src/core/types.ts";

// What the replay says at each position: the pill, the result line (only at the end), and the readout. Pure, so it is tested here.

const classic: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
const place = (cell: number): Move => ({ t: "place", cell });
const WIN = [0, 3, 1, 4, 2].map(place); // X wins the top row
const DRAW = [0, 1, 2, 4, 3, 5, 7, 6, 8].map(place);

test("a plain turn is shown by the pill alone: the status line is empty before the end", () => {
  const frames = replayFrames(classic, WIN);
  const view = frameView(classic, frames, 2);
  assert.equal(view.result, "");
  assert.equal(view.readout, "Move 2 of 5");
  assert.equal(view.pill.segments[0].active, true);
  assert.match(view.spoken, /^Move 2 of 5\. X to move$/);
});

test("the last position names the winner", () => {
  const frames = replayFrames(classic, WIN);
  const view = frameView(classic, frames, 5);
  assert.equal(view.result, "X wins.");
  assert.equal(view.pill.segments[0].winner, true);
  assert.match(view.spoken, /^Move 5 of 5\. X wins\.$/);
});

test("a draw is a draw", () => {
  const frames = replayFrames(classic, DRAW);
  assert.equal(frameView(classic, frames, 9).result, "It's a draw.");
});

test("a resignation is named at the end only, and the pill then shows the other player as the winner", () => {
  const moves = [0, 3].map(place);
  const frames = replayFrames(classic, moves);
  assert.equal(frameView(classic, frames, 1, "O").result, "");
  const end = frameView(classic, frames, 2, "O");
  assert.equal(end.result, "O resigned. X wins.");
  assert.equal(end.pill.segments[0].winner, true);
});

test("the starting position says Move 0", () => {
  const frames = replayFrames(classic, WIN);
  const view = frameView(classic, frames, 0);
  assert.equal(view.readout, "Move 0 of 5");
  assert.equal(view.result, "");
});

test("an index outside the game is held to its ends", () => {
  const frames = replayFrames(classic, WIN);
  assert.equal(frameView(classic, frames, 99).readout, "Move 5 of 5");
  assert.equal(frameView(classic, frames, -3).readout, "Move 0 of 5");
});
