import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs scripts, no types
import { parseColour, mix, composite, luminance, ratio, evalColour } from "../../scripts/lib/colour.mjs";

type Rgba = { r: number; g: number; b: number; a: number };
const near = (actual: number, expected: number, eps = 0.01) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not within ${eps} of ${expected}`);

test("parseColour reads #rgb, #rrggbb, #rrggbbaa, rgb(), rgba() and transparent", () => {
  assert.deepEqual(parseColour("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColour("#3149c4"), { r: 0x31, g: 0x49, b: 0xc4, a: 1 });
  near(parseColour("#00000080").a, 0.5, 0.005);
  assert.deepEqual(parseColour("rgb(10, 20, 30)"), { r: 10, g: 20, b: 30, a: 1 });
  assert.deepEqual(parseColour("rgba(255,255,255,.58)"), { r: 255, g: 255, b: 255, a: 0.58 });
  assert.deepEqual(parseColour("transparent"), { r: 0, g: 0, b: 0, a: 0 });
  assert.throws(() => parseColour("not-a-colour"));
});

test("composite lays a translucent colour over an opaque backdrop", () => {
  const out: Rgba = composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
  assert.equal(out.a, 1);
  near(out.r, 127.5, 0.6);
  assert.deepEqual(composite({ r: 9, g: 9, b: 9, a: 1 }, { r: 1, g: 2, b: 3, a: 1 }), { r: 9, g: 9, b: 9, a: 1 });
});

test("mix follows color-mix in srgb, including with transparent", () => {
  const half: Rgba = mix(parseColour("#000000"), 0.5, parseColour("#ffffff"));
  near(half.r, 127.5, 0.6);
  assert.equal(half.a, 1);
  // ink 70% with transparent keeps the ink colour and takes alpha 0.7
  const strong: Rgba = mix(parseColour("#1a1a1a"), 0.7, parseColour("transparent"));
  assert.equal(strong.r, 0x1a);
  near(strong.a, 0.7);
});

test("ratio matches WCAG 2 for known pairs", () => {
  near(ratio(parseColour("#000"), parseColour("#fff")), 21, 0.01);
  near(ratio(parseColour("#fff"), parseColour("#fff")), 1, 0.001);
  near(ratio(parseColour("#767676"), parseColour("#fff")), 4.54, 0.02);
  near(luminance(parseColour("#fff")), 1, 0.001);
  near(luminance(parseColour("#000")), 0, 0.001);
});

test("evalColour resolves var() and color-mix against a token table", () => {
  const tokens: Record<string, string> = {
    "--brand": "#d4ddff",
    "--bg": "#f6f4ee",
    "--ink": "#1a1a1a",
    "--page": "color-mix(in srgb, var(--brand) 10%, var(--bg))",
    "--muted-strong": "color-mix(in srgb, var(--ink) 70%, transparent)",
    "--alias": "var(--page)",
  };
  const lookup = (name: string) => tokens[name];
  const page: Rgba = evalColour("var(--page)", lookup);
  assert.equal(Math.round(page.r), 243);
  assert.equal(Math.round(page.g), 242);
  assert.equal(Math.round(page.b), 240);
  assert.deepEqual(evalColour("var(--alias)", lookup), page);
  near(evalColour("var(--muted-strong)", lookup).a, 0.7);
  assert.throws(() => evalColour("var(--missing)", lookup), /--missing/);
});

test("evalColour copes with nested color-mix and a percentage on the second colour", () => {
  const lookup = (name: string) => ({ "--a": "#000000", "--b": "#ffffff" } as Record<string, string>)[name];
  const nested: Rgba = evalColour("color-mix(in srgb, color-mix(in srgb, var(--a) 50%, var(--b)) 50%, var(--b))", lookup);
  near(nested.r, 191.25, 0.6);
  const second: Rgba = evalColour("color-mix(in srgb, var(--a), var(--b) 25%)", lookup);
  near(second.r, 63.75, 0.6);
});
