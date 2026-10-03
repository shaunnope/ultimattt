import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeQr, qrToSvg } from "../../src/ui/qr.ts";

// ---- an independent QR decoder (byte mode, error correction level M, versions 1-9) ----
// It reads the symbol the way a phone would: format bits, unmask, undo the interleave, check every
// Reed-Solomon block, then read the payload. The encoder is right only if all of that agrees.

const BLOCKS: Record<number, { ec: number; groups: [number, number][] }> = {
  1: { ec: 10, groups: [[1, 16]] }, 2: { ec: 16, groups: [[1, 28]] }, 3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] }, 5: { ec: 24, groups: [[2, 43]] }, 6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] }, 8: { ec: 22, groups: [[2, 38], [2, 39]] }, 9: { ec: 22, groups: [[3, 36], [2, 37]] },
};
const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46] };
const FORMAT_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0]; // level M, masks 0-7

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

function functionModules(version: number): boolean[][] {
  const size = 17 + 4 * version;
  const fn = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const mark = (r: number, c: number) => {
    if (r >= 0 && r < size && c >= 0 && c < size) fn[r]![c] = true;
  };
  for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(top + r, left + c);
  }
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  const centres = ALIGN[version]!;
  for (const r of centres) {
    for (const c of centres) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
    }
  }
  for (let i = 0; i < 9; i++) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    mark(8, size - 1 - i);
    mark(size - 1 - i, 8);
  }
  mark(size - 8, 8);
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      mark(size - 11 + j, i);
      mark(i, size - 11 + j);
    }
  }
  return fn;
}

function maskAt(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function decode(modules: number[][]): { text: string; mask: number; version: number } {
  const size = modules.length;
  const version = (size - 17) / 4;
  assert.ok(Number.isInteger(version) && version >= 1 && version <= 9, `size ${size}`);

  // format information, first copy: most significant bit first
  const read = (cells: [number, number][]) => cells.reduce((acc, [r, c]) => (acc << 1) | modules[r]![c]!, 0);
  const first = read([[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]);
  const second = read([
    ...Array.from({ length: 7 }, (_, i) => [size - 1 - i, 8] as [number, number]),
    ...Array.from({ length: 8 }, (_, i) => [8, size - 8 + i] as [number, number]),
  ]);
  const mask = FORMAT_M.indexOf(first);
  assert.ok(mask >= 0, `format bits ${first.toString(16)} are not level M`);
  assert.equal(second, first, "both copies of the format information agree");

  const fn = functionModules(version);
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (fn[r]![c]) continue;
        bits.push(modules[r]![c]! ^ (maskAt(mask, r, c) ? 1 : 0));
      }
    }
    upward = !upward;
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const { ec, groups } = BLOCKS[version]!;
  const sizes = groups.flatMap(([count, len]) => Array<number>(count).fill(len));
  const dataTotal = sizes.reduce((a, b) => a + b, 0);
  const blocks: { data: number[]; ec: number[] }[] = sizes.map(() => ({ data: [], ec: [] }));
  let at = 0;
  for (let i = 0; i < Math.max(...sizes); i++) sizes.forEach((len, b) => { if (i < len) blocks[b]!.data.push(codewords[at++]!); });
  for (let i = 0; i < ec; i++) blocks.forEach((b) => b.ec.push(codewords[at++]!));

  // every block must be a valid Reed-Solomon codeword: all syndromes zero
  for (const b of blocks) {
    const word = [...b.data, ...b.ec];
    for (let s = 0; s < ec; s++) {
      let acc = 0;
      for (const byte of word) acc = mul(acc, EXP[s]!) ^ byte;
      assert.equal(acc, 0, `Reed-Solomon syndrome ${s} is not zero`);
    }
  }

  const data = blocks.flatMap((b) => b.data);
  assert.equal(data.length, dataTotal);
  const stream = data.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1));
  const take = (n: number, from: number) => stream.slice(from, from + n).reduce((a, b) => (a << 1) | b, 0);
  assert.equal(take(4, 0), 0b0100, "byte mode");
  const length = take(8, 4);
  const bytes = Array.from({ length }, (_, i) => take(8, 12 + i * 8));
  return { text: new TextDecoder().decode(new Uint8Array(bytes)), mask, version };
}

const SAMPLES = [
  "A",
  "https://example.org/",
  "https://oxo.uwuapps.org/ultimattt/?join=BXK4M9",
  "https://someone.github.io/ultimattt/?join=BXK4M9&utm=" + "x".repeat(40),
  "é★ unicode joins too",
  "z".repeat(100),
  "q".repeat(150),
  "w".repeat(180),
];

test("every symbol decodes to the text it was made from, with valid error correction", () => {
  const versions = new Set<number>();
  for (const text of SAMPLES) {
    const code = encodeQr(text);
    assert.ok(code, text.slice(0, 20));
    const decoded = decode(code!.modules);
    assert.equal(decoded.text, text);
    versions.add(decoded.version);
  }
  assert.ok(versions.size >= 5, `exercised ${versions.size} versions`);
});

test("the smallest version that fits is used", () => {
  assert.equal(encodeQr("A")!.size, 21); // version 1
  assert.equal(encodeQr("x".repeat(14))!.size, 21); // 14 + 2 = 16 data codewords, still version 1
  assert.equal(encodeQr("x".repeat(15))!.size, 25); // version 2
});

test("the fixed patterns are in place", () => {
  const { modules, size } = encodeQr("https://example.org/join")!;
  for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
    for (let i = 0; i < 7; i++) {
      assert.equal(modules[top]![left + i], 1);
      assert.equal(modules[top + 6]![left + i], 1);
      assert.equal(modules[top + i]![left], 1);
      assert.equal(modules[top + i]![left + 6], 1);
    }
    assert.equal(modules[top + 3]![left + 3], 1);
    assert.equal(modules[top + 1]![left + 1], 0);
  }
  for (let i = 8; i < size - 8; i++) {
    assert.equal(modules[6]![i], i % 2 === 0 ? 1 : 0);
    assert.equal(modules[i]![6], i % 2 === 0 ? 1 : 0);
  }
  assert.equal(modules[size - 8]![8], 1, "the dark module");
});

test("text too long for version 9 gives nothing rather than a broken symbol", () => {
  assert.equal(encodeQr("y".repeat(181)), null);
  assert.equal(qrToSvg("y".repeat(181)), "");
});

test("the SVG is one path, labelled for screen readers", () => {
  const svg = qrToSvg("https://example.org/join");
  assert.match(svg, /^<svg /);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="[^"]+"/);
  assert.equal((svg.match(/<path /g) ?? []).length, 1);
});
