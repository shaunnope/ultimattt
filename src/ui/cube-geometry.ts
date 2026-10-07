// The cube on screen, as numbers and strings: where each face sits on the flat net, how a layer's turn is written as CSS, and
// which icon a turn button wears. Pure: no DOM. CubeView.svelte and CubeBoard.svelte use these.

import type { Axis, CubeRotate } from "../core/types.ts";
import type { Quarters } from "../core/turn-path.ts";
import type { IconName } from "./icons.ts";

/** Each face drawn flat on the net, as 1-based [column, row] of its top-left sticker (U D F B L R): the cross of the original game. */
export const netOrigin = (n: number): [number, number][] => [[n + 1, 1], [n + 1, 2 * n + 1], [n + 1, n + 1], [3 * n + 1, n + 1], [1, n + 1], [2 * n + 1, n + 1]];

export const FACE_TRANSFORM = ["rotateX(90deg)", "rotateX(-90deg)", "rotateY(0deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateY(90deg)"] as const;

// A turn of the model by `deg` (+90 per quarter), as the CSS rotation that does the same on screen (CSS y points down).
// All three axes are always listed, so a transition between any two turns interpolates each angle on its own
// (matching function lists) instead of falling back to matrix interpolation, which cannot tell 270° from -90°.
export const TURN_CSS: Record<Axis, (deg: number) => string> = {
  x: (deg) => `rotateX(${-deg}deg) rotateY(0deg) rotateZ(0deg)`,
  y: (deg) => `rotateX(0deg) rotateY(${deg}deg) rotateZ(0deg)`,
  z: (deg) => `rotateX(0deg) rotateY(0deg) rotateZ(${-deg}deg)`,
};

/** Whether the browser can draw the 3D cube (otherwise only the flat view is offered). */
export function supports3D(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("transform-style", "preserve-3d");
  } catch {
    return false;
  }
}

export const quartersOf = (rotation: CubeRotate): Quarters => (rotation.dir === 1 ? 1 : rotation.dir === -1 ? -1 : 2);

/** The icon for a turn button: up and down (x axis), left and right (y axis), curved arrows (z axis), and a half turn. */
export function turnIcon(rotation: CubeRotate): IconName {
  if (rotation.dir === 2) return "turn-half";
  const back = rotation.dir === -1;
  if (rotation.axis === "x") return back ? "turn-up" : "turn-down";
  if (rotation.axis === "y") return back ? "turn-left" : "turn-right";
  return back ? "turn-clockwise" : "turn-anticlockwise";
}
