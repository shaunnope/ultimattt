// The mark colour choice in Settings: a list of the fixed palettes, one selected, each with a live X and O sample.
// There is no colour input: players pick from the ready-made pairs, so every choice is readable and distinct
// (proved once in tests/unit/palette.test.ts). Samples show both the light and dark variant through CSS custom
// properties, so switching appearance needs no redraw.

import { PALETTES, type Palette } from "../core/palette.ts";
import { icon } from "./icons.ts";
import { createMark } from "./mark.ts";
import { h } from "./ui.ts";

function sample(palette: Palette): HTMLElement {
  const el = h("span", { class: "palette-sample", "aria-hidden": "true" }, createMark("X"), createMark("O"));
  el.style.setProperty("--sample-x-light", palette.X.light);
  el.style.setProperty("--sample-x-dark", palette.X.dark);
  el.style.setProperty("--sample-o-light", palette.O.light);
  el.style.setProperty("--sample-o-dark", palette.O.dark);
  return el;
}

/** A radio group of the palettes. `onChange` gets the chosen palette's id. */
export function createPalettePicker(current: string, onChange: (id: string) => void): HTMLFieldSetElement {
  const grid = h("div", { class: "choice-grid palette-grid" });
  for (const palette of PALETTES) {
    const id = `palette-${palette.id}`;
    const input = h("input", { type: "radio", name: "mark-palette", id, value: palette.id, checked: palette.id === current });
    input.addEventListener("change", () => {
      mark(palette.id);
      onChange(palette.id);
    });
    grid.append(h("div", { class: "choice", "data-palette": palette.id }, input, h("label", { for: id }, h("strong", null, palette.label), sample(palette))));
  }
  /** The chosen row carries a check icon and the word "Selected", so the choice is not shown by colour alone. */
  function mark(chosen: string): void {
    grid.querySelectorAll(".selected-mark").forEach((el) => el.remove());
    grid.querySelector(`[data-palette="${chosen}"] label`)?.append(h("span", { class: "selected-mark" }, icon("check"), "Selected"));
  }
  mark(current);
  return h("fieldset", { class: "palette-picker", "data-group": "mark-palette" }, h("legend", null, "Mark colours (on this device only)"), grid);
}
