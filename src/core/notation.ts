// Names for Cube turns, for display only (research R15). A turn can be named in plain words ("Turn the top layer to
// the right") or in cube-solving notation (R, U', F2, M, 2R, 3L). The choice never touches a saved move, a link, a
// seed or a message: those always carry the rotation itself. Pure: no DOM, storage, network or clock.
//
// Notation: R, U and F turn clockwise as seen looking at that face, which with the 001 convention (dir +1 is +90° by
// the right-hand rule about +axis) is dir -1; L, D and B are dir +1. A prime means the opposite way, a 2 a half turn.
// Every name is one layer, never a wide turn. The middle layer of any odd cube (3×3 and 5×5) is a slice: M (turns like
// L), E (like D) and S (like F). Any other inner layer is numbered by its depth from the nearer face, taking the high
// side (R, U, F) when it is nearer that side: on a 4×4 the layers across are L 2L 2R R, and on a 5×5 L 2L M 2R R.

import type { Axis, CubeRotate, RotateDir } from "./types.ts";

export type NotationStyle = "words" | "cube";

const AXES: Axis[] = ["x", "y", "z"];
const LETTERS: Record<Axis, { low: string; high: string; slice: string }> = {
  x: { low: "L", high: "R", slice: "M" },
  y: { low: "D", high: "U", slice: "E" },
  z: { low: "B", high: "F", slice: "S" },
};
// Which way a slice follows: M like L (+1), E like D (+1), S like F (-1)
const SLICE_WAY: Record<Axis, RotateDir> = { x: 1, y: 1, z: -1 };

const WORDS: Record<Axis, { low: string; high: string; mid: string }> = {
  x: { low: "left", high: "right", mid: "vertical middle" },
  y: { low: "bottom", high: "top", mid: "horizontal middle" },
  z: { low: "back", high: "front", mid: "front-to-back middle" },
};

// Which way a +90° turn (dir 1) carries the front of the layer, in words. dir -1 is the opposite.
const WAYS: Record<Axis, { forward: string; back: string }> = {
  x: { forward: "down", back: "up" },
  y: { forward: "to the right", back: "to the left" },
  z: { forward: "anticlockwise", back: "clockwise" },
};

const ORDINALS = ["", "first", "second", "third", "fourth"];

interface Base {
  /** The layer's notation letter, with its depth for an inner layer (R, M, 2L) */
  label: string;
  /** The dir that is the plain, un-primed turn */
  way: RotateDir;
}

function base(axis: Axis, layer: number, size: number): Base {
  const { low, high, slice } = LETTERS[axis];
  if (layer === 0) return { label: low, way: 1 };
  if (layer === size - 1) return { label: high, way: -1 };
  if (size % 2 === 1 && layer === (size - 1) / 2) return { label: slice, way: SLICE_WAY[axis] };
  const depthHigh = size - layer;
  if (depthHigh < layer + 1) return { label: `${depthHigh}${high}`, way: -1 };
  return { label: `${layer + 1}${low}`, way: 1 };
}

/** The layer's name in words, without the word "layer": left, vertical middle, second from the left, ... */
export function layerName(axis: Axis, layer: number, size = 3): string {
  const w = WORDS[axis];
  if (layer === 0) return w.low;
  if (layer === size - 1) return w.high;
  if (size % 2 === 1 && layer === (size - 1) / 2) return w.mid;
  const fromLow = layer + 1;
  const fromHigh = size - layer;
  return fromLow <= fromHigh ? `${ORDINALS[fromLow]} from the ${w.low}` : `${ORDINALS[fromHigh]} from the ${w.high}`;
}

/** The layer as a noun phrase: "top layer", "second layer from the left". */
export function layerPhrase(axis: Axis, layer: number, size: number): string {
  const name = layerName(axis, layer, size);
  const at = name.indexOf(" from the ");
  return at < 0 ? `${name} layer` : `${name.slice(0, at)} layer${name.slice(at)}`;
}

/** The face letter of an outer layer (R, L, U, D, F, B), or null for any other layer. */
export function faceLetter(axis: Axis, layer: number, size: number): string | null {
  if (layer === 0) return LETTERS[axis].low;
  if (layer === size - 1) return LETTERS[axis].high;
  return null;
}

/** Text for a turn in the chosen style. */
export function turnName(rotation: CubeRotate, size: number, style: NotationStyle): string {
  if (style === "words") {
    const phrase = layerPhrase(rotation.axis, rotation.layer, size);
    if (rotation.dir === 2) return `Half turn the ${phrase}`;
    const way = rotation.dir === 1 ? WAYS[rotation.axis].forward : WAYS[rotation.axis].back;
    return `Turn the ${phrase} ${way}`;
  }
  const { label, way } = base(rotation.axis, rotation.layer, size);
  return `${label}${rotation.dir === 2 ? "2" : rotation.dir === way ? "" : "'"}`;
}

/** The label of a row in the turn picker: the layer's name in words, or its notation letter. */
export function layerLabel(axis: Axis, layer: number, size: number, style: NotationStyle): string {
  return style === "words" ? layerName(axis, layer, size) : base(axis, layer, size).label;
}

/** Read a turn written in cube notation, or give an error. The text must be exactly what turnName would write for that size. */
export function parseTurnName(text: string, size: number): CubeRotate | { error: string } {
  const m = /^([2-3]?)([LRUDFBMES])(['2]?)$/.exec(String(text ?? ""));
  if (!m) return { error: `"${text}" is not a turn.` };
  for (const axis of AXES) {
    for (let layer = 0; layer < size; layer++) {
      const { label, way } = base(axis, layer, size);
      if (label !== `${m[1]}${m[2]}`) continue;
      const dir: RotateDir = m[3] === "2" ? 2 : m[3] === "'" ? (way === 1 ? -1 : 1) : way;
      return { t: "rotate", axis, layer, dir };
    }
  }
  return { error: `"${text}" is not a turn on a ${size}×${size} cube.` };
}

/** Every turn, in picker order: layers across the cube (y, top first), down the cube (x, left first), front to back (z, front first). */
export function turnsFor(size: number): CubeRotate[] {
  const order: { axis: Axis; layers: number[] }[] = [
    { axis: "y", layers: Array.from({ length: size }, (_, i) => size - 1 - i) },
    { axis: "x", layers: Array.from({ length: size }, (_, i) => i) },
    { axis: "z", layers: Array.from({ length: size }, (_, i) => size - 1 - i) },
  ];
  const dirs: RotateDir[] = [-1, 1, 2];
  return order.flatMap(({ axis, layers }) => layers.flatMap((layer) => dirs.map((dir): CubeRotate => ({ t: "rotate", axis, layer, dir }))));
}
