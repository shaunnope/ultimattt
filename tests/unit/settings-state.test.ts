import { test } from "node:test";
import assert from "node:assert/strict";
import { createSettingsState } from "../../src/lib/state/settings.ts";
import { DEFAULT_SETTINGS, type Settings } from "../../src/core/settings.ts";

// The settings the screens share: read through the saved game, written through updateSettings, put into effect (colours,
// appearance) and announced to whoever is watching. Built with its parts passed in, so it runs in node.

function setup(initial: Settings = { ...DEFAULT_SETTINGS }) {
  let saved = initial;
  const calls: string[] = [];
  const state = createSettingsState({
    load: () => saved,
    save: (patch) => {
      calls.push(`save ${JSON.stringify(patch)}`);
      saved = { ...saved, ...patch };
    },
    apply: (settings) => calls.push(`apply hints=${settings.hints}`),
  });
  return { state, calls };
}

test("a subscriber is called at once with the saved settings", () => {
  const { state } = setup({ ...DEFAULT_SETTINGS, hints: false });
  const seen: Settings[] = [];
  state.subscribe((s) => seen.push(s));
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.hints, false);
});

test("update saves the change, puts the new settings into effect, then tells subscribers", () => {
  const { state, calls } = setup({ ...DEFAULT_SETTINGS, hints: false });
  const seen: boolean[] = [];
  state.subscribe((s) => seen.push(s.hints));
  state.update({ hints: true });
  assert.deepEqual(calls, ['save {"hints":true}', "apply hints=true"]);
  assert.deepEqual(seen, [false, true]);
});

test("apply puts the saved settings into effect without saving anything", () => {
  const { state, calls } = setup({ ...DEFAULT_SETTINGS, hints: true });
  state.apply();
  assert.deepEqual(calls, ["apply hints=true"]);
});

test("unsubscribing stops the calls", () => {
  const { state } = setup();
  let calls = 0;
  const stop = state.subscribe(() => calls++);
  stop();
  state.update({ hints: false });
  assert.equal(calls, 1);
});

test("get returns the latest settings", () => {
  const { state } = setup({ ...DEFAULT_SETTINGS, autoReplay: false });
  state.update({ autoReplay: true });
  assert.equal(state.get().autoReplay, true);
});
