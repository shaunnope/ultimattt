// Words and view angles for the Cube. Pure: the 3D view and the flat view both use these.

import type { Axis, CubeRotate } from "../core/types.ts";
import type { CubeState } from "../core/cube.ts";
import { markGlyph } from "./glyph.ts";

/** Names for faces 0..5 (U, D, F, B, L, R). */
export const FACE_NAMES = ["top", "bottom", "front", "back", "left", "right"] as const;

const LAYER_NAMES: Record<Axis, [string, string, string]> = {
  x: ["left", "vertical middle", "right"],
  y: ["bottom", "horizontal middle", "top"],
  z: ["back", "front-to-back middle", "front"],
};

export const layerName = (axis: Axis, layer: 0 | 1 | 2): string => LAYER_NAMES[axis][layer];

// Which way a +90° turn (dir 1) carries the front of the layer, in words. dir -1 is the opposite.
const WAYS: Record<Axis, { forward: string; back: string }> = {
  x: { forward: "down", back: "up" },
  y: { forward: "to the right", back: "to the left" },
  z: { forward: "anticlockwise", back: "clockwise" },
};

export function rotationLabel(rotation: CubeRotate): string {
  const name = layerName(rotation.axis, rotation.layer);
  if (rotation.dir === 2) return `Half turn the ${name} layer`;
  const way = rotation.dir === 1 ? WAYS[rotation.axis].forward : WAYS[rotation.axis].back;
  return `Turn the ${name} layer ${way}`;
}

/** View angles (degrees, CSS rotateX then rotateY) that bring a face to the front. */
export function faceViewAngles(face: number): { rx: number; ry: number } {
  const views: Record<number, { rx: number; ry: number }> = {
    0: { rx: -90, ry: 0 },
    1: { rx: 90, ry: 0 },
    2: { rx: 0, ry: 0 },
    3: { rx: 0, ry: 180 },
    4: { rx: 0, ry: 90 },
    5: { rx: 0, ry: -90 },
  };
  return views[face]!;
}

/** The face turned most directly towards the viewer for a view (CSS rotateX(rx) rotateY(ry)). */
export function frontFace(rx: number, ry: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  // outward normals in CSS space (y points down): U, D, F, B, L, R
  const normals: [number, number, number][] = [[0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0]];
  let best = 2;
  let bestZ = -Infinity;
  normals.forEach(([x, y, z], face) => {
    const x1 = x * Math.cos(rad(ry)) + z * Math.sin(rad(ry));
    const z1 = -x * Math.sin(rad(ry)) + z * Math.cos(rad(ry));
    const z2 = y * Math.sin(rad(rx)) + z1 * Math.cos(rad(rx));
    void x1;
    if (z2 > bestZ + 1e-9) {
      bestZ = z2;
      best = face;
    }
  });
  return best;
}

export function cubeStatus(state: CubeState): string {
  if (state.status !== "playing") return "";
  if (state.phase === "rotate") return `${markGlyph(state.toMove)} scored! Turn a layer of the cube.`;
  return `${markGlyph(state.toMove)} to move.`;
}
