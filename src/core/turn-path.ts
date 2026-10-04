// The path a previewed layer takes when the player changes their mind, as plain numbers (research R5). The view
// keeps the previewed layer's cumulative angle in degrees (+90 per quarter turn) and transitions straight from the
// angle it is at to the one these functions return, so changing direction on the same layer never swings the layer
// back through where it started. Display only: nothing here touches a move. Pure: no DOM, storage, network or clock.

/** A quarter turn one way, the other way, or a half turn. */
export type Quarters = -1 | 1 | 2;

const mod360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** The angle to move a layer to, from `current`, to show `quarters` turns from its original orientation. It is
 *  congruent to the target mod 360 and within 180° of `current`. When two angles are 180° away (a quarter turn to the
 *  opposite quarter turn) it takes the one whose path goes through the half turn, never through the original. */
export function targetAngle(current: number, quarters: Quarters): number {
  let delta = mod360(quarters * 90 - current);
  if (delta > 180) delta -= 360;
  if (delta !== 180) return current + delta;
  // Two ways round: the path must have the half-turn position (180 mod 360) at its middle.
  return current + (mod360(current) === 270 ? -180 : 180);
}

/** The angle a held layer settles at when the preview ends: the nearest multiple of 360, so the layer reaches its
 *  original orientation by the shortest way. A tie goes away from zero. */
export function settleAngle(current: number): number {
  const turns = Math.round(Math.abs(current) / 360);
  return (Math.sign(current) * turns * 360) || 0;
}
