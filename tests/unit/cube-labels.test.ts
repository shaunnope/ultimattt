import { test } from "node:test";
import assert from "node:assert/strict";
import { rotationLabel, layerName, FACE_NAMES, faceViewAngles, frontFace, scoreLabel, lockEndText, optionsNote } from "../../src/ui/cube-labels.ts";
import { rotations, newGame, apply } from "../../src/core/cube.ts";
import { turnName } from "../../src/core/notation.ts";
import { statusText } from "../../src/ui/status-text.ts";
import type { Cell, CubeMove, GameConfig } from "../../src/core/types.ts";

test("every one of the 9N rotations has its own, readable label", () => {
  for (const size of [3, 4, 5]) {
    const labels = rotations(size).map((r) => rotationLabel(r, size));
    assert.equal(new Set(labels).size, 9 * size, `size ${size}`);
    for (const label of labels) assert.match(label, /^(Turn|Half turn) the .+ layer/);
  }
});

test("accessible names match the wording style of the notation module one to one, and each notation name maps to the same turn", () => {
  for (const size of [3, 4, 5]) {
    const all = rotations(size);
    const words = all.map((r) => rotationLabel(r, size));
    assert.deepEqual(words, all.map((r) => turnName(r, size, "words")));
    const notation = all.map((r) => turnName(r, size, "cube"));
    assert.equal(new Set(notation).size, new Set(words).size, "one name in each style for every turn");
  }
});

test("labels name the layer and the way it turns", () => {
  assert.equal(rotationLabel({ t: "rotate", axis: "y", layer: 2, dir: 1 }), "Turn the top layer to the right");
  assert.equal(rotationLabel({ t: "rotate", axis: "y", layer: 2, dir: -1 }), "Turn the top layer to the left");
  assert.equal(rotationLabel({ t: "rotate", axis: "y", layer: 0, dir: 2 }), "Half turn the bottom layer");
  assert.equal(rotationLabel({ t: "rotate", axis: "x", layer: 0, dir: -1 }), "Turn the left layer up");
  assert.equal(rotationLabel({ t: "rotate", axis: "x", layer: 2, dir: 1 }), "Turn the right layer down");
  assert.equal(rotationLabel({ t: "rotate", axis: "z", layer: 2, dir: -1 }), "Turn the front layer clockwise");
  assert.equal(rotationLabel({ t: "rotate", axis: "z", layer: 2, dir: 1 }), "Turn the front layer anticlockwise");
  assert.equal(rotationLabel({ t: "rotate", axis: "x", layer: 1, dir: -1 }, 4), "Turn the second layer from the left up");
});

test("layer names cover all nine layers", () => {
  assert.deepEqual([0, 1, 2].map((l) => layerName("x", l)), ["left", "vertical middle", "right"]);
  assert.deepEqual([0, 1, 2].map((l) => layerName("y", l)), ["bottom", "horizontal middle", "top"]);
  assert.deepEqual([0, 1, 2].map((l) => layerName("z", l)), ["back", "front-to-back middle", "front"]);
});

test("each face has a name and a view that brings it to the front", () => {
  assert.deepEqual(FACE_NAMES, ["top", "bottom", "front", "back", "left", "right"]);
  assert.deepEqual(faceViewAngles(2), { rx: 0, ry: 0 });
  assert.deepEqual(faceViewAngles(5), { rx: 0, ry: -90 });
  assert.deepEqual(faceViewAngles(4), { rx: 0, ry: 90 });
  assert.deepEqual(faceViewAngles(3), { rx: 0, ry: 180 });
  assert.deepEqual(faceViewAngles(0), { rx: -90, ry: 0 });
  assert.deepEqual(faceViewAngles(1), { rx: 90, ry: 0 });
});

const config: GameConfig = { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
const place = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const play = (moves: CubeMove[]) => moves.reduce((s, m) => apply(s, m), newGame(config));

const say = (state: ReturnType<typeof newGame>): string =>
  statusText({ variant: "cube", status: "playing", winner: null, toMove: state.toMove, phase: state.phase, mode: "one-device", resigned: null, thinking: false, lockNote: "", where: "" });

test("a plain Twist turn has no status text (the pill shows it), and a score asks for a layer turn", () => {
  assert.equal(say(newGame(config)), "");
  assert.equal(say(play([place(2, 4)])), "");
  const scored = play([place(2, 0), place(0, 0), place(2, 1), place(0, 1), place(2, 2)]);
  assert.equal(say(scored), "X scored! Turn a layer of the cube.");
});

test("frontFace names the face turned towards the viewer for a view", () => {
  for (let face = 0; face < 6; face++) {
    const { rx, ry } = faceViewAngles(face);
    assert.equal(frontFace(rx, ry), face, FACE_NAMES[face]);
  }
  // the default tilted view shows the front, the top and the right face; front is nearest
  assert.equal(frontFace(-25, -30), 2);
  // turning most of the way round shows the back
  assert.equal(frontFace(0, 170), 3);
});

test("the score label says Lines or Faces for the scoring mode", () => {
  assert.equal(scoreLabel("lines"), "Lines");
  assert.equal(scoreLabel("faces"), "Faces");
});

test("a game the lock ended says no open face is left; an ordinary end or a game in progress says nothing", () => {
  assert.equal(lockEndText(newGame({ ...config, lockFaces: true })), "");
  const stickers: Cell[] = Array.from({ length: 6 }, (_, f) => (f === 2 ? ([1, 1, 1, 2, 0, 2, 2, 1, 2] as Cell[]) : ([1, 2, 1, 1, 2, 2, 2, 1, 1] as Cell[]))).flat();
  const ended = { ...newGame({ ...config, lockFaces: true }), stickers, status: "won" as const, winner: "X" as const, empty: 1 };
  assert.equal(lockEndText(ended), "No open face left to play on.");
  assert.equal(lockEndText({ ...ended, empty: 0 }), "");
  assert.equal(lockEndText({ ...ended, status: "playing", winner: null }), "");
});

test("the status line of a game the lock ended is not blank", () => {
  const ended = { ...newGame({ ...config, lockFaces: true }), status: "won" as const, winner: "X" as const, empty: 1 };
  assert.match(lockEndText(ended), /No open face left/);
});

test("the options note always names the scoring kind for Twist, and adds locked faces when on", () => {
  assert.equal(optionsNote({ variant: "cube", scoring: "lines", lockFaces: false }), ", lines scoring");
  assert.equal(optionsNote({ variant: "cube", scoring: "faces", lockFaces: false }), ", faces scoring");
  assert.equal(optionsNote({ variant: "cube", scoring: "faces", lockFaces: true }), ", faces scoring, locked faces");
  assert.equal(optionsNote({ variant: "cube", scoring: "lines", lockFaces: true }), ", lines scoring, locked faces");
});

test("the options note says nothing for Classic and Ultimate, whatever the scoring field holds", () => {
  for (const variant of ["classic", "ultimate"] as const) {
    assert.equal(optionsNote({ variant, scoring: "lines", lockFaces: false }), "");
    assert.equal(optionsNote({ variant, scoring: "faces", lockFaces: false }), "");
  }
});

test("FACE_LETTERS name the six faces U, D, F, B, L, R in the same order as FACE_NAMES", async () => {
  const { FACE_LETTERS } = await import("../../src/ui/cube-labels.ts");
  assert.deepEqual([...FACE_LETTERS], ["U", "D", "F", "B", "L", "R"]);
  assert.equal(FACE_LETTERS.length, FACE_NAMES.length);
  FACE_NAMES.forEach((name, i) => assert.equal(FACE_LETTERS[i], name === "top" ? "U" : name === "bottom" ? "D" : name[0]!.toUpperCase()));
});
