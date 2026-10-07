import { test } from "node:test";
import assert from "node:assert/strict";
import { CubeSession, type TurnDriver } from "../../src/ui/cube-session.ts";
import type { CubeState } from "../../src/core/cube.ts";
import type { CubeRotate } from "../../src/core/types.ts";

// The Cube's turn flow as the screen runs it (contracts C7): pick a layer turn, see it previewed, then confirm or cancel. The
// rules of the flow are core/turn-selection.ts (tested in turn-selection.test.ts); this is what wraps them: it runs each effect
// against the view, ignores an animation that ends after the flow was dropped, and recognises the turn it just confirmed when
// the new position arrives. The view is a fake here whose animations end when the test says so.

const turn = (axis: "x" | "y" | "z", layer: number, dir: 1 | -1 | 2 = 1): CubeRotate => ({ t: "rotate", axis, layer, dir });
const R = turn("x", 2, -1);
const R2 = turn("x", 2, 1); // the same layer, the other way
const U = turn("y", 2, -1);
const key = (r: CubeRotate) => `${r.axis}${r.layer}${r.dir}`;

class FakeDriver implements TurnDriver {
  calls: string[] = [];
  private pending: (() => void)[] = [];
  private commits: (() => void)[] = [];
  play(rotation: CubeRotate): Promise<void> {
    this.calls.push(`play ${key(rotation)}`);
    return new Promise((resolve) => this.pending.push(resolve));
  }
  retarget(from: CubeRotate, to: CubeRotate): Promise<void> {
    this.calls.push(`retarget ${key(from)} ${key(to)}`);
    return new Promise((resolve) => this.pending.push(resolve));
  }
  reverse(rotation: CubeRotate): Promise<void> {
    this.calls.push(`reverse ${key(rotation)}`);
    return new Promise((resolve) => this.pending.push(resolve));
  }
  discard(): void {
    this.calls.push("discard");
  }
  commit(commit: () => void): void {
    this.calls.push("commit");
    this.commits.push(commit);
  }
  /** End every animation that is running, then let the session react. */
  async finish(): Promise<void> {
    const running = this.pending.splice(0);
    running.forEach((resolve) => resolve());
    await Promise.resolve();
    await Promise.resolve();
  }
  runCommit(): void {
    this.commits.splice(0).forEach((commit) => commit());
  }
}

function make() {
  const driver = new FakeDriver();
  const moves: CubeRotate[] = [];
  const session = new CubeSession(driver, (rotation) => moves.push(rotation));
  return { session, driver, moves };
}

const position = (...played: object[]) => ({ moves: played }) as unknown as CubeState;

test("selecting a turn plays it, and when the animation ends it is held as a preview", async () => {
  const { session, driver } = make();
  assert.equal(session.preview, null);
  session.select(R);
  assert.deepEqual(driver.calls, ["play x2-1"]);
  assert.equal(session.busy, true);
  assert.equal(session.settled, null);
  await driver.finish();
  assert.equal(session.busy, false);
  assert.deepEqual(session.settled, R);
  assert.deepEqual(session.preview, R);
});

test("while a turn animates, selecting, confirming and cancelling do nothing", async () => {
  const { session, driver, moves } = make();
  session.select(R);
  session.select(U);
  session.confirm();
  session.cancel();
  assert.deepEqual(driver.calls, ["play x2-1"]);
  assert.deepEqual(moves, []);
  await driver.finish();
  assert.deepEqual(session.settled, R);
});

test("selecting another layer reverses the first turn, then plays the second", async () => {
  const { session, driver } = make();
  session.select(R);
  await driver.finish();
  session.select(U);
  assert.deepEqual(driver.calls, ["play x2-1", "reverse x2-1"]);
  await driver.finish();
  assert.deepEqual(driver.calls, ["play x2-1", "reverse x2-1", "play y2-1"]);
  await driver.finish();
  assert.deepEqual(session.settled, U);
});

test("selecting the same layer the other way swings it straight across, never back through the start", async () => {
  const { session, driver } = make();
  session.select(R);
  await driver.finish();
  session.select(R2);
  assert.deepEqual(driver.calls.at(-1), "retarget x2-1 x21");
  await driver.finish();
  assert.deepEqual(session.settled, R2);
});

test("selecting the turn that is already held changes nothing", async () => {
  const { session, driver } = make();
  session.select(R);
  await driver.finish();
  session.select({ ...R });
  assert.deepEqual(driver.calls, ["play x2-1"]);
});

test("cancel turns the layer back and leaves nothing previewed, with no move made", async () => {
  const { session, driver, moves } = make();
  session.select(R);
  await driver.finish();
  session.cancel();
  assert.deepEqual(driver.calls.at(-1), "reverse x2-1");
  await driver.finish();
  assert.equal(session.preview, null);
  assert.deepEqual(moves, []);
});

test("confirm makes exactly the previewed turn, once the view has settled the marks", async () => {
  const { session, driver, moves } = make();
  session.select(U);
  await driver.finish();
  session.confirm();
  assert.equal(driver.calls.at(-1), "commit");
  assert.deepEqual(moves, [], "the move is made when the view says so");
  driver.runCommit();
  assert.deepEqual(moves, [U]);
  assert.equal(session.preview, null);
});

test("confirm with nothing previewed does nothing", () => {
  const { session, driver, moves } = make();
  session.confirm();
  assert.deepEqual(driver.calls, []);
  assert.deepEqual(moves, []);
});

test("reset drops the preview at once, and an animation that ends afterwards cannot revive it", async () => {
  const { session, driver } = make();
  session.select(R);
  session.reset();
  assert.equal(driver.calls.at(-1), "discard");
  assert.equal(session.preview, null);
  await driver.finish(); // the play that was running ends late
  assert.equal(session.preview, null);
  assert.equal(session.busy, false);
});

test("reset with nothing previewed does nothing", () => {
  const { session, driver } = make();
  session.reset();
  assert.deepEqual(driver.calls, []);
});

test("the turn that was just confirmed is recognised when the new position arrives, and is not replayed", async () => {
  const { session, driver } = make();
  session.select(U);
  await driver.finish();
  session.confirm();
  driver.runCommit();
  const before = position({ t: "place" });
  const after = position({ t: "place" }, U);
  assert.deepEqual(session.position(before, after), { justConfirmed: true });
  // and only once
  assert.deepEqual(session.position(before, after), { justConfirmed: false });
});

test("a position that is not the confirmed turn drops a preview (undo, the other device's move, a reload)", async () => {
  const { session, driver } = make();
  session.select(R);
  await driver.finish();
  const result = session.position(position({ t: "place" }, R), position({ t: "place" }));
  assert.deepEqual(result, { justConfirmed: false });
  assert.equal(session.preview, null);
  assert.equal(driver.calls.at(-1), "discard");
});

test("a position that arrives with no preview and no turn to recognise changes nothing", () => {
  const { session, driver } = make();
  assert.deepEqual(session.position(null, position()), { justConfirmed: false });
  assert.deepEqual(driver.calls, []);
});

test("subscribers hear every change, and stop when they unsubscribe", async () => {
  const { session, driver } = make();
  let calls = 0;
  const stop = session.subscribe(() => calls++);
  assert.equal(calls, 1);
  session.select(R);
  await driver.finish();
  assert.equal(calls >= 3, true);
  const before = calls;
  stop();
  session.cancel();
  assert.equal(calls, before);
});
