import { test } from "node:test";
import assert from "node:assert/strict";
import { faceInView, faceViewAngles, frontFace } from "../../src/ui/cube-labels.ts";

const U = 0, D = 1, F = 2, B = 3, L = 4, R = 5;

test("at the opening angle the front, top and right faces are in view and the other three are not", () => {
  const rx = -25, ry = -30;
  const inView = [U, D, F, B, L, R].filter((face) => faceInView(rx, ry, face));
  assert.deepEqual(inView, [U, F, R]);
});

test("a face turned straight to the viewer is in view, and it is the only one", () => {
  for (let face = 0; face < 6; face++) {
    const { rx, ry } = faceViewAngles(face);
    assert.equal(faceInView(rx, ry, face), true, `face ${face}`);
    assert.equal(frontFace(rx, ry), face);
    for (let other = 0; other < 6; other++) if (other !== face) assert.equal(faceInView(rx, ry, other), false, `face ${other} while ${face} is in front`);
  }
});

test("a face seen from behind is not in view", () => {
  assert.equal(faceInView(0, 0, B), false);
  assert.equal(faceInView(0, 180, F), false);
});

test("a face whose depth is below the threshold is a sliver, not in view", () => {
  // front-on turned 70 degrees about the vertical axis: the front is at cos 70 = 0.34
  assert.equal(faceInView(0, -70, F), false);
  assert.equal(faceInView(0, -50, F), true); // cos 50 = 0.64
});
