import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createToastState, DEFAULT_TOAST_MS, type ToastItem } from "../../src/ui/toast-state.ts";

// The toast list behind the #toasts region: each message removes itself after its time. Framework-free and
// store-compatible, so the component just subscribes.

test("add appends an item with an id, and subscribers see the list", () => {
  const state = createToastState();
  const seen: ToastItem[][] = [];
  state.subscribe((items) => seen.push(items));
  state.add("Copied", 1000);
  assert.deepEqual(seen[0], []);
  assert.equal(seen.at(-1)!.length, 1);
  assert.equal(seen.at(-1)![0]!.text, "Copied");
  assert.equal(seen.at(-1)![0]!.ms, 1000);
  assert.equal(typeof seen.at(-1)![0]!.id, "number");
});

test("items keep their order and have different ids", () => {
  const state = createToastState();
  state.add("one", 1000);
  state.add("two", 1000);
  const items = state.get();
  assert.deepEqual(items.map((i) => i.text), ["one", "two"]);
  assert.notEqual(items[0]!.id, items[1]!.id);
});

test("an item removes itself after its time, and not before", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const state = createToastState();
    state.add("short", 1000);
    state.add("long", 3000);
    mock.timers.tick(999);
    assert.equal(state.get().length, 2);
    mock.timers.tick(1);
    assert.deepEqual(state.get().map((i) => i.text), ["long"]);
    mock.timers.tick(2000);
    assert.deepEqual(state.get(), []);
  } finally {
    mock.timers.reset();
  }
});

test("the default time is 3500 ms", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(DEFAULT_TOAST_MS, 3500);
    const state = createToastState();
    state.add("default");
    assert.equal(state.get()[0]!.ms, 3500);
    mock.timers.tick(3499);
    assert.equal(state.get().length, 1);
    mock.timers.tick(1);
    assert.equal(state.get().length, 0);
  } finally {
    mock.timers.reset();
  }
});

test("remove takes an item out at once, and removing it twice is harmless", () => {
  const state = createToastState();
  state.add("a", 100_000);
  const { id } = state.get()[0]!;
  state.remove(id);
  state.remove(id);
  assert.deepEqual(state.get(), []);
});

test("unsubscribing stops the calls", () => {
  const state = createToastState();
  let calls = 0;
  const stop = state.subscribe(() => calls++);
  stop();
  state.add("x", 100_000);
  assert.equal(calls, 1);
});
