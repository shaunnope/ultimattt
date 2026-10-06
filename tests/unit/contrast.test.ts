import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error plain .mjs scripts, no types
import { checkContrast, resolveTokens } from "../../scripts/check-contrast.mjs";

const THEME = `
:root, :root[data-mode="light"] {
  --bg: #ffffff; --ink: #000000; --muted: #cccccc; --surface: rgba(255,255,255,.5); --brand: #d4ddff;
}
:root[data-mode="dark"] {
  --bg: #000000; --ink: #ffffff; --muted: #333333; --surface: rgba(255,255,255,.1); --brand: #d4ddff;
}
:root {
  --page: color-mix(in srgb, var(--brand) 10%, var(--bg));
  --edge: color-mix(in srgb, var(--ink) 50%, transparent);
}
`;

test("resolveTokens reads the mode blocks and the derived block", () => {
  const light = resolveTokens(THEME, "light");
  const dark = resolveTokens(THEME, "dark");
  assert.equal(light["--ink"], "#000000");
  assert.equal(dark["--ink"], "#ffffff");
  assert.ok(light["--page"].startsWith("color-mix"));
  assert.ok(dark["--page"].startsWith("color-mix"));
});

test("a passing pair set returns no problems", () => {
  const pairs = [{ fg: "ink", bg: ["page"], min: 4.5, why: "body text on the page" }];
  assert.deepEqual(checkContrast(THEME, pairs), []);
});

test("a pair below its ratio fails and names the token, mode and ratio", () => {
  const pairs = [{ fg: "muted", bg: ["page"], min: 4.5, why: "secondary text on the page" }];
  const problems: string[] = checkContrast(THEME, pairs);
  assert.equal(problems.length, 2); // both modes
  assert.ok(problems.some((p) => /muted/.test(p) && /light/.test(p) && /\d\.\d\d/.test(p) && /secondary text on the page/.test(p)));
  assert.ok(problems.some((p) => /dark/.test(p)));
});

test("translucent backgrounds are composited down the stack, not compared as bare hex", () => {
  // white at 50% over a white page is white; ink on it passes. In dark, white at 10% over black is a dark grey.
  const pairs = [{ fg: "ink", bg: ["page", "surface"], min: 4.5, why: "text on a card" }];
  assert.deepEqual(checkContrast(THEME, pairs), []);
});

test("a translucent foreground is composited over the backdrop before it is measured", () => {
  const pairs = [{ fg: "edge", bg: ["page"], min: 3, why: "edge on the page" }];
  // edge is ink at 50%: grey on white or black, which is about 3.9:1 on white (passes 3)
  assert.deepEqual(checkContrast(THEME, pairs), []);
  const strict = [{ fg: "edge", bg: ["page"], min: 7, why: "edge on the page" }];
  assert.equal(checkContrast(THEME, strict).length, 2);
});

test("a pair that names a missing token fails with a clear message", () => {
  const pairs = [{ fg: "nope", bg: ["page"], min: 4.5, why: "x" }];
  const problems: string[] = checkContrast(THEME, pairs);
  assert.ok(problems.length >= 1);
  assert.ok(problems.every((p) => /--nope/.test(p)));
});

test("the declared pairs hold on the real theme.css in both modes", () => {
  const root = join(import.meta.dirname, "..", "..");
  const css = readFileSync(join(root, "site", "css", "theme.css"), "utf8");
  const pairs = JSON.parse(readFileSync(join(root, "scripts", "contrast-pairs.json"), "utf8"));
  assert.deepEqual(checkContrast(css, pairs), []);
});
