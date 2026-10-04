// The marks: X is two strokes and O is a circle, drawn as SVG in a 100×100 box, in the player's colour
// (CSS custom properties --mark-x and --mark-o, set from the chosen palette). A newly placed mark draws itself in
// (0.22 s, the second stroke of an X a beat later); anything already on the board, and everything under reduced
// motion, simply appears. Shapes differ between the players, so colour is never the only signal.
// Where a name is needed (aria-labels, status lines) the plain letter X or O is used.

import type { Mark } from "../core/types.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface Stroke {
  tag: "path" | "circle";
  attrs: Record<string, string>;
}

export interface MarkShape {
  viewBox: string;
  strokes: Stroke[];
}

/** The strokes of a mark. pathLength="1" lets one dash animation draw any of them. */
export function markShape(mark: Mark): MarkShape {
  if (mark === "X") {
    return {
      viewBox: "0 0 100 100",
      strokes: [
        { tag: "path", attrs: { pathLength: "1", d: "M26 26 74 74" } },
        { tag: "path", attrs: { pathLength: "1", d: "M74 26 26 74" } },
      ],
    };
  }
  return { viewBox: "0 0 100 100", strokes: [{ tag: "circle", attrs: { pathLength: "1", cx: "50", cy: "50", r: "27" } }] };
}

export const markName = (mark: Mark): string => mark;

/** Class names for a mark. `mark-new` starts the draw-in, and is never added under reduced motion. */
export function markClassName(mark: Mark, fresh: boolean, reducedMotion = false): string {
  return `mark mark-${mark.toLowerCase()}${fresh && !reducedMotion ? " mark-new" : ""}`;
}

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** An SVG element for a mark. Decorative: the cell or sticker that holds it carries the accessible name. */
export function createMark(mark: Mark, opts: { fresh?: boolean } = {}): SVGSVGElement {
  const shape = markShape(mark);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", markClassName(mark, opts.fresh === true, prefersReducedMotion()));
  svg.setAttribute("viewBox", shape.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const stroke of shape.strokes) {
    const el = document.createElementNS(SVG_NS, stroke.tag);
    for (const [name, value] of Object.entries(stroke.attrs)) el.setAttribute(name, value);
    svg.append(el);
  }
  return svg;
}
