import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const site = join(import.meta.dirname, "..", "..", "site");
const svgPath = join(site, "icons", "logo.svg");
const read = () => readFileSync(svgPath, "utf8");
const shapes = (svg: string) => [...svg.matchAll(/<(?:path|circle|ellipse|line|polyline|polygon|rect)\b[^>]*>/g)].map((m) => m[0]);

test("the logo exists, is an SVG with a square view box, and has no text", () => {
  assert.ok(existsSync(svgPath), "site/icons/logo.svg is missing");
  const svg = read();
  assert.match(svg, /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.doesNotMatch(svg, /<text\b/);
  assert.match(svg, /<\/svg>\s*$/);
});

test("every stroked shape has round caps and joins; nothing is butt, miter or square", () => {
  const svg = read();
  const stroked = shapes(svg).filter((s) => /stroke-width=/.test(s));
  assert.ok(stroked.length >= 10, "expected the cube outline, grid lines and marks");
  for (const s of stroked) {
    assert.match(s, /stroke-linecap="round"/, s);
    assert.match(s, /stroke-linejoin="round"/, s);
  }
  assert.doesNotMatch(svg, /stroke-linecap="(?:butt|square)"/);
  assert.doesNotMatch(svg, /stroke-linejoin="(?:miter|miter-clip|bevel|arcs)"/);
});

test("the cube carries at least one X and one O, found by data-mark", () => {
  const svg = read();
  for (const mark of ["X", "O"]) {
    const group = svg.match(new RegExp(String.raw`<g\b[^>]*data-mark="${mark}"[^>]*>([\s\S]*?)</g>`));
    assert.ok(group, `no ${mark} group`);
    assert.ok(shapes(group![1]!).length >= 1, `${mark} group is empty`);
  }
});

test("the ink follows the text colour and the marks follow the palette tokens", () => {
  const svg = read();
  assert.match(svg, /currentColor/);
  assert.match(svg, /var\(--mark-x, #[0-9a-fA-F]{6}\)/);
  assert.match(svg, /var\(--mark-o, #[0-9a-fA-F]{6}\)/);
});

test("the header and the favicon use it, with the PNG kept as a fallback", () => {
  const html = readFileSync(join(site, "index.html"), "utf8");
  assert.match(html, /<svg\b[^>]*class="app-logo"[^>]*aria-hidden="true"/);
  assert.match(html, /<link rel="icon" href="icons\/logo\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<link rel="icon" href="icons\/icon-192\.png" type="image\/png">/);
});

test("the inline header logo draws the same artwork as logo.svg", () => {
  const inner = (s: string) => s.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "").replace(/<style>[\s\S]*?<\/style>/, "").replace(/\s+/g, " ").trim();
  const html = readFileSync(join(site, "index.html"), "utf8");
  const inline = html.match(/<svg\b[^>]*class="app-logo"[\s\S]*?<\/svg>/)![0];
  assert.equal(inner(inline), inner(read()));
});
