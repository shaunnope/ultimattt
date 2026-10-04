import { test } from "node:test";
import assert from "node:assert/strict";
import { markShape, markClassName, markName } from "../../src/ui/mark.ts";

test("X is two strokes and O is one circle, differing by shape", () => {
  const x = markShape("X");
  const o = markShape("O");
  assert.equal(x.strokes.length, 2);
  assert.ok(x.strokes.every((s) => s.tag === "path"));
  assert.equal(o.strokes.length, 1);
  assert.equal(o.strokes[0]!.tag, "circle");
  assert.notDeepEqual(x.strokes, o.strokes);
});

test("every stroke has pathLength 1, so one dash animation draws any mark", () => {
  for (const mark of ["X", "O"] as const) {
    for (const stroke of markShape(mark).strokes) assert.equal(stroke.attrs.pathLength, "1");
  }
});

test("marks are drawn in one square view box and stay inside it", () => {
  assert.equal(markShape("X").viewBox, "0 0 100 100");
  assert.equal(markShape("O").viewBox, "0 0 100 100");
  const [circle] = markShape("O").strokes;
  assert.ok(Number(circle!.attrs.cx) + Number(circle!.attrs.r) <= 100);
});

test("only a newly placed mark animates, and nothing animates under reduced motion", () => {
  assert.match(markClassName("X", true), /\bmark-new\b/);
  assert.doesNotMatch(markClassName("X", false), /mark-new/);
  assert.doesNotMatch(markClassName("O", true, true), /mark-new/);
  assert.match(markClassName("X", false), /\bmark mark-x\b/);
  assert.match(markClassName("O", false), /\bmark mark-o\b/);
});

test("accessible names are the plain letters", () => {
  assert.equal(markName("X"), "X");
  assert.equal(markName("O"), "O");
});
