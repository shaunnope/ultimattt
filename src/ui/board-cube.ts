// The Cube board: the cube itself (3D or flat), a view bar, the line count, and, after a
// scoring move, the picker for the layer turn. Marks are placed by pressing a sticker; the
// picker offers all 27 turns. Input is ignored while a turn animates.

import type { Axis, CubeHint, CubeRotate, HintSet, Mark, Move } from "../core/types.ts";
import { cubeLines } from "../core/cube.ts";
import type { CubeState } from "../core/cube.ts";
import { FACE_NAMES, layerName, rotationLabel } from "./cube-labels.ts";
import { createCubeView } from "./cube-view.ts";
import { markGlyph } from "./glyph.ts";
import { h } from "./ui.ts";

export interface CubeBoardOptions {
  onMove(move: Move): void;
  /** A replay shows the cube but never offers the layer picker. */
  readOnly?: boolean;
  /** In a two-device game only the player whose turn it is gets the layer picker. */
  mayMove?: (state: CubeState) => boolean;
  glyph?: (mark: Mark) => string;
}

export interface CubeBoardView {
  element: HTMLElement;
  update(state: CubeState): void;
  setHints(hints: HintSet<CubeHint>): void;
}

const SHORT: Record<number, string> = { 0: "Top", 1: "Bottom", 2: "Front", 3: "Back", 4: "Left", 5: "Right" };
const WAY_TEXT: Record<Axis, [string, string]> = { x: ["Up", "Down"], y: ["Left", "Right"], z: ["Clockwise", "Anticlockwise"] };
// Rows in the picker, in a natural reading order for each axis.
const PICKER: { axis: Axis; title: string; layers: (0 | 1 | 2)[] }[] = [
  { axis: "y", title: "Layers across the cube (turn sideways)", layers: [2, 1, 0] },
  { axis: "x", title: "Layers down the cube (turn up or down)", layers: [0, 1, 2] },
  { axis: "z", title: "Layers front to back (turn like a wheel)", layers: [2, 1, 0] },
];

export function createCubeBoard(opts: CubeBoardOptions): CubeBoardView {
  const glyph = opts.glyph ?? markGlyph;
  const view = createCubeView({
    glyph,
    onSticker: (face, cell) => opts.onMove({ t: "place", face, cell }),
  });
  const score = h("div", { id: "cube-score", class: "cube-score", "aria-live": "polite" }, "X: 0 · O: 0");

  // ---- view bar ----
  const faceButtons = FACE_NAMES.map((name, face) =>
    h("button", { type: "button", class: "btn btn-small", "aria-label": `Show ${name} face`, onclick: () => view.showFace(face) }, SHORT[face]),
  );
  const flatToggle = h("button", { type: "button", class: "btn btn-small", "aria-pressed": String(view.flat) }, "Flat view");
  const refreshToggle = () => {
    flatToggle.setAttribute("aria-pressed", String(view.flat));
    faceButtons.forEach((b) => (b.hidden = view.flat));
  };
  flatToggle.addEventListener("click", () => {
    view.setFlat(!view.flat);
    refreshToggle();
  });
  if (!view.supports3D) flatToggle.disabled = true;
  faceButtons.forEach((b) => (b.hidden = view.flat));
  const viewBar = h("div", { class: "cube-viewbar", role: "group", "aria-label": "View" }, ...faceButtons, flatToggle);

  // ---- layer picker ----
  const rotationButtons: HTMLButtonElement[] = [];
  const picker = h("div", { class: "rotate-picker", role: "group", "aria-label": "Turn a layer", hidden: true });
  for (const section of PICKER) {
    const group = h("div", { class: "rotate-section" }, h("h3", null, section.title));
    for (const layer of section.layers) {
      const row = h("div", { class: "rotate-row" }, h("span", { class: "rotate-name" }, `${layerName(section.axis, layer)} layer`));
      const options: { rotation: CubeRotate; text: string }[] = [
        { rotation: { t: "rotate", axis: section.axis, layer, dir: -1 }, text: WAY_TEXT[section.axis][0] },
        { rotation: { t: "rotate", axis: section.axis, layer, dir: 1 }, text: WAY_TEXT[section.axis][1] },
        { rotation: { t: "rotate", axis: section.axis, layer, dir: 2 }, text: "Half" },
      ];
      for (const { rotation, text } of options) {
        const button = h("button", { type: "button", class: "btn btn-small", "aria-label": rotationLabel(rotation) }, text);
        button.addEventListener("click", () => {
          if (view.busy) return;
          view.preview(section.axis, null);
          opts.onMove(rotation);
        });
        const show = () => view.preview(section.axis, layer);
        const hide = () => view.preview(section.axis, null);
        button.addEventListener("pointerenter", show);
        button.addEventListener("focus", show);
        button.addEventListener("pointerleave", hide);
        button.addEventListener("blur", hide);
        rotationButtons.push(button);
        row.append(button);
      }
      group.append(row);
    }
    picker.append(group);
  }

  const element = h("div", { class: "cube-board" }, score, viewBar, view.element, picker);

  let last: CubeState | null = null;
  let generation = 0;

  function show(state: CubeState): void {
    view.update(state.stickers, cubeLines(state.stickers));
    score.textContent = `${markGlyph("X")}: ${state.lines.X} · ${markGlyph("O")}: ${state.lines.O}`;
    const rotating = state.phase === "rotate" && state.status === "playing" && !opts.readOnly && (opts.mayMove?.(state) ?? true);
    picker.hidden = !rotating;
    element.dataset.phase = rotating ? "rotate" : "place";
  }

  return {
    element,
    setHints(hints) {
      view.setHints(hints.win.map((h) => h.face * 9 + h.cell), hints.block.map((h) => h.face * 9 + h.cell));
    },
    update(state) {
      const previous = last;
      last = state;
      generation++;
      const mine = generation;
      view.settle();
      const lastMove = state.moves[state.moves.length - 1];
      const animate = previous !== null && state.moves.length === previous.moves.length + 1 && lastMove?.t === "rotate";
      if (!animate) {
        show(state);
        return;
      }
      // The turn was just chosen: hide the picker at once, animate, then show the new marks.
      picker.hidden = true;
      void view.playRotation(lastMove as CubeRotate, () => {
        if (mine === generation) show(state);
      });
    },
  };
}
