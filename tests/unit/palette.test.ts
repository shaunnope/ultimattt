import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PALETTES, DEFAULT_PALETTE, paletteById, markColors, contrast } from "../../src/core/palette.ts";

const theme = readFileSync(join(import.meta.dirname, "..", "..", "site", "css", "theme.css"), "utf8");

/** The value of a token inside the light or dark block of theme.css. */
function token(name: string, mode: "light" | "dark"): string {
  const block = mode === "dark"
    ? /:root\[data-mode="dark"\]\s*\{([\s\S]*?)\n\}/.exec(theme)?.[1]
    : /:root,\s*:root\[data-mode="light"\]\s*\{([\s\S]*?)\n\}/.exec(theme)?.[1];
  assert.ok(block, `${mode} block in theme.css`);
  const value = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block!)?.[1];
  // The dark block only overrides what differs; --bg and --surface are always overridden.
  assert.ok(value, `${name} in the ${mode} block`);
  return value!;
}

function lab(hex: string): [number, number, number] {
  const lin = (at: number) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(1), lin(3), lin(5)];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a: string, b: string): number => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/** X and O must differ by at least this much (CIE Lab distance), on top of differing in shape. */
const MIN_DISTANCE = 40;
const MIN_CONTRAST = 3;

test("there are exactly four palettes: default, cbsafe, forest and sunset", () => {
  assert.deepEqual(PALETTES.map((p) => p.id), ["default", "cbsafe", "forest", "sunset"]);
  assert.equal(DEFAULT_PALETTE, "default");
  assert.equal(new Set(PALETTES.map((p) => p.label)).size, 4);
  for (const p of PALETTES) assert.ok(p.label.length > 0);
});

test("a colour-blind safe palette is present", () => {
  const safe = paletteById("cbsafe");
  assert.equal(safe.id, "cbsafe");
  assert.match(safe.label, /colou?r-blind/i);
});

test("every X and O colour reaches 3:1 on --bg and --surface of its own appearance", () => {
  for (const mode of ["light", "dark"] as const) {
    const bg = token("--bg", mode);
    const surface = token("--surface", mode);
    for (const p of PALETTES) {
      for (const mark of ["X", "O"] as const) {
        const colour = p[mark][mode];
        assert.match(colour, /^#[0-9a-f]{6}$/i);
        assert.ok(contrast(colour, bg) >= MIN_CONTRAST, `${p.id} ${mark} ${mode} on --bg: ${contrast(colour, bg).toFixed(2)}`);
        assert.ok(contrast(colour, surface) >= MIN_CONTRAST, `${p.id} ${mark} ${mode} on --surface: ${contrast(colour, surface).toFixed(2)}`);
      }
    }
  }
});

test("X and O are far apart in colour in every palette and appearance", () => {
  for (const p of PALETTES) {
    for (const mode of ["light", "dark"] as const) {
      const distance = deltaE(p.X[mode], p.O[mode]);
      assert.ok(distance >= MIN_DISTANCE, `${p.id} ${mode}: ΔE ${distance.toFixed(1)} < ${MIN_DISTANCE}`);
    }
  }
});

test("paletteById falls back to the default for an unknown or odd id", () => {
  assert.equal(paletteById("forest").id, "forest");
  for (const bad of ["", "neon", "DEFAULT", "__proto__", "constructor"]) assert.equal(paletteById(bad).id, "default", bad);
});

test("markColors gives the X and O colour of the right appearance", () => {
  for (const p of PALETTES) {
    assert.deepEqual(markColors(p.id, "light"), { X: p.X.light, O: p.O.light });
    assert.deepEqual(markColors(p.id, "dark"), { X: p.X.dark, O: p.O.dark });
  }
  assert.deepEqual(markColors("nope", "dark"), markColors("default", "dark"));
});

test("the default X is the accent colour in both appearances", () => {
  assert.equal(paletteById("default").X.light.toLowerCase(), token("--accent", "light").toLowerCase());
  assert.equal(paletteById("default").X.dark.toLowerCase(), token("--accent", "dark").toLowerCase());
});

test("contrast is the WCAG ratio", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(contrast("#777777", "#777777") - 1) < 0.001);
  assert.equal(contrast("#123456", "#abcdef"), contrast("#abcdef", "#123456"));
});

test("the default palette's mark tokens in theme.css match the table", () => {
  assert.equal(token("--mark-x", "light").toLowerCase(), paletteById("default").X.light.toLowerCase());
  assert.equal(token("--mark-o", "light").toLowerCase(), paletteById("default").O.light.toLowerCase());
  assert.equal(token("--mark-x", "dark").toLowerCase(), paletteById("default").X.dark.toLowerCase());
  assert.equal(token("--mark-o", "dark").toLowerCase(), paletteById("default").O.dark.toLowerCase());
});
