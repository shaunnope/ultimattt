import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs scripts, no types
import { renderLogo, BRAND, ACCENT, ORANGE } from "../../scripts/make-icons.mjs";

type Rgb = [number, number, number];
const pixel = (buf: Uint8Array, size: number, x: number, y: number): Rgb => {
  const i = (y * size + x) * 3;
  return [buf[i]!, buf[i + 1]!, buf[i + 2]!];
};
const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

test("each icon size comes out as a square RGB buffer", () => {
  for (const [size, pad] of [[192, 0.08], [512, 0.08], [180, 0.08], [512, 0.2]] as const) {
    const buf = renderLogo(size, pad) as Uint8Array;
    assert.equal(buf.length, size * size * 3, `${size} pad ${pad}`);
  }
});

test("the maskable icon keeps its outer 10% border plain background", () => {
  const size = 512;
  const buf = renderLogo(size, 0.2) as Uint8Array;
  const edge = Math.floor(size * 0.1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < edge || y < edge || x >= size - edge || y >= size - edge) assert.ok(same(pixel(buf, size, x, y), BRAND), `pixel ${x},${y} is not background`);
    }
  }
});

test("the artwork has both an X-coloured and an O-coloured pixel, and the ink", () => {
  const size = 192;
  const buf = renderLogo(size, 0.08) as Uint8Array;
  let x = 0, o = 0, other = 0;
  for (let y = 0; y < size; y++) {
    for (let px = 0; px < size; px++) {
      const p = pixel(buf, size, px, y);
      if (same(p, ACCENT)) x++;
      else if (same(p, ORANGE)) o++;
      else if (!same(p, BRAND)) other++;
    }
  }
  assert.ok(x > 20, "no X pixels");
  assert.ok(o > 20, "no O pixels");
  assert.ok(other > 100, "no ink or anti-aliased pixels");
});

test("the artwork is roughly centred", () => {
  const size = 256;
  const buf = renderLogo(size, 0.08) as Uint8Array;
  let minX = size, maxX = 0, minY = size, maxY = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!same(pixel(buf, size, x, y), BRAND)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  assert.ok(Math.abs(minX - (size - 1 - maxX)) <= 6, "left and right margins differ");
  assert.ok(Math.abs(minY - (size - 1 - maxY)) <= 6, "top and bottom margins differ");
});
