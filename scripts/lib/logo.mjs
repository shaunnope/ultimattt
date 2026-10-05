// The logo's geometry, shared by site/icons/logo.svg (and its inline copy in the page header) and the PNG icons that
// scripts/make-icons.mjs rasterises. A 2×2×2 cube drawn isometrically: three visible faces, each split 2×2, with X's and
// O's on the cells. Every stroke is round-capped and round-joined. Coordinates are in a 64×64 box.

export const VIEW = 64;
export const COLORS = {
  ink: { css: "currentColor", rgb: [26, 26, 26] }, // --fg
  x: { css: "var(--mark-x, #3b5bdb)", rgb: [59, 91, 219] }, // --mark-x, the default palette
  o: { css: "var(--mark-o, #c2410c)", rgb: [194, 65, 12] }, // --mark-o, the default palette
};

const R = 28; // from the centre to a corner of the outline
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
  { name: "top", o: UL, u: sub(T, UL), v: sub(C, UL), marks: [["X", 0, 0], ["O", 1, 1]] },
  { name: "left", o: UL, u: sub(C, UL), v: sub(LL, UL), marks: [["O", 0, 0], ["X", 1, 1]] },
  { name: "right", o: C, u: sub(UR, C), v: sub(B, C), marks: [["X", 0, 1], ["O", 1, 0]] },
];

const at = (f, a, b) => add(f.o, add(scale(f.u, a), scale(f.v, b)));

const WIDTH = { outline: 3.4, edge: 2.4, grid: 1.5, mark: 3 };

/** Every stroked shape: { part, color, width, closed, points }, drawn in this order. */
export function logoShapes() {
  const shapes = [];
  shapes.push({ part: "cube", color: "ink", width: WIDTH.outline, closed: true, points: [T, UR, LR, B, LL, UL] });
  shapes.push({ part: "cube", color: "ink", width: WIDTH.edge, closed: false, points: [UL, C, UR] });
  shapes.push({ part: "cube", color: "ink", width: WIDTH.edge, closed: false, points: [C, B] });
  for (const f of FACES) {
    shapes.push({ part: "cube", color: "ink", width: WIDTH.grid, closed: false, points: [at(f, 0.5, 0), at(f, 0.5, 1)] });
    shapes.push({ part: "cube", color: "ink", width: WIDTH.grid, closed: false, points: [at(f, 0, 0.5), at(f, 1, 0.5)] });
  }
  for (const f of FACES) {
    for (const [mark, i, j] of f.marks) {
      const cx = (i + 0.5) / 2;
      const cy = (j + 0.5) / 2;
      if (mark === "X") {
        // drawn upright on the screen, not skewed with the face, so an X on the top face still reads as an X
        const [px, py] = at(f, cx, cy);
        const k = 4.1;
        shapes.push({ part: "X", color: "x", width: WIDTH.mark, closed: false, points: [[px - k, py - k], [px + k, py + k]] });
        shapes.push({ part: "X", color: "x", width: WIDTH.mark, closed: false, points: [[px + k, py - k], [px - k, py + k]] });
      } else {
        const r = 0.17;
        const points = Array.from({ length: 24 }, (_, n) => at(f, cx + r * Math.cos((n / 24) * 2 * Math.PI), cy + r * Math.sin((n / 24) * 2 * Math.PI)));
        shapes.push({ part: "O", color: "o", width: WIDTH.mark, closed: true, points });
      }
    }
  }
  return shapes;
}

const num = (v) => String(Math.round(v * 100) / 100);
const pathData = (s) => `M${s.points.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}${s.closed ? "Z" : ""}`;

/** The shapes as SVG elements: the cube in the text colour, then the X's and the O's in their palette colours. */
export function logoInner() {
  const element = (s) => `<path d="${pathData(s)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shapes = logoShapes();
  const group = (open, items) => `${open}${items.map(element).join("")}</g>`;
  return [
    group(`<g data-part="cube" fill="none" stroke="${COLORS.ink.css}">`, shapes.filter((s) => s.part === "cube")),
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
