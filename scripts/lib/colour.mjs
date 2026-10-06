// Just enough CSS colour maths for scripts/check-contrast.mjs: parse a colour, mix two (color-mix in srgb), lay one
// over another, and measure WCAG 2 contrast. A colour is { r, g, b, a } with r, g and b in 0..255 and a in 0..1.
// evalColour reads the forms theme.css uses: hex, rgb()/rgba(), transparent, var(--token) and color-mix(in srgb, ...).

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function parseColour(text) {
  const s = String(text).trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) throw new Error(`bad hex colour "${text}"`);
    const byte = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) / 255 : 1 };
  }
  m = /^rgba?\(\s*([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.length > 4 || parts.some(Number.isNaN)) throw new Error(`bad colour "${text}"`);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length === 4 ? parts[3] : 1 };
  }
  throw new Error(`cannot read colour "${text}"`);
}

/** color-mix(in srgb, a p, b): premultiplied interpolation, so mixing with transparent keeps the other colour's hue. */
export function mix(a, p, b) {
  const wa = p * a.a;
  const wb = (1 - p) * b.a;
  const alpha = wa + wb;
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (a.r * wa + b.r * wb) / alpha,
    g: (a.g * wa + b.g * wb) / alpha,
    b: (a.b * wa + b.b * wb) / alpha,
    a: alpha,
  };
}

/** `fg` laid over `bg` (source-over). With an opaque `bg` the result is opaque. */
export function composite(fg, bg) {
  const alpha = fg.a + bg.a * (1 - fg.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const ch = (f, b) => (f * fg.a + b * bg.a * (1 - fg.a)) / alpha;
  return { r: ch(fg.r, bg.r), g: ch(fg.g, bg.g), b: ch(fg.b, bg.b), a: alpha };
}

export function luminance(c) {
  const lin = (v) => {
    const s = clamp(v, 0, 255) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2 contrast ratio of two opaque colours, 1..21. */
export function ratio(fg, bg) {
  if (fg.a < 1 || bg.a < 1) throw new Error("ratio needs opaque colours; composite over the backdrop first");
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Split on commas that are not inside parentheses. */
function splitTop(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim());
}

/** The text inside the parentheses that open at `open` and the index just past them. */
function balanced(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error(`unbalanced parentheses in "${text}"`);
}

/**
 * A colour expression to { r, g, b, a }. `lookup("--name")` returns the token's value text, or undefined.
 * Throws a message naming the token when one is missing.
 */
export function evalColour(expr, lookup, depth = 0) {
  if (depth > 24) throw new Error(`token references nest too deeply near "${expr}"`);
  const s = String(expr).trim();
  if (s.startsWith("var(")) {
    const [name, fallback] = splitTop(balanced(s, 3));
    const value = lookup(name);
    if (value === undefined) {
      if (fallback !== undefined) return evalColour(fallback, lookup, depth + 1);
      throw new Error(`unknown token ${name}`);
    }
    return evalColour(value, lookup, depth + 1);
  }
  if (s.startsWith("color-mix(")) {
    const [space, first, second] = splitTop(balanced(s, 9));
    if (!/^in\s+srgb$/.test(space)) throw new Error(`only color-mix in srgb is supported, got "${space}"`);
    const part = (text) => {
      const m = /^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/s.exec(text.trim());
      return { colour: evalColour(m[1], lookup, depth + 1), pct: m[2] === undefined ? null : Number(m[2]) / 100 };
    };
    const a = part(first);
    const b = part(second);
    let p;
    if (a.pct !== null && b.pct !== null) p = a.pct / (a.pct + b.pct);
    else if (a.pct !== null) p = a.pct;
    else if (b.pct !== null) p = 1 - b.pct;
    else p = 0.5;
    return mix(a.colour, p, b.colour);
  }
  return parseColour(s);
}
