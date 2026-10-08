// Draws the app icons (the 2×2×2 cube of X's and O's from scripts/lib/logo.mjs) as PNGs with no dependencies, and writes the
// same artwork as static/icons/logo.svg and into the page header (between the logo markers in src/lib/components/Logo.svelte).
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, VIEW, logoShapes, logoSvg } from "./lib/logo.mjs";

export const BRAND = [250, 248, 243]; // --bg
export const INK = COLORS.ink.rgb;
export const ACCENT = COLORS.x.rgb;
export const ORANGE = COLORS.o.rgb;

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A PNG from a size×size RGB buffer. */
function png(size, rgb) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * size * 3, size * 3).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distance from point (px, py) to the segment (ax, ay)-(bx, by). */
function distance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The logo as a size×size RGB buffer on the brand background. A distance to rounded segments gives every stroke round caps
 *  and joins; `pad` keeps the artwork inside a margin (0.2 for a maskable icon's safe zone). */
export function renderLogo(size, pad) {
  const out = new Uint8Array(size * size * 3);
  for (let i = 0; i < out.length; i += 3) { out[i] = BRAND[0]; out[i + 1] = BRAND[1]; out[i + 2] = BRAND[2]; }
  const k = ((1 - 2 * pad) * size) / VIEW;
  const origin = pad * size;
  for (const shape of logoShapes()) {
    const rgb = COLORS[shape.color].rgb;
    if (shape.opacity !== undefined) { fillTile(out, size, shape, rgb, k, origin); continue; }
    const half = (shape.width / 2) * k;
    const pts = shape.points.map(([x, y]) => [origin + x * k, origin + y * k]);
    const count = shape.closed ? pts.length : pts.length - 1;
    for (let s = 0; s < count; s++) {
      const [ax, ay] = pts[s];
      const [bx, by] = pts[(s + 1) % pts.length];
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - half - 1)), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx) + half + 1));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - half - 1)), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by) + half + 1));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const alpha = Math.max(0, Math.min(1, half - distance(x + 0.5, y + 0.5, ax, ay, bx, by) + 0.5));
          if (alpha === 0) continue;
          const i = (y * size + x) * 3;
          for (let c = 0; c < 3; c++) out[i + c] = alpha === 1 ? rgb[c] : Math.round(out[i + c] + (rgb[c] - out[i + c]) * alpha);
        }
      }
    }
  }
  return out;
}

/** A filled tile: the polygon plus a round-joined stroke of the same ink, blended at the shape's opacity as one piece. */
function fillTile(out, size, shape, rgb, k, origin) {
  const half = (shape.width / 2) * k;
  const pts = shape.points.map(([x, y]) => [origin + x * k, origin + y * k]);
  const inside = (px, py) => {
    let c = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) c = !c;
    }
    return c;
  };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - half - 1)), x1 = Math.min(size - 1, Math.ceil(Math.max(...xs) + half + 1));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - half - 1)), y1 = Math.min(size - 1, Math.ceil(Math.max(...ys) + half + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let fill = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) fill += 1 / 16;
      let edge = 0;
      for (let s = 0; s < pts.length; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[(s + 1) % pts.length];
        edge = Math.max(edge, Math.max(0, Math.min(1, half - distance(x + 0.5, y + 0.5, ax, ay, bx, by) + 0.5)));
      }
      const alpha = Math.max(fill, edge) * shape.opacity;
      if (alpha === 0) continue;
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] + (rgb[c] - out[i + c]) * alpha);
    }
  }
}

/** Put the inline logo into the page header, between its markers. */
export function inlineLogo(html) {
  return html.replace(/(<!-- logo:start -->)[\s\S]*?(<!-- logo:end -->)/, `$1\n      ${logoSvg({ inline: true })}\n      $2`);
}

function main() {
  mkdirSync("static/icons", { recursive: true });
  writeFileSync("static/icons/icon-192.png", png(192, renderLogo(192, 0.08)));
  writeFileSync("static/icons/icon-512.png", png(512, renderLogo(512, 0.08)));
  writeFileSync("static/icons/icon-maskable-512.png", png(512, renderLogo(512, 0.2)));
  writeFileSync("static/icons/apple-touch-icon.png", png(180, renderLogo(180, 0.08)));
  writeFileSync("static/icons/logo.svg", logoSvg() + "\n");
  writeFileSync("src/lib/components/Logo.svelte", inlineLogo(readFileSync("src/lib/components/Logo.svelte", "utf8")));
  console.log("icons written to static/icons");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
