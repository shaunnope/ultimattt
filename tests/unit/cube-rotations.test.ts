import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FACES, rotateTable, rotations, rotateStickers, countLines, layerStickers } from "../../src/core/cube.ts";
import type { Axis, Cell, RotateDir } from "../../src/core/types.ts";
import { randomSource } from "../../src/core/seed.ts";

const AXES: Axis[] = ["x", "y", "z"];
const DIRS: RotateDir[] = [1, -1, 2];
const LAYERS = [0, 1, 2] as const;

test("there are six faces and 27 distinct rotations", () => {
  assert.deepEqual([...FACES], ["U", "D", "F", "B", "L", "R"]);
  const all = rotations();
  assert.equal(all.length, 27);
  assert.equal(new Set(all.map((r) => `${r.axis}${r.layer}${r.dir}`)).size, 27);
});

test("every rotate table is a permutation of the 54 stickers", () => {
  for (const axis of AXES) for (const layer of LAYERS) for (const dir of DIRS) {
    const table = rotateTable(axis, layer, dir);
    assert.equal(table.length, 54);
    assert.deepEqual([...table].sort((a, b) => a - b), Array.from({ length: 54 }, (_, i) => i), `${axis}${layer}${dir}`);
  }
});

test("a rotation moves 12 stickers (middle layer) or 20 (outer layer: the ring plus its face)", () => {
  for (const axis of AXES) for (const layer of LAYERS) for (const dir of DIRS) {
    const moved = rotateTable(axis, layer, dir).filter((src, dst) => src !== dst).length;
    assert.equal(moved, layer === 1 ? 12 : 20, `${axis}${layer}${dir}`);
  }
});

test("a quarter turn then its inverse is the identity, and so is a half turn twice", () => {
  const start = Array.from({ length: 54 }, (_, i) => i) as unknown as Cell[];
  for (const axis of AXES) for (const layer of LAYERS) {
    const there = rotateStickers(start, axis, layer, 1);
    assert.deepEqual(rotateStickers(there, axis, layer, -1), start);
    assert.deepEqual(rotateStickers(rotateStickers(start, axis, layer, 2), axis, layer, 2), start);
  }
});

test("four quarter turns are the identity, and a half turn is two quarter turns", () => {
  const start = Array.from({ length: 54 }, (_, i) => i) as unknown as Cell[];
  for (const axis of AXES) for (const layer of LAYERS) {
    let s = start;
    for (let i = 0; i < 4; i++) s = rotateStickers(s, axis, layer, 1);
    assert.deepEqual(s, start);
    const twice = rotateStickers(rotateStickers(start, axis, layer, 1), axis, layer, 1);
    assert.deepEqual(rotateStickers(start, axis, layer, 2), twice);
  }
});

test("rotations conserve the number of X and O marks", () => {
  const rand = randomSource(7);
  const position = Array.from({ length: 54 }, () => (rand() % 3) as Cell);
  const count = (s: Cell[], v: number) => s.filter((c) => c === v).length;
  for (const r of rotations()) {
    const after = rotateStickers(position, r.axis, r.layer, r.dir);
    for (const v of [0, 1, 2]) assert.equal(count(after, v), count(position, v));
  }
});

test("outer layers also turn their face; the middle layer touches no face", () => {
  const start = Array.from({ length: 54 }, (_, i) => i) as unknown as number[];
  const faceOf = (i: number) => Math.floor(i / 9);
  // x axis: layer 0 is the left face (L = 4), layer 2 the right face (R = 5)
  const left = rotateStickers(start as unknown as Cell[], "x", 0, 1) as unknown as number[];
  assert.ok(start.slice(36, 45).some((v, i) => left[36 + i] !== v), "left face stickers moved");
  assert.ok(left.slice(36, 45).every((v) => faceOf(v) === 4), "and stayed on the left face");
  assert.equal(left[40], 40, "its centre sticker is fixed");
  const mid = rotateStickers(start as unknown as Cell[], "x", 1, 1) as unknown as number[];
  assert.deepEqual(mid.slice(36, 45), start.slice(36, 45));
  assert.deepEqual(mid.slice(45, 54), start.slice(45, 54));
  const right = rotateStickers(start as unknown as Cell[], "x", 2, 1) as unknown as number[];
  assert.ok(right.slice(45, 54).every((v) => faceOf(v) === 5));
});

test("centre stickers never move in an outer-layer turn about their own axis, and a face never loses its centre", () => {
  const start = Array.from({ length: 54 }, (_, i) => i) as unknown as Cell[];
  for (const r of rotations()) {
    const after = rotateStickers(start, r.axis, r.layer, r.dir) as unknown as number[];
    for (let face = 0; face < 6; face++) {
      const centre = face * 9 + 4;
      // a centre sticker only moves when the middle layer perpendicular to its face turns
      const moved = after[centre] !== centre;
      const faceAxis = ["y", "y", "z", "z", "x", "x"][face];
      assert.equal(moved, r.layer === 1 && r.axis !== faceAxis, `${r.axis}${r.layer}${r.dir} face ${face}`);
    }
  }
});

test("layerStickers lists the stickers a layer turns: 21 for an outer layer (ring and face), 12 for a middle layer", () => {
  for (const axis of AXES) {
    assert.equal(layerStickers(axis, 0).length, 21);
    assert.equal(layerStickers(axis, 1).length, 12);
    assert.equal(layerStickers(axis, 2).length, 21);
    for (const layer of LAYERS) {
      const inLayer = new Set(layerStickers(axis, layer));
      rotateTable(axis, layer, 1).forEach((src, dst) => {
        if (src !== dst) assert.ok(inLayer.has(src) && inLayer.has(dst), `${axis}${layer}`);
      });
    }
  }
});

// ---- the original game's behaviour (tests/fixtures/cube-golden.json) ----

interface Golden {
  cases: {
    op: { kind: string; isCol?: boolean; index?: number; times: number };
    classification: { axis: Axis; layers: number[]; dir: RotateDir };
    before: number[];
    after: number[];
    winsBefore: { O: number; X: number };
    winsAfter: { O: number; X: number };
  }[];
}
const golden = JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", "cube-golden.json"), "utf8")) as Golden;
// The original used 1 = circle (O), 2 = cross (X); this project uses 1 = X, 2 = O.
const toMine = (stickers: number[]): Cell[] => stickers.map((v) => (v === 0 ? 0 : v === 1 ? 2 : 1)) as Cell[];

test("the golden file has the original's turns and whole-cube rotations", () => {
  assert.ok(golden.cases.length >= 400);
  const kinds = new Set(golden.cases.map((c) => c.op.kind));
  assert.deepEqual([...kinds].sort(), ["turn", "view-left", "view-up"]);
});

test("every layer turn of the original gives exactly the position our rotation tables give", () => {
  let checked = 0;
  for (const c of golden.cases) {
    let s = toMine(c.before);
    for (const layer of c.classification.layers) s = rotateStickers(s, c.classification.axis, layer as 0 | 1 | 2, c.classification.dir);
    assert.deepEqual(s, toMine(c.after), JSON.stringify(c.op));
    checked++;
  }
  assert.ok(checked >= 400);
});

test("our line counting agrees with the original's win counts before and after every turn", () => {
  for (const c of golden.cases) {
    assert.deepEqual(countLines(toMine(c.before)), { X: c.winsBefore.X, O: c.winsBefore.O }, `before ${JSON.stringify(c.op)}`);
    assert.deepEqual(countLines(toMine(c.after)), { X: c.winsAfter.X, O: c.winsAfter.O }, `after ${JSON.stringify(c.op)}`);
  }
});
