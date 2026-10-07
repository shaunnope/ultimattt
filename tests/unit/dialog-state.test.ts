import { test } from "node:test";
import assert from "node:assert/strict";
import { createDialogState, type DialogRequest } from "../../src/ui/dialog-state.ts";

// The stack of open dialogs behind the dialog host (data-model, DialogRequest). A request's promise settles when the
// dialog has closed: with the chosen action's value, or null when it was dismissed.

const options = (title: string) => ({ title, body: ["text"], actions: [{ label: "Done", value: "done", primary: true }] });

test("open returns a promise and puts a request on the stack", () => {
  const state = createDialogState();
  const result = state.open(options("One"));
  assert.ok(result instanceof Promise);
  const stack = state.get();
  assert.equal(stack.length, 1);
  assert.equal(stack[0]!.title, "One");
  assert.equal(typeof stack[0]!.id, "number");
});

test("close resolves the promise with the value and takes the request off the stack", async () => {
  const state = createDialogState();
  const result = state.open(options("One"));
  state.close(state.get()[0]!.id, "done");
  assert.equal(await result, "done");
  assert.deepEqual(state.get(), []);
});

test("dismiss resolves null", async () => {
  const state = createDialogState();
  const result = state.open(options("One"));
  state.dismiss(state.get()[0]!.id);
  assert.equal(await result, null);
});

test("a second dialog sits over the first, which stays on the stack", async () => {
  const state = createDialogState();
  const first = state.open(options("First"));
  const second = state.open(options("Second"));
  assert.deepEqual(state.get().map((r: DialogRequest) => r.title), ["First", "Second"]);
  assert.equal(state.top()?.title, "Second");
  state.close(state.get()[1]!.id, "b");
  assert.equal(await second, "b");
  assert.equal(state.top()?.title, "First");
  state.close(state.get()[0]!.id, "a");
  assert.equal(await first, "a");
  assert.equal(state.top(), null);
});

test("closing something that is not open does nothing", () => {
  const state = createDialogState();
  assert.doesNotThrow(() => state.close(999, "x"));
  assert.deepEqual(state.get(), []);
});

test("a request settles only once", async () => {
  const state = createDialogState();
  const result = state.open(options("One"));
  const { id } = state.get()[0]!;
  state.close(id, "first");
  state.close(id, "second");
  assert.equal(await result, "first");
});

test("modalOpen is true while any dialog is open, which is when the page body is locked", () => {
  const state = createDialogState();
  assert.equal(state.modalOpen(), false);
  void state.open(options("One"));
  assert.equal(state.modalOpen(), true);
  state.dismiss(state.get()[0]!.id);
  assert.equal(state.modalOpen(), false);
});

test("subscribers are called with the stack, and stop when they unsubscribe", () => {
  const state = createDialogState();
  const seen: number[] = [];
  const stop = state.subscribe((stack) => seen.push(stack.length));
  void state.open(options("One"));
  stop();
  void state.open(options("Two"));
  assert.deepEqual(seen, [0, 1]);
});
