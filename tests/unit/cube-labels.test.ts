import { test } from "node:test";
import assert from "node:assert/strict";
import { rotationLabel, layerName, FACE_NAMES, faceViewAngles, frontFace, cubeStatus } from "../../src/ui/cube-labels.ts";
import { rotations, newGame, apply } from "../../src/core/cube.ts";
import type { CubeMove, GameConfig } from "../../src/core/types.ts";

test("every one of the 27 rotations has its own, readable label", () => {
  const labels = rotations().map(rotationLabel);
  assert.equal(new Set(labels).size, 27);
  for (const label of labels) assert.match(label, /^(Turn|Half turn) the .+ layer/);
});

test("labels name the layer and the way it turns", () => {
  assert.equal(rotationLabel({ t: "rotate", axis: "y", layer: 2, dir: 1 }), "Turn the top layer to the right");
  assert.equal(rotationLabel({ t: "rotate", axis: "y", layer: 2, dir: -1 }), "Turn the top layer to the left");
  assert.equal(rotationLabel({ t: "rotate", axis: "y", layer: 0, dir: 2 }), "Half turn the bottom layer");
  assert.equal(rotationLabel({ t: "rotate", axis: "x", layer: 0, dir: -1 }), "Turn the left layer up");
  assert.equal(rotationLabel({ t: "rotate", axis: "x", layer: 2, dir: 1 }), "Turn the right layer down");
  assert.equal(rotationLabel({ t: "rotate", axis: "z", layer: 2, dir: -1 }), "Turn the front layer clockwise");
  assert.equal(rotationLabel({ t: "rotate", axis: "z", layer: 2, dir: 1 }), "Turn the front layer anticlockwise");
});

test("layer names cover all nine layers", () => {
  assert.deepEqual([0, 1, 2].map((l) => layerName("x", l as 0 | 1 | 2)), ["left", "vertical middle", "right"]);
  assert.deepEqual([0, 1, 2].map((l) => layerName("y", l as 0 | 1 | 2)), ["bottom", "horizontal middle", "top"]);
  assert.deepEqual([0, 1, 2].map((l) => layerName("z", l as 0 | 1 | 2)), ["back", "front-to-back middle", "front"]);
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

const config: GameConfig = { variant: "cube", size: 3, mode: "local", seed: "CUB-BXK4-M9TR" };
const place = (face: number, cell: number): CubeMove => ({ t: "place", face, cell });
const play = (moves: CubeMove[]) => moves.reduce((s, m) => apply(s, m), newGame(config));

test("the status line says whose move it is, and asks for a layer turn after a score", () => {
  assert.equal(cubeStatus(newGame(config)), "X to move.");
  assert.equal(cubeStatus(play([place(2, 4)])), "O to move.");
  const scored = play([place(2, 0), place(0, 0), place(2, 1), place(0, 1), place(2, 2)]);
  assert.equal(cubeStatus(scored), "X scored! Turn a layer of the cube.");
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
