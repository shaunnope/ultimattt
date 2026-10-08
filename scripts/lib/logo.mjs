// The logo's geometry, shared by static/icons/logo.svg (and its inline copy in the page header, src/lib/components/Logo.svelte) and the PNG icons that
// scripts/make-icons.mjs rasterises. A 2×2×2 cube drawn isometrically: three visible faces, each split 2×2, with X's and
// O's on four of the cells. The faces are solid tiles (one tint per face, a gap between the cells, so the 2×2 grid still reads at
// 16px) rather than hairlines. Every stroke is round-capped and round-joined. Coordinates are in a 64×64 box.

export const VIEW = 64;
export const COLORS = {
  ink: { css: "currentColor", rgb: [26, 26, 26] }, // --fg
  x: { css: "var(--mark-x, #3b5bdb)", rgb: [59, 91, 219] }, // --mark-x, the default palette
  o: { css: "var(--mark-o, #c2410c)", rgb: [194, 65, 12] }, // --mark-o, the default palette
};

const R = 30; // from the centre to a corner of the outline
const DX = R * Math.cos(Math.PI / 6);
const DY = R / 2;
const C = [32, 32];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];

const T = [32, 32 - R];
const B = [32, 32 + R];
const UL = [32 - DX, 32 - DY];
const UR = [32 + DX, 32 - DY];
const LL = [32 - DX, 32 + DY];
const LR = [32 + DX, 32 + DY];

/** Each visible face as an origin and two edge vectors: a point in the face is origin + a·u + b·v, with a and b in 0..1. */
const FACES = [
  { name: "top", o: UL, u: sub(T, UL), v: sub(C, UL), marks: [["X", 1, 0]] },
  { name: "left", o: UL, u: sub(C, UL), v: sub(LL, UL), marks: [["O", 0, 1]] },
  { name: "right", o: C, u: sub(UR, C), v: sub(B, C), marks: [["O", 1, 0], ["X", 0, 1]] },
];

const at = (f, a, b) => add(f.o, add(scale(f.u, a), scale(f.v, b)));

const TILE = { width: 2.4, gap: 2.2, opacity: { top: 0.12, left: 0.26, right: 0.42 } }; // opacity of the ink: lightest on top, darkest on the right
const MARK = { width: 3.3, x: 0.15, o: 0.19 };

/** Every shape: { part, color, width, closed, points, opacity? }, drawn in this order. A shape with an opacity is a filled tile: the fill and the
 *  stroke (which rounds its corners) are the same ink, and the opacity applies to the pair as a whole. */
export function logoShapes() {
  const shapes = [];
  const inset = (TILE.gap / 2 + TILE.width / 2) / R; // in face units
  for (const f of FACES) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const [a0, a1, b0, b1] = [i / 2 + inset, (i + 1) / 2 - inset, j / 2 + inset, (j + 1) / 2 - inset];
        const points = [at(f, a0, b0), at(f, a1, b0), at(f, a1, b1), at(f, a0, b1)];
        shapes.push({ part: "cube", face: f.name, color: "ink", width: TILE.width, closed: true, points, opacity: TILE.opacity[f.name] });
      }
    }
  }
  for (const f of FACES) {
    for (const [mark, i, j] of f.marks) {
      const cx = (i + 0.5) / 2;
      const cy = (j + 0.5) / 2;
      if (mark === "X") {
        // drawn on the face, so it warps with the perspective like the O's: its arms run along the cell's diagonals
        const d = MARK.x;
        shapes.push({ part: "X", color: "x", width: MARK.width, closed: false, points: [at(f, cx - d, cy - d), at(f, cx + d, cy + d)] });
        shapes.push({ part: "X", color: "x", width: MARK.width, closed: false, points: [at(f, cx + d, cy - d), at(f, cx - d, cy + d)] });
      } else {
        const r = MARK.o;
        const points = Array.from({ length: 24 }, (_, n) => at(f, cx + r * Math.cos((n / 24) * 2 * Math.PI), cy + r * Math.sin((n / 24) * 2 * Math.PI)));
        shapes.push({ part: "O", color: "o", width: MARK.width, closed: true, points });
      }
    }
  }
  return shapes;
}

const num = (v) => String(Math.round(v * 100) / 100);
const pathData = (s) => `M${s.points.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}${s.closed ? "Z" : ""}`;

/** The shapes as SVG elements: the cube's tiles in the text colour (one group per face, carrying its opacity), then the X's and the O's in their palette colours. */
export function logoInner() {
  const element = (s) => `<path d="${pathData(s)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shapes = logoShapes();
  const group = (open, items) => `${open}${items.map(element).join("")}</g>`;
  const faces = FACES.map((f) => group(`<g opacity="${TILE.opacity[f.name]}" fill="${COLORS.ink.css}" stroke="${COLORS.ink.css}">`, shapes.filter((s) => s.face === f.name)));
  return [
    `<g data-part="cube">${faces.join("")}</g>`,
    group(`<g data-mark="X" fill="none" stroke="${COLORS.x.css}">`, shapes.filter((s) => s.part === "X")),
    group(`<g data-mark="O" fill="none" stroke="${COLORS.o.css}">`, shapes.filter((s) => s.part === "O")),
  ].join("");
}

/** The standalone file (it brings its own text colour for the light and dark browser tab) or the inline markup for the page. */
export function logoSvg({ inline = false } = {}) {
  const open = inline
    ? `<svg class="app-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" aria-hidden="true" focusable="false">`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">`;
  const style = inline ? "" : "<style>svg{color:#1a1a1a}@media (prefers-color-scheme:dark){svg{color:#f0f0f2}}</style>";
  return `${open}${style}${logoInner()}</svg>`;
}
