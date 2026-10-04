// Words and view angles for the Cube. Pure: the 3D view and the flat view both use these.

import type { CubeRotate, Scoring } from "../core/types.ts";
import type { CubeState } from "../core/cube.ts";
import { layerName, turnName } from "../core/notation.ts";

export { layerName };

/** Names for faces 0..5 (U, D, F, B, L, R). */
export const FACE_NAMES = ["top", "bottom", "front", "back", "left", "right"] as const;

/** One-letter names for the faces, in the same order, used in replay move labels. */
export const FACE_LETTERS = ["U", "D", "F", "B", "L", "R"] as const;

/** The accessible name of a turn: always in words, whichever style the player reads turns in. */
export const rotationLabel = (rotation: CubeRotate, size = 3): string => turnName(rotation, size, "words");

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
    const z1 = -x * Math.sin(rad(ry)) + z * Math.cos(rad(ry));
    const z2 = y * Math.sin(rad(rx)) + z1 * Math.cos(rad(rx));
    if (z2 > bestZ + 1e-9) {
      bestZ = z2;
      best = face;
    }
  });
  return best;
}

/** The heading over the score: what is being counted. */
export const scoreLabel = (scoring: Scoring): string => (scoring === "faces" ? "Faces" : "Lines");

/** Why a game ended early, when the lock option ended it: the board still has room, but only on locked faces. */
export function lockEndText(state: CubeState): string {
  return state.config.lockFaces && state.status !== "playing" && state.empty > 0 ? "No open face left to play on." : "";
}

/** The Cube options in play, for a game's title: "" when both are off. */
export function optionsNote(config: { scoring: Scoring; lockFaces: boolean }): string {
  return [config.scoring === "faces" ? "faces scoring" : "", config.lockFaces ? "locked faces" : ""].filter(Boolean).map((t) => `, ${t}`).join("");
}

/** A face counts as in view when it turns towards the viewer enough to read: the depth of its outward normal is at least
 *  this (cos 66°). At the opening angle that keeps the front, top and right faces and turns for the other three. */
const IN_VIEW_DEPTH = 0.4;

/** Whether a face can be read from the view (CSS rotateX(rx) rotateY(ry)). Same maths as `frontFace`. */
export function faceInView(rx: number, ry: number, face: number): boolean {
  const rad = (d: number) => (d * Math.PI) / 180;
  const normals: [number, number, number][] = [[0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0]];
  const [x, y, z] = normals[face]!;
  const z1 = -x * Math.sin(rad(ry)) + z * Math.cos(rad(ry));
  const depth = y * Math.sin(rad(rx)) + z1 * Math.cos(rad(rx));
  return depth >= IN_VIEW_DEPTH - 1e-9;
}
