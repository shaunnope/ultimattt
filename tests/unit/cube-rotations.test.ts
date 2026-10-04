import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FACES, rotateTable, rotations, rotateStickers, countLines, layerStickers } from "../../src/core/cube.ts";
import type { Axis, Cell, RotateDir } from "../../src/core/types.ts";
import { randomSource } from "../../src/core/seed.ts";

const AXES: Axis[] = ["x", "y", "z"];
const DIRS: RotateDir[] = [1, -1, 2];
const SIZES = [3, 4, 5] as const;
const layersOf = (size: number): number[] => Array.from({ length: size }, (_, i) => i);
const identity = (size: number): Cell[] => Array.from({ length: 6 * size * size }, (_, i) => i) as unknown as Cell[];

test("there are six faces and 9N distinct rotations for N = 3, 4, 5", () => {
  assert.deepEqual([...FACES], ["U", "D", "F", "B", "L", "R"]);
  for (const size of SIZES) {
    const all = rotations(size);
    assert.equal(all.length, 9 * size);
    assert.equal(new Set(all.map((r) => `${r.axis}${r.layer}${r.dir}`)).size, 9 * size);
  }
});

test("every rotate table is a permutation of the 6·N² stickers", () => {
  for (const size of SIZES) {
    const n = 6 * size * size;
    for (const axis of AXES) for (const layer of layersOf(size)) for (const dir of DIRS) {
      const table = rotateTable(size, axis, layer, dir);
      assert.equal(table.length, n);
      assert.deepEqual([...table].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), `${size} ${axis}${layer}${dir}`);
    }
  }
});

test("a turn moves the ring of 4(N-1) stickers, plus the N² of its face for an outer layer, minus fixed centres", () => {
  for (const size of SIZES) {
    for (const axis of AXES) for (const layer of layersOf(size)) for (const dir of DIRS) {
      const moved = rotateTable(size, axis, layer, dir).filter((src, dst) => src !== dst).length;
      const outer = layer === 0 || layer === size - 1;
      const ring = 4 * size;
      const face = size * size;
      const fixedCentre = outer && size % 2 === 1 ? 1 : 0;
      // every ring sticker moves (a half turn too: no sticker maps to itself), and an outer face moves except an odd centre
      assert.equal(moved, ring + (outer ? face - fixedCentre : 0), `${size} ${axis}${layer}${dir}`);
    }
  }
});

test("a quarter turn then its inverse is the identity, and so is a half turn twice", () => {
  for (const size of SIZES) {
    const start = identity(size);
    for (const axis of AXES) for (const layer of layersOf(size)) {
      const there = rotateStickers(start, size, axis, layer, 1);
      assert.deepEqual(rotateStickers(there, size, axis, layer, -1), start);
      assert.deepEqual(rotateStickers(rotateStickers(start, size, axis, layer, 2), size, axis, layer, 2), start);
    }
  }
});

test("four quarter turns are the identity, and a half turn is two quarter turns", () => {
  for (const size of SIZES) {
    const start = identity(size);
    for (const axis of AXES) for (const layer of layersOf(size)) {
      let s = start;
      for (let i = 0; i < 4; i++) s = rotateStickers(s, size, axis, layer, 1);
      assert.deepEqual(s, start);
      const twice = rotateStickers(rotateStickers(start, size, axis, layer, 1), size, axis, layer, 1);
      assert.deepEqual(rotateStickers(start, size, axis, layer, 2), twice);
    }
  }
});

test("turning all N layers of an axis turns the whole cube: the same whichever order, and equal to turning the layers of the other direction back", () => {
  for (const size of SIZES) {
    const start = identity(size);
    for (const axis of AXES) {
      let forward = start;
      for (const layer of layersOf(size)) forward = rotateStickers(forward, size, axis, layer, 1);
      let reverse = start;
      for (const layer of [...layersOf(size)].reverse()) reverse = rotateStickers(reverse, size, axis, layer, 1);
      assert.deepEqual(forward, reverse);
      // back again with quarter turns the other way
      let back = forward;
      for (const layer of layersOf(size)) back = rotateStickers(back, size, axis, layer, -1);
      assert.deepEqual(back, start);
      // a whole-cube turn moves every face centre of an odd cube off or onto a face, and keeps each face one colour
      const faceOf = (i: number) => Math.floor(i / (size * size));
      for (let face = 0; face < 6; face++) {
        const colours = new Set(forward.slice(face * size * size, (face + 1) * size * size).map((v) => faceOf(v as unknown as number)));
        assert.equal(colours.size, 1, `${size} ${axis} face ${face} stays whole`);
      }
    }
  }
});

test("rotations conserve the number of X and O marks", () => {
  const rand = randomSource(7);
  for (const size of SIZES) {
    const position = Array.from({ length: 6 * size * size }, () => (rand() % 3) as Cell);
    const count = (s: Cell[], v: number) => s.filter((c) => c === v).length;
    for (const r of rotations(size)) {
      const after = rotateStickers(position, size, r.axis, r.layer, r.dir);
      for (const v of [0, 1, 2]) assert.equal(count(after, v), count(position, v));
    }
  }
});

test("R U R' U' has order 6 on every size, using the outer layers", () => {
  // x layer N-1 is R, y layer N-1 is U; R is a quarter back (dir -1) and U too, by the right-hand rule
  for (const size of SIZES) {
    const start = identity(size);
    const sequence = (s: Cell[]): Cell[] => {
      let t = rotateStickers(s, size, "x", size - 1, -1);
      t = rotateStickers(t, size, "y", size - 1, -1);
      t = rotateStickers(t, size, "x", size - 1, 1);
      return rotateStickers(t, size, "y", size - 1, 1);
    };
    let s = start;
    let order = 0;
    do {
      s = sequence(s);
      order++;
    } while (JSON.stringify(s) !== JSON.stringify(start) && order < 100);
    assert.equal(order, 6, `size ${size}`);
  }
});

test("outer layers also turn their face; inner layers touch no face", () => {
  for (const size of SIZES) {
    const n2 = size * size;
    const start = identity(size) as unknown as number[];
    const faceOf = (i: number) => Math.floor(i / n2);
    // x axis: layer 0 is the left face (L = 4), layer N-1 the right face (R = 5)
    const left = rotateStickers(start as unknown as Cell[], size, "x", 0, 1) as unknown as number[];
    assert.ok(start.slice(4 * n2, 5 * n2).some((v, i) => left[4 * n2 + i] !== v), "left face stickers moved");
    assert.ok(left.slice(4 * n2, 5 * n2).every((v) => faceOf(v) === 4), "and stayed on the left face");
    const right = rotateStickers(start as unknown as Cell[], size, "x", size - 1, 1) as unknown as number[];
    assert.ok(right.slice(5 * n2, 6 * n2).every((v) => faceOf(v) === 5));
    for (const layer of layersOf(size).slice(1, -1)) {
      const inner = rotateStickers(start as unknown as Cell[], size, "x", layer, 1) as unknown as number[];
      assert.deepEqual(inner.slice(4 * n2, 6 * n2), start.slice(4 * n2, 6 * n2), `inner layer ${layer} leaves the side faces`);
    }
  }
});

test("a face centre sticker only moves when a layer through it turns about another axis", () => {
  for (const size of SIZES) {
    if (size % 2 === 0) continue;
    const n2 = size * size;
    const mid = (size - 1) / 2;
    const start = identity(size);
    for (const r of rotations(size)) {
      const after = rotateStickers(start, size, r.axis, r.layer, r.dir) as unknown as number[];
      for (let face = 0; face < 6; face++) {
        const centre = face * n2 + mid * size + mid;
        const moved = after[centre] !== centre;
        const faceAxis = ["y", "y", "z", "z", "x", "x"][face];
        assert.equal(moved, r.layer === mid && r.axis !== faceAxis, `${size} ${r.axis}${r.layer}${r.dir} face ${face}`);
      }
    }
  }
});

test("layerStickers lists the stickers a layer turns: ring plus face for outer layers, ring only for inner", () => {
  for (const size of SIZES) {
    const n2 = size * size;
    for (const axis of AXES) {
      for (const layer of layersOf(size)) {
        const outer = layer === 0 || layer === size - 1;
        assert.equal(layerStickers(size, axis, layer).length, 4 * size + (outer ? n2 : 0), `${size} ${axis}${layer}`);
        const inLayer = new Set(layerStickers(size, axis, layer));
        rotateTable(size, axis, layer, 1).forEach((src, dst) => {
          if (src !== dst) assert.ok(inLayer.has(src) && inLayer.has(dst), `${size} ${axis}${layer}`);
        });
      }
    }
  }
});

// ---- an independent facelet simulator, written here from the face orientations alone ----
// It shares nothing with core/cube.ts: stickers live at floating-point positions built from each face's
// normal, right and down vectors, turns use rotation matrices, and layers are picked by comparing a coordinate.

type V3 = [number, number, number];
const FACE_BASIS: { normal: V3; right: V3; down: V3 }[] = [
  { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] }, // U
  { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] }, // D
  { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] }, // F
  { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] }, // B
  { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] }, // L
  { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] }, // R
];

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

function position(size: number, face: number, row: number, col: number): V3 {
  const b = FACE_BASIS[face]!;
  let p = scale(b.normal, size / 2);
  p = add(p, b.right, col - (size - 1) / 2);
  return add(p, b.down, row - (size - 1) / 2);
}

/** Rotation by quarters*90 degrees about +axis, right-hand rule, from the exact sin and cos of a quarter turn. */
function rotate(v: V3, axis: Axis, quarters: number): V3 {
  const angle = (quarters * Math.PI) / 2;
  const c = Math.round(Math.cos(angle));
  const s = Math.round(Math.sin(angle));
  const [x, y, z] = v;
  if (axis === "x") return [x, c * y - s * z, s * y + c * z];
  if (axis === "y") return [c * x + s * z, y, -s * x + c * z];
  return [c * x - s * y, s * x + c * y, z];
}

function simulate(size: number, labels: number[], axis: Axis, layer: number, dir: RotateDir): number[] {
  const n2 = size * size;
  const where = (index: number) => {
    const face = Math.floor(index / n2);
    const row = Math.floor((index % n2) / size);
    const col = index % size;
    return { face, p: position(size, face, row, col), n: FACE_BASIS[face]!.normal };
  };
  const axisIndex = { x: 0, y: 1, z: 2 }[axis] as 0 | 1 | 2;
  const quarters = dir === 1 ? 1 : dir === -1 ? 3 : 2;
  const wantedPlane = layer - (size - 1) / 2;
  const out = labels.slice();
  labels.forEach((label, src) => {
    const { p, n } = where(src);
    const cubie = add(p, n, -0.5); // the middle of the small cube this sticker is on
    if (Math.abs(cubie[axisIndex] - wantedPlane) > 1e-9) return;
    const p2 = rotate(p, axis, quarters);
    const n2v = rotate(n, axis, quarters);
    const face = FACE_BASIS.findIndex((b) => dot(b.normal, n2v) > 0.5);
    const b = FACE_BASIS[face]!;
    const centre = scale(b.normal, size / 2);
    const rel = add(p2, centre, -1);
    const col = Math.round(dot(rel, b.right) + (size - 1) / 2);
    const row = Math.round(dot(rel, b.down) + (size - 1) / 2);
    out[face * n2 + row * size + col] = label;
  });
  return out;
}

test("the independent simulator agrees with every turn on N = 3, 4 and 5, including the inner layers", () => {
  const rand = randomSource(11);
  for (const size of SIZES) {
    const labels = Array.from({ length: 6 * size * size }, () => rand() % 1000);
    for (const r of rotations(size)) {
      const mine = rotateStickers(labels, size, r.axis, r.layer, r.dir);
      const theirs = simulate(size, labels, r.axis, r.layer, r.dir);
      assert.deepEqual(mine, theirs, `${size} ${r.axis}${r.layer}${r.dir}`);
    }
  }
});

test("random sequences of turns on N = 4 and 5 agree with the simulator at every step", () => {
  const rand = randomSource(23);
  for (const size of [4, 5] as const) {
    let mine: number[] = Array.from({ length: 6 * size * size }, (_, i) => i);
    let theirs = mine.slice();
    const all = rotations(size);
    for (let i = 0; i < 60; i++) {
      const r = all[rand() % all.length]!;
      mine = rotateStickers(mine, size, r.axis, r.layer, r.dir);
      theirs = simulate(size, theirs, r.axis, r.layer, r.dir);
      assert.deepEqual(mine, theirs, `${size} step ${i}`);
    }
  }
});

// ---- the original game's behaviour (tests/fixtures/cube-golden.json), 3×3 only ----

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
    for (const layer of c.classification.layers) s = rotateStickers(s, 3, c.classification.axis, layer, c.classification.dir);
    assert.deepEqual(s, toMine(c.after), JSON.stringify(c.op));
    checked++;
  }
  assert.ok(checked >= 400);
});

test("our line counting agrees with the original's win counts before and after every turn", () => {
  for (const c of golden.cases) {
    assert.deepEqual(countLines(toMine(c.before), 3, 3), { X: c.winsBefore.X, O: c.winsBefore.O }, `before ${JSON.stringify(c.op)}`);
    assert.deepEqual(countLines(toMine(c.after), 3, 3), { X: c.winsAfter.X, O: c.winsAfter.O }, `after ${JSON.stringify(c.op)}`);
  }
});
