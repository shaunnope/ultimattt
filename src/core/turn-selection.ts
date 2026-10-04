// The Cube's turn selection as a small state machine (contracts/ui-contracts.md, "Cube turn flow"). A player who has
// scored picks a layer turn, sees it previewed, and then confirms or cancels. The rules of that flow live here;
// the DOM layer only animates what the effects ask for and reports when an animation has ended.
//
//   idle ──select──▶ animating(play) ──done──▶ previewing
//   previewing ──select another layer──▶ animating(reverse, then play the new one) ──done, done──▶ previewing
//   previewing ──select the same layer, another way──▶ animating(retarget) ──done──▶ previewing
//   previewing ──cancel──▶ animating(reverse) ──done──▶ idle
//   previewing ──confirm──▶ idle (effect: commit)
//   any ──reset──▶ idle (effect: discard)
//
// Input is ignored while animating. A preview is never saved, sent to the other device, or kept across a reload.
// Pure: no DOM, storage, network or clock.

import type { CubeRotate } from "./types.ts";

export type TurnSelection =
  | { status: "idle" }
  | { status: "animating"; /** the turn on screen */ rotation: CubeRotate; phase: "play" | "reverse" | "retarget"; /** a turn to play once this one has reversed */ queued: CubeRotate | null }
  | { status: "previewing"; rotation: CubeRotate; queued: null; phase: null };

export const IDLE: TurnSelection = { status: "idle" };

export type TurnEvent =
  | { type: "select"; rotation: CubeRotate }
  | { type: "cancel" }
  | { type: "confirm" }
  /** The animation the last effect asked for has ended */
  | { type: "done" }
  /** Undo, reload, a new game or leaving the screen */
  | { type: "reset" };

export type TurnEffect =
  /** Animate the layer to its turned position and hold it there */
  | { kind: "play"; rotation: CubeRotate }
  /** The same layer, another way: swing it straight from the first turn's position to the second's */
  | { kind: "retarget"; from: CubeRotate; to: CubeRotate }
  /** Animate the layer back to where it was */
  | { kind: "reverse"; rotation: CubeRotate }
  /** The player confirmed: make exactly this move, settling the view without replaying the animation */
  | { kind: "commit"; rotation: CubeRotate }
  /** Drop any preview at once, with no animation */
  | { kind: "discard" };

export interface Step {
  state: TurnSelection;
  effects: TurnEffect[];
}

const same = (a: CubeRotate, b: CubeRotate): boolean => a.axis === b.axis && a.layer === b.layer && a.dir === b.dir;
const stay = (state: TurnSelection): Step => ({ state, effects: [] });

export function step(state: TurnSelection, event: TurnEvent): Step {
  if (event.type === "reset") return { state: IDLE, effects: state.status === "idle" ? [] : [{ kind: "discard" }] };
  switch (state.status) {
    case "idle":
      if (event.type === "select") {
        return { state: { status: "animating", rotation: event.rotation, phase: "play", queued: null }, effects: [{ kind: "play", rotation: event.rotation }] };
      }
      return stay(state);
    case "previewing":
      if (event.type === "select") {
        if (same(event.rotation, state.rotation)) return stay(state);
        if (event.rotation.axis === state.rotation.axis && event.rotation.layer === state.rotation.layer) {
          return {
            state: { status: "animating", rotation: event.rotation, phase: "retarget", queued: null },
            effects: [{ kind: "retarget", from: state.rotation, to: event.rotation }],
          };
        }
        return {
          state: { status: "animating", rotation: state.rotation, phase: "reverse", queued: event.rotation },
          effects: [{ kind: "reverse", rotation: state.rotation }],
        };
      }
      if (event.type === "cancel") {
        return { state: { status: "animating", rotation: state.rotation, phase: "reverse", queued: null }, effects: [{ kind: "reverse", rotation: state.rotation }] };
      }
      if (event.type === "confirm") return { state: IDLE, effects: [{ kind: "commit", rotation: state.rotation }] };
      return stay(state);
    case "animating":
      if (event.type !== "done") return stay(state);
      if (state.phase === "play" || state.phase === "retarget") return { state: { status: "previewing", rotation: state.rotation, queued: null, phase: null }, effects: [] };
      if (state.queued) {
        return {
          state: { status: "animating", rotation: state.queued, phase: "play", queued: null },
          effects: [{ kind: "play", rotation: state.queued }],
        };
      }
      return { state: IDLE, effects: [] };
  }
}
