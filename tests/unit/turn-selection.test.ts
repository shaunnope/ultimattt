import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE, step, type TurnSelection, type TurnEvent } from "../../src/core/turn-selection.ts";
import type { CubeRotate } from "../../src/core/types.ts";

const turn = (axis: "x" | "y" | "z", layer: number, dir: 1 | -1 | 2 = 1): CubeRotate => ({ t: "rotate", axis, layer, dir });
const R = turn("x", 2, -1);
const U = turn("y", 2, -1);

/** Run events, finishing every animation straight away, and return the last state with every effect in order. */
function run(events: TurnEvent[], from: TurnSelection = IDLE) {
  let state = from;
  const effects: string[] = [];
  for (const event of events) {
    const out = step(state, event);
    state = out.state;
    effects.push(...out.effects.map((e) => `${e.kind}${"rotation" in e ? ":" + e.rotation.axis + e.rotation.layer + e.rotation.dir : ""}`));
  }
  return { state, effects };
}

test("selecting a turn when idle plays it, and when the animation ends it is being previewed", () => {
  const first = step(IDLE, { type: "select", rotation: R });
  assert.equal(first.state.status, "animating");
  assert.deepEqual(first.effects, [{ kind: "play", rotation: R }]);
  const done = step(first.state, { type: "done" });
  assert.deepEqual(done.state, { status: "previewing", rotation: R, queued: null, phase: null });
  assert.deepEqual(done.effects, []);
});

test("selecting another turn while previewing reverses the first, then plays the second", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const switching = step(previewing, { type: "select", rotation: U });
  assert.equal(switching.state.status, "animating");
  assert.deepEqual(switching.effects, [{ kind: "reverse", rotation: R }]);
  const second = step(switching.state, { type: "done" });
  assert.deepEqual(second.effects, [{ kind: "play", rotation: U }]);
  assert.equal(second.state.status, "animating");
  const settled = step(second.state, { type: "done" });
  assert.deepEqual(settled.state, { status: "previewing", rotation: U, queued: null, phase: null });
});

test("selecting the turn that is already previewed changes nothing", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const again = step(previewing, { type: "select", rotation: { ...R } });
  assert.deepEqual(again.state, previewing);
  assert.deepEqual(again.effects, []);
});

test("cancel reverses the preview and returns to idle with nothing committed", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const cancelled = step(previewing, { type: "cancel" });
  assert.deepEqual(cancelled.effects, [{ kind: "reverse", rotation: R }]);
  const idle = step(cancelled.state, { type: "done" });
  assert.deepEqual(idle.state, IDLE);
  assert.ok(![...cancelled.effects, ...idle.effects].some((e) => e.kind === "commit"));
});

test("confirm yields exactly the previewed rotation and returns to idle at once", () => {
  const previewing = run([{ type: "select", rotation: U }, { type: "done" }]).state;
  const confirmed = step(previewing, { type: "confirm" });
  assert.deepEqual(confirmed.state, IDLE);
  assert.deepEqual(confirmed.effects, [{ kind: "commit", rotation: U }]);
});

test("after a switch, confirm commits the second turn, never the first", () => {
  const { state, effects } = run([
    { type: "select", rotation: R }, { type: "done" },
    { type: "select", rotation: U }, { type: "done" }, { type: "done" },
    { type: "confirm" },
  ]);
  assert.deepEqual(state, IDLE);
  assert.equal(effects.filter((e) => e.startsWith("commit")).join(), "commit:y2-1");
});

test("input is ignored while animating: select, cancel and confirm do nothing", () => {
  const animating = step(IDLE, { type: "select", rotation: R }).state;
  for (const event of [{ type: "select", rotation: U }, { type: "cancel" }, { type: "confirm" }] as TurnEvent[]) {
    const out = step(animating, event);
    assert.deepEqual(out.state, animating, event.type);
    assert.deepEqual(out.effects, [], event.type);
  }
  // also while a preview is reversing
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const reversing = step(previewing, { type: "cancel" }).state;
  assert.deepEqual(step(reversing, { type: "confirm" }).effects, []);
  assert.deepEqual(step(reversing, { type: "select", rotation: U }).effects, []);
});

test("cancel and confirm do nothing when idle, and done does nothing when idle or previewing", () => {
  for (const event of [{ type: "cancel" }, { type: "confirm" }, { type: "done" }] as TurnEvent[]) {
    assert.deepEqual(step(IDLE, event), { state: IDLE, effects: [] }, event.type);
  }
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  assert.deepEqual(step(previewing, { type: "done" }), { state: previewing, effects: [] });
});

test("reset (undo, reload, a new game, leaving the screen) forces idle from any state and discards the preview", () => {
  const animating = step(IDLE, { type: "select", rotation: R }).state;
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  for (const from of [IDLE, animating, previewing]) {
    const out = step(from, { type: "reset" });
    assert.deepEqual(out.state, IDLE);
    assert.ok(!out.effects.some((e) => e.kind === "commit"));
  }
  assert.deepEqual(step(previewing, { type: "reset" }).effects, [{ kind: "discard" }]);
  assert.deepEqual(step(IDLE, { type: "reset" }).effects, []);
});

test("the machine never mutates the state it is given", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const before = JSON.stringify(previewing);
  step(previewing, { type: "select", rotation: U });
  step(previewing, { type: "cancel" });
  step(previewing, { type: "confirm" });
  assert.equal(JSON.stringify(previewing), before);
});

// ---- the same layer, another direction: the layer swings straight there (003) ----

const Rinv = turn("x", 2, 1);
const R2 = turn("x", 2, 2);
const code = (r: CubeRotate) => `${r.axis}${r.layer}${r.dir}`;

test("selecting the other direction of the previewed layer retargets instead of reversing first", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const out = step(previewing, { type: "select", rotation: Rinv });
  assert.deepEqual(out.state, { status: "animating", rotation: Rinv, phase: "retarget", queued: null });
  assert.deepEqual(out.effects, [{ kind: "retarget", from: R, to: Rinv }]);
  assert.deepEqual(step(previewing, { type: "select", rotation: R2 }).effects, [{ kind: "retarget", from: R, to: R2 }]);
});

test("when a retarget ends the new turn is being previewed, and confirm commits it", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const retargeting = step(previewing, { type: "select", rotation: Rinv }).state;
  const done = step(retargeting, { type: "done" });
  assert.deepEqual(done.state, { status: "previewing", rotation: Rinv, queued: null, phase: null });
  assert.deepEqual(done.effects, []);
  assert.deepEqual(step(done.state, { type: "confirm" }).effects, [{ kind: "commit", rotation: Rinv }]);
});

test("cancel after a retarget reverses the new turn, never the first", () => {
  const { state } = run([{ type: "select", rotation: R }, { type: "done" }, { type: "select", rotation: Rinv }, { type: "done" }]);
  assert.deepEqual(step(state, { type: "cancel" }).effects, [{ kind: "reverse", rotation: Rinv }]);
});

test("input during a retarget is ignored, like during any other animation", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const retargeting = step(previewing, { type: "select", rotation: Rinv }).state;
  for (const event of [{ type: "select", rotation: U }, { type: "cancel" }, { type: "confirm" }] as TurnEvent[]) {
    assert.deepEqual(step(retargeting, event), { state: retargeting, effects: [] }, event.type);
  }
});

test("a different layer still reverses then plays, and the same turn is a no-op", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  assert.deepEqual(step(previewing, { type: "select", rotation: turn("x", 1, -1) }).effects, [{ kind: "reverse", rotation: R }]);
  assert.deepEqual(step(previewing, { type: "select", rotation: { ...R } }), { state: previewing, effects: [] });
});

test("reset during a retarget discards the preview", () => {
  const previewing = run([{ type: "select", rotation: R }, { type: "done" }]).state;
  const retargeting = step(previewing, { type: "select", rotation: Rinv }).state;
  assert.deepEqual(step(retargeting, { type: "reset" }), { state: IDLE, effects: [{ kind: "discard" }] });
});

test("a long run of same-layer changes ends on the last turn selected", () => {
  const turns = [R, Rinv, R2, R, R2, Rinv];
  const events: TurnEvent[] = [{ type: "select", rotation: turns[0]! }, { type: "done" }];
  for (const t of turns.slice(1)) events.push({ type: "select", rotation: t }, { type: "done" });
  const { state, effects } = run(events);
  assert.deepEqual(state, { status: "previewing", rotation: turns.at(-1)!, queued: null, phase: null });
  assert.ok(effects.every((e) => !e.startsWith("reverse")), effects.join());
  assert.equal(code(turns.at(-1)!), "x21");
});
