// Settings: hints, automatic replay, mark colours and how Cube turns are named. Appearance has its own dialog
// (theme-modal.ts). Changes apply at once and are remembered on this device. Colours and turn names are display preferences: they never reach a game, a
// seed, a link or the network.

import type { CubeNotation, Settings } from "../core/settings.ts";
import { loadSave, updateSettings } from "../adapters/store.ts";
import { createPalettePicker } from "./palette-picker.ts";
import { applyMarkPalette, applyMode, themeToMode } from "./theme.ts";
import { h, openDialog } from "./ui.ts";

export const SETTINGS_EVENT = "ttt:settings";

/** Put settings into effect: colours and appearance now, and tell the screen to redraw. */
export function applySettings(settings: Settings): void {
  applyMarkPalette(settings.markPalette);
  applyMode(themeToMode(settings.theme));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = h("input", { type: "checkbox", checked });
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", { class: "check" }, input, h("span", null, label));
}

export async function openSettings(): Promise<void> {
  const settings = loadSave().save.settings;
  const change = (patch: Partial<Settings>) => {
    updateSettings(patch);
    applySettings(loadSave().save.settings);
  };

  const notationSelect = h("select", { id: "notation-select" },
    h("option", { value: "words", selected: settings.cubeNotation === "words" }, "Arrows and words"),
    h("option", { value: "cube", selected: settings.cubeNotation === "cube" }, "Cube notation (R, U', F2, 2L)"));
  notationSelect.addEventListener("change", () => change({ cubeNotation: notationSelect.value as CubeNotation }));

  await openDialog({
    title: "Settings",
    body: [
      checkbox("Show hints", settings.hints, (hints) => change({ hints })),
      h("p", { class: "hint-text" }, "Marks the cells that win for you (a dot) and the cells you must block (a dashed ring) on your turn."),
      checkbox("Replay a finished game automatically", settings.autoReplay, (autoReplay) => change({ autoReplay })),
      createPalettePicker(settings.markPalette, (markPalette) => change({ markPalette })),
      h("label", { class: "field" }, "Twist turn names", notationSelect),
    ],
    actions: [{ label: "Done", value: "done", primary: true }],
  });
}
