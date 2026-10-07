// The Cube's turn flow as the screen runs it (contracts C7). A player who has scored picks a layer turn, sees it previewed
// (the layer turns and stays turned), then confirms or cancels. The rules of the flow are the pure state machine in
// core/turn-selection.ts; this wraps it: it runs each effect against the view (a TurnDriver), ignores an animation that ends
// after the flow was dropped, and recognises the turn it just confirmed when the new position arrives so it is not replayed.
// No DOM and no framework. Store-compatible: `subscribe` calls back at once and after every change.

import type { CubeState } from "../core/cube.ts";
import { IDLE, step, type TurnEffect, type TurnEvent, type TurnSelection } from "../core/turn-selection.ts";
import type { CubeRotate } from "../core/types.ts";

/** What the session asks of the view. The animations resolve when they have ended. */
export interface TurnDriver {
  /** Animate the layer to its turned position and hold it there. */
  play(rotation: CubeRotate): Promise<void>;
  /** The same layer, another way: swing it straight from the first turn's position to the second's. */
  retarget(from: CubeRotate, to: CubeRotate): Promise<void>;
  /** Animate the layer back to where it was. */
  reverse(rotation: CubeRotate): Promise<void>;
  /** Drop any preview at once, with no animation. */
  discard(): void;
  /** The player confirmed: settle the view with no animation replayed, then call `commit` to make the move. */
  commit(commit: () => void): void;
}

const sameTurn = (a: CubeRotate | null, b: CubeRotate): boolean => a !== null && a.axis === b.axis && a.layer === b.layer && a.dir === b.dir;

export class CubeSession {
  private selection: TurnSelection = IDLE;
  /** Bumped whenever a flow ends early, so an animation that finishes late cannot move the machine on. */
  private epoch = 0;
  /** A confirmed turn whose result has not arrived yet: its animation has already been shown. */
  private committed: CubeRotate | null = null;
  private readonly listeners = new Set<(session: CubeSession) => void>();
  private readonly driver: TurnDriver;
  private readonly onMove: (rotation: CubeRotate) => void;

  constructor(driver: TurnDriver, onMove: (rotation: CubeRotate) => void) {
    this.driver = driver;
    this.onMove = onMove;
  }

  subscribe(run: (session: CubeSession) => void): () => void {
    this.listeners.add(run);
    run(this);
    return () => void this.listeners.delete(run);
  }

  private notify(): void {
    for (const run of [...this.listeners]) run(this);
  }

  /** The turn being shown, animating or held, or null. */
  get preview(): CubeRotate | null {
    return this.selection.status === "idle" ? null : this.selection.rotation;
  }

  /** The turn held as a preview (not while it animates), or null. This is the one Confirm would make. */
  get settled(): CubeRotate | null {
    return this.selection.status === "previewing" ? this.selection.rotation : null;
  }

  get busy(): boolean {
    return this.selection.status === "animating";
  }

  get status(): TurnSelection["status"] {
    return this.selection.status;
  }

  /** True while the preview is turning back, so its button should no longer show as pressed. */
  get reversing(): boolean {
    return this.selection.status === "animating" && this.selection.phase === "reverse" && this.selection.queued === null;
  }

  select(rotation: CubeRotate): void {
    this.dispatch({ type: "select", rotation });
  }
  confirm(): void {
    this.dispatch({ type: "confirm" });
  }
  cancel(): void {
    this.dispatch({ type: "cancel" });
  }
  /** Undo, a new game, a reload or leaving the screen. */
  reset(): void {
    this.dispatch({ type: "reset" });
  }

  private dispatch(event: TurnEvent): void {
    const out = step(this.selection, event);
    this.selection = out.state;
    const mine = this.epoch;
    const done = (): void => {
      if (mine === this.epoch) this.dispatch({ type: "done" });
    };
    for (const effect of out.effects) this.run(effect, done);
    this.notify();
  }

  private run(effect: TurnEffect, done: () => void): void {
    if (effect.kind === "play") void this.driver.play(effect.rotation).then(done);
    else if (effect.kind === "retarget") void this.driver.retarget(effect.from, effect.to).then(done);
    else if (effect.kind === "reverse") void this.driver.reverse(effect.rotation).then(done);
    else if (effect.kind === "discard") {
      this.epoch++;
      this.driver.discard();
    } else {
      this.committed = effect.rotation;
      this.driver.commit(() => this.onMove(effect.rotation));
    }
  }

  /**
   * A new position arrived. Any position that is not simply the turn that was just confirmed drops a preview (undo, the other
   * device's move, a reload). Returns whether it was the confirmed turn, whose animation has already been shown.
   */
  position(previous: CubeState | null, state: CubeState): { justConfirmed: boolean } {
    const grew = previous !== null && state.moves.length === previous.moves.length + 1;
    const lastMove = state.moves[state.moves.length - 1];
    const justConfirmed = grew && lastMove?.t === "rotate" && sameTurn(this.committed, lastMove as CubeRotate);
    if (!justConfirmed && this.selection.status !== "idle") this.reset();
    if (justConfirmed) this.committed = null;
    return { justConfirmed };
  }
}
