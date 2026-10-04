import { test } from "node:test";
import assert from "node:assert/strict";
import { turnName, parseTurnName, layerLabel, layerName, turnsFor, faceLetter } from "../../src/core/notation.ts";
import { rotations } from "../../src/core/cube.ts";
import type { Axis, CubeRotate, RotateDir } from "../../src/core/types.ts";

const turn = (axis: Axis, layer: number, dir: RotateDir): CubeRotate => ({ t: "rotate", axis, layer, dir });
const SIZES = [3, 4, 5] as const;

test("R, U and F are clockwise seen from their face, which is a quarter back (dir -1); L, D and B are dir +1", () => {
  assert.equal(turnName(turn("x", 2, -1), 3, "cube"), "R");
  assert.equal(turnName(turn("y", 2, -1), 3, "cube"), "U");
  assert.equal(turnName(turn("z", 2, -1), 3, "cube"), "F");
  assert.equal(turnName(turn("x", 0, 1), 3, "cube"), "L");
  assert.equal(turnName(turn("y", 0, 1), 3, "cube"), "D");
  assert.equal(turnName(turn("z", 0, 1), 3, "cube"), "B");
});

test("the opposite way takes a prime and a half turn takes a 2", () => {
  assert.equal(turnName(turn("x", 2, 1), 3, "cube"), "R'");
  assert.equal(turnName(turn("y", 2, 1), 3, "cube"), "U'");
  assert.equal(turnName(turn("z", 2, 2), 3, "cube"), "F2");
  assert.equal(turnName(turn("x", 0, -1), 3, "cube"), "L'");
  assert.equal(turnName(turn("y", 0, 2), 3, "cube"), "D2");
});

test("middle slices on a 3×3 are M (follows L), E (follows D) and S (follows F)", () => {
  assert.equal(turnName(turn("x", 1, 1), 3, "cube"), "M");
  assert.equal(turnName(turn("x", 1, -1), 3, "cube"), "M'");
  assert.equal(turnName(turn("y", 1, 1), 3, "cube"), "E");
  assert.equal(turnName(turn("y", 1, -1), 3, "cube"), "E'");
  assert.equal(turnName(turn("z", 1, -1), 3, "cube"), "S");
  assert.equal(turnName(turn("z", 1, 1), 3, "cube"), "S'");
  assert.equal(turnName(turn("x", 1, 2), 3, "cube"), "M2");
});

test("inner layers on 4×4 and 5×5 are numbered from the nearer side: 2R, 2L, 3L", () => {
  assert.equal(turnName(turn("x", 2, -1), 4, "cube"), "2R");
  assert.equal(turnName(turn("x", 1, 1), 4, "cube"), "2L");
  assert.equal(turnName(turn("x", 1, -1), 4, "cube"), "2L'");
  assert.equal(turnName(turn("y", 2, -1), 4, "cube"), "2U");
  assert.equal(turnName(turn("z", 1, 1), 4, "cube"), "2B");
  assert.equal(turnName(turn("x", 3, -1), 5, "cube"), "2R");
  assert.equal(turnName(turn("x", 2, 2), 5, "cube"), "3L2");
  assert.equal(turnName(turn("y", 2, 1), 5, "cube"), "3D");
  assert.equal(turnName(turn("z", 2, -1), 5, "cube"), "3B'");
  assert.equal(turnName(turn("x", 1, 1), 5, "cube"), "2L");
});

test("outer layers keep their plain letters on every size", () => {
  for (const size of SIZES) {
    assert.equal(turnName(turn("x", size - 1, -1), size, "cube"), "R");
    assert.equal(turnName(turn("x", 0, 1), size, "cube"), "L");
  }
});

test("every turn on 3×3, 4×4 and 5×5 has its own notation name of at most four characters", () => {
  for (const size of SIZES) {
    const names = rotations(size).map((r) => turnName(r, size, "cube"));
    assert.equal(new Set(names).size, 9 * size, `size ${size}`);
    for (const name of names) assert.ok(name.length <= 4, name);
  }
});

test("parseTurnName is the inverse of the cube style for every turn on every size", () => {
  for (const size of SIZES) {
    for (const r of rotations(size)) {
      const name = turnName(r, size, "cube");
      assert.deepEqual(parseTurnName(name, size), r, `${size} ${name}`);
    }
  }
});

test("parseTurnName gives an error for anything that is not a turn on that size", () => {
  for (const [text, size] of [["", 3], ["X", 3], ["R3", 3], ["2R", 3], ["M", 4], ["E", 5], ["3R", 4], ["1R", 4], ["r", 3], ["RR", 3], ["R''", 3], ["2M", 3], ["4L", 5], ["9", 3], ["R2'", 3]] as const) {
    const result = parseTurnName(text, size);
    assert.ok("error" in result, `${text} on ${size}`);
  }
});

test("the words style matches the controls' accessible names", () => {
  assert.equal(turnName(turn("y", 2, 1), 3, "words"), "Turn the top layer to the right");
  assert.equal(turnName(turn("y", 2, -1), 3, "words"), "Turn the top layer to the left");
  assert.equal(turnName(turn("y", 0, 2), 3, "words"), "Half turn the bottom layer");
  assert.equal(turnName(turn("x", 0, -1), 3, "words"), "Turn the left layer up");
  assert.equal(turnName(turn("x", 2, 1), 3, "words"), "Turn the right layer down");
  assert.equal(turnName(turn("z", 2, -1), 3, "words"), "Turn the front layer clockwise");
  assert.equal(turnName(turn("z", 2, 1), 3, "words"), "Turn the front layer anticlockwise");
});

test("words name every layer of a larger cube, with all names different", () => {
  for (const size of SIZES) {
    for (const axis of ["x", "y", "z"] as const) {
      const names = Array.from({ length: size }, (_, layer) => layerName(axis, layer, size));
      assert.equal(new Set(names).size, size, `${axis} on ${size}`);
    }
    const labels = rotations(size).map((r) => turnName(r, size, "words"));
    assert.equal(new Set(labels).size, 9 * size);
  }
  assert.deepEqual([0, 1, 2].map((l) => layerName("x", l, 3)), ["left", "vertical middle", "right"]);
  assert.deepEqual([0, 1, 2].map((l) => layerName("y", l, 3)), ["bottom", "horizontal middle", "top"]);
  assert.deepEqual([0, 1, 2].map((l) => layerName("z", l, 3)), ["back", "front-to-back middle", "front"]);
  assert.equal(layerName("x", 1, 4), "second from the left");
  assert.equal(layerName("x", 2, 4), "second from the right");
  assert.equal(layerName("y", 2, 5), "horizontal middle");
  assert.equal(turnName(turn("x", 1, 1), 4, "words"), "Turn the second layer from the left down");
});

test("layerLabel is the row label: the layer's name in words, or its face letter in notation", () => {
  assert.equal(layerLabel("x", 2, 3, "cube"), "R");
  assert.equal(layerLabel("x", 1, 3, "cube"), "M");
  assert.equal(layerLabel("x", 1, 4, "cube"), "2L");
  assert.equal(layerLabel("y", 4, 5, "cube"), "U");
  assert.equal(layerLabel("y", 2, 5, "cube"), "3D");
  assert.equal(layerLabel("z", 2, 5, "cube"), "3B");
  assert.equal(layerLabel("y", 2, 3, "words"), "top");
  assert.equal(layerLabel("x", 0, 3, "words"), "left");
});

test("turnsFor lists all 9N turns once each", () => {
  for (const size of SIZES) {
    const all = turnsFor(size);
    assert.equal(all.length, 9 * size);
    assert.equal(new Set(all.map((r) => `${r.axis}${r.layer}${r.dir}`)).size, 9 * size);
    assert.deepEqual(new Set(all.map((r) => `${r.axis}${r.layer}${r.dir}`)), new Set(rotations(size).map((r) => `${r.axis}${r.layer}${r.dir}`)));
  }
});

test("turnsFor groups a layer's three turns together, up the cube across and then down", () => {
  const all = turnsFor(3);
  assert.deepEqual(all.slice(0, 3).map((r) => [r.axis, r.layer, r.dir]), [["y", 2, -1], ["y", 2, 1], ["y", 2, 2]]);
});

test("face letters name the six faces", () => {
  assert.equal(faceLetter("x", 2, 3), "R");
  assert.equal(faceLetter("x", 0, 3), "L");
  assert.equal(faceLetter("z", 1, 3), null);
});
