// Draws the app icons (a tic tac toe grid with an X and an O) as PNGs with no dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BRAND = [204, 255, 204];
const INK = [18, 24, 21];
const ACCENT = [31, 107, 61];

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
function png(size, draw) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x / size, y / size);
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// `pad` shrinks the artwork so a maskable icon keeps its content inside the safe zone.
function artwork(pad) {
  return (u, v) => {
    const x = (u - pad) / (1 - 2 * pad), y = (v - pad) / (1 - 2 * pad);
    if (x < 0 || x > 1 || y < 0 || y > 1) return BRAND;
    const t = 0.035;
    if (Math.abs(x - 1 / 3) < t || Math.abs(x - 2 / 3) < t || Math.abs(y - 1 / 3) < t || Math.abs(y - 2 / 3) < t) return INK;
    const cx = Math.floor(x * 3), cy = Math.floor(y * 3);
    const lx = x * 3 - cx - 0.5, ly = y * 3 - cy - 0.5;
    if (cx === 0 && cy === 0) {
      if (Math.abs(Math.abs(lx) - Math.abs(ly)) < 0.09 && Math.abs(lx) < 0.32) return ACCENT;
    }
    if (cx === 1 && cy === 1) {
      const d = Math.hypot(lx, ly);
      if (d < 0.34 && d > 0.2) return INK;
    }
    if (cx === 2 && cy === 2) {
      if (Math.abs(Math.abs(lx) - Math.abs(ly)) < 0.09 && Math.abs(lx) < 0.32) return ACCENT;
    }
    return BRAND;
  };
}

mkdirSync("site/icons", { recursive: true });
writeFileSync("site/icons/icon-192.png", png(192, artwork(0.08)));
writeFileSync("site/icons/icon-512.png", png(512, artwork(0.08)));
writeFileSync("site/icons/icon-maskable-512.png", png(512, artwork(0.2)));
writeFileSync("site/icons/apple-touch-icon.png", png(180, artwork(0.08)));
console.log("icons written to site/icons");
