// The Cube board: the cube itself (3D or flat), a view bar, the line count, and, after a scoring move, the layer-turn
// picker. Marks are placed by pressing a sticker. Turning a layer is select → preview → confirm: pressing a turn button
// animates the layer to its new position and holds it there; Confirm makes the move; pressing outside the cube and the
// controls, or Escape, turns it back and leaves the turn pending. The rules of that flow are the pure state machine in
// core/turn-selection.ts; this file only animates what it asks for. Input is ignored while a turn animates.

import type { Axis, CubeHint, CubeRotate, HintSet, Move } from "../core/types.ts";
import { cubeLines, lockedFaces } from "../core/cube.ts";
import type { CubeState } from "../core/cube.ts";
import { layerLabel, layerPhrase, turnName, turnsFor, type NotationStyle } from "../core/notation.ts";
import { IDLE, step, type TurnEvent, type TurnSelection } from "../core/turn-selection.ts";
import { FACE_NAMES, rotationLabel, scoreLabel } from "./cube-labels.ts";
import { createCubeView } from "./cube-view.ts";
import { icon, type IconName } from "./icons.ts";
import { h } from "./ui.ts";

export interface CubeBoardOptions {
  size: number;
  onMove(move: Move): void;
  /** A replay shows the cube but never offers the layer picker. */
  readOnly?: boolean;
  /** In a two-device game only the player whose turn it is gets the layer picker. */
  mayMove?: (state: CubeState) => boolean;
  /** How turns are named on the buttons and in captions. Display only. */
  notation?: NotationStyle;
}

export interface CubeBoardView {
  element: HTMLElement;
  update(state: CubeState): void;
  setHints(hints: HintSet<CubeHint>): void;
  /** Change how turns are named, without touching the game. */
  setNotation(style: NotationStyle): void;
  /** Drop any preview at once (undo, a new game, leaving the screen). The turn stays pending. */
  reset(): void;
}

const SHORT: Record<number, string> = { 0: "Top", 1: "Bottom", 2: "Front", 3: "Back", 4: "Left", 5: "Right" };
const SECTION_TITLES: Record<Axis, string> = {
  y: "Layers across the cube (turn sideways)",
  x: "Layers down the cube (turn up or down)",
  z: "Layers front to back (turn like a wheel)",
};
const SECTION_ORDER: Axis[] = ["y", "x", "z"];

/** The icon for a turn button: up and down (x axis), left and right (y axis), curved arrows (z axis), and a half turn. */
export function turnIcon(rotation: CubeRotate): IconName {
  if (rotation.dir === 2) return "turn-half";
  const back = rotation.dir === -1;
  if (rotation.axis === "x") return back ? "turn-up" : "turn-down";
  if (rotation.axis === "y") return back ? "turn-left" : "turn-right";
  return back ? "turn-clockwise" : "turn-anticlockwise";
}

const sameTurn = (a: CubeRotate | null, b: CubeRotate): boolean => a !== null && a.axis === b.axis && a.layer === b.layer && a.dir === b.dir;

export function createCubeBoard(opts: CubeBoardOptions): CubeBoardView {
  const size = opts.size;
  let notation: NotationStyle = opts.notation ?? "words";
  const view = createCubeView({ size, onSticker: (face, cell) => opts.onMove({ t: "place", face, cell }) });
  const score = h("div", { id: "cube-score", class: "cube-score", "aria-live": "polite" }, `${scoreLabel("lines")} · X: 0 · O: 0`);

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
  const picker = h("div", { class: "rotate-picker", role: "group", "aria-label": "Turn a layer", hidden: true });
  const caption = h("p", { class: "turn-caption", id: "turn-caption", "aria-live": "polite" });
  const confirm = h("button", { type: "button", class: "btn btn-primary", id: "turn-confirm", disabled: true }, "Confirm turn");
  const picked = new Map<string, HTMLButtonElement>();
  const turnKey = (r: CubeRotate) => `${r.axis}${r.layer}${r.dir}`;

  function buildPicker(): void {
    picked.clear();
    const rows = new Map<Axis, Map<number, CubeRotate[]>>();
    for (const turn of turnsFor(size)) {
      const layers = rows.get(turn.axis) ?? new Map<number, CubeRotate[]>();
      layers.set(turn.layer, [...(layers.get(turn.layer) ?? []), turn]);
      rows.set(turn.axis, layers);
    }
    const sections: HTMLElement[] = [];
    for (const axis of SECTION_ORDER) {
      const group = h("div", { class: "rotate-section" }, h("h3", null, SECTION_TITLES[axis]));
      for (const [layer, turns] of rows.get(axis)!) {
        const name = notation === "cube" ? layerLabel(axis, layer, size, "cube") : capitalise(layerPhrase(axis, layer, size));
        const nameEl = h("span", { class: "rotate-name" }, name);
        const row = h("div", { class: "rotate-row", "data-axis": axis, "data-layer": layer }, nameEl);
        watchLayer(row, nameEl, axis, layer);
        for (const turn of turns) {
          const label = rotationLabel(turn, size);
          const button = h("button", {
            type: "button",
            class: `btn btn-small turn-btn${notation === "cube" ? " turn-text" : " turn-icon"}`,
            "aria-label": label,
            "aria-pressed": "false",
            title: label,
            "data-turn": turnKey(turn),
          });
          if (notation === "cube") button.append(h("span", { "aria-hidden": "true" }, turnName(turn, size, "cube")));
          else button.append(icon(turnIcon(turn)));
          button.addEventListener("click", () => dispatch({ type: "select", rotation: turn }));
          picked.set(turnKey(turn), button);
          row.append(button);
        }
        group.append(row);
      }
      sections.push(group);
    }
    picker.replaceChildren(...sections, h("div", { class: "turn-actions" }, caption, confirm));
    paintSelection();
  }

  // ---- the layer highlight (contracts/ui-contracts.md): a tapped name (touch), else hover or focus, else the held preview ----
  type LayerRef = { axis: Axis; layer: number };
  let hovered: LayerRef | null = null;
  let focused: LayerRef | null = null;
  let tapped: LayerRef | null = null;
  /** The pointer type of the last press on a layer name, so only a touch tap sticks. */
  let lastPointer = "mouse";

  const canHover = (): boolean => typeof matchMedia !== "function" || matchMedia("(hover: hover)").matches;

  function refreshOutline(): void {
    const held = selection.status === "idle" ? null : { axis: selection.rotation.axis, layer: selection.rotation.layer };
    // A tap is a deliberate act on a touch screen, where a stray "hover" can linger from a fake mouse move; it comes first.
    const shown = tapped ?? hovered ?? focused ?? held;
    view.outline(shown?.axis ?? "y", shown?.layer ?? null);
  }

  function watchLayer(row: HTMLElement, nameEl: HTMLElement, axis: Axis, layer: number): void {
    const ref: LayerRef = { axis, layer };
    row.addEventListener("pointerenter", (e) => {
      // A touch screen has no hover (and fakes a mouse move after the layout changes under a finger): a tap on the
      // name highlights instead.
      if (e.pointerType === "touch" || !canHover()) return;
      hovered = ref;
      refreshOutline();
    });
    row.addEventListener("pointerleave", () => {
      if (hovered !== ref) return;
      hovered = null;
      refreshOutline();
    });
    row.addEventListener("focusin", (e) => {
      // Only keyboard focus highlights: a mouse click leaves focus on the button, which must not hold the outline.
      if (!(e.target as Element).matches(":focus-visible")) return;
      focused = ref;
      refreshOutline();
    });
    row.addEventListener("focusout", () => {
      if (focused !== ref) return;
      focused = null;
      refreshOutline();
    });
    row.addEventListener("pointerdown", (e) => {
      lastPointer = e.pointerType;
      if (e.pointerType === "mouse" && tapped) {
        tapped = null; // the mouse took over from the touch screen
        refreshOutline();
      }
    });
    nameEl.addEventListener("click", () => {
      if (lastPointer === "mouse") return;
      tapped = ref;
      refreshOutline();
    });
  }

  const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  // ---- the turn flow ----
  let selection: TurnSelection = IDLE;
  /** Bumped whenever a flow ends early, so an animation that finishes late cannot move the machine on. */
  let epoch = 0;
  /** A confirmed turn whose result has not arrived yet: its animation has already been shown. */
  let committed: CubeRotate | null = null;

  function paintSelection(): void {
    const shown = selection.status === "idle" ? null : selection.rotation;
    const settled = selection.status === "previewing" ? selection.rotation : null;
    for (const [key, button] of picked) button.setAttribute("aria-pressed", String(shown !== null && key === turnKey(shown) && selection.status !== "idle" && !(selection.status === "animating" && selection.phase === "reverse" && selection.queued === null)));
    confirm.disabled = settled === null;
    caption.textContent = settled
      ? `Previewing: ${turnName(settled, size, notation)}. Confirm to make this turn, or click outside to cancel.`
      : selection.status === "animating"
        ? ""
        : "Choose a turn to preview it, then confirm.";
  }

  function dispatch(event: TurnEvent): void {
    const out = step(selection, event);
    selection = out.state;
    if (event.type === "cancel" || event.type === "confirm" || event.type === "reset") tapped = null;
    const mine = epoch;
    for (const effect of out.effects) {
      if (effect.kind === "play") void view.previewTurn(effect.rotation).then(() => mine === epoch && dispatch({ type: "done" }));
      else if (effect.kind === "retarget") void view.retargetTurn(effect.from, effect.to).then(() => mine === epoch && dispatch({ type: "done" }));
      else if (effect.kind === "reverse") void view.cancelPreview().then(() => mine === epoch && dispatch({ type: "done" }));
      else if (effect.kind === "discard") {
        epoch++;
        view.discardPreview();
      } else {
        committed = effect.rotation;
        view.commitPreview(() => opts.onMove(effect.rotation));
      }
    }
    paintSelection();
    refreshOutline();
  }

  confirm.addEventListener("click", () => dispatch({ type: "confirm" }));

  // Pressing anywhere that is not the cube, the picker or a control cancels a preview; Escape does too.
  const INTERACTIVE = "button, a[href], input, select, textarea, label, summary, dialog, [role='button'], [role='dialog']";
  /** A board that has been replaced on the page stops listening. */
  let wasConnected = false;
  const gone = (): boolean => {
    if (element.isConnected) {
      wasConnected = true;
      return false;
    }
    if (wasConnected) {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    }
    return true;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (gone() || selection.status !== "previewing") return;
    const target = e.target as Element | null;
    if (!target || !target.closest) return;
    if (view.element.contains(target) || picker.contains(target) || target.closest(INTERACTIVE)) return;
    dispatch({ type: "cancel" });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (gone() || e.key !== "Escape" || selection.status !== "previewing") return;
    e.stopPropagation();
    dispatch({ type: "cancel" });
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  const element = h("div", { class: "cube-board", "data-size": size }, score, viewBar, view.element, picker);

  buildPicker();

  let last: CubeState | null = null;
  let generation = 0;

  function show(state: CubeState, fresh?: number): void {
    view.update(state.stickers, cubeLines(state.stickers, size, state.config.winLength), fresh);
    view.setLocked(state.config.lockFaces ? lockedFaces(state.stickers, size, state.config.winLength) : []);
    score.textContent = `${scoreLabel(state.config.scoring)} · X: ${state.scores.X} · O: ${state.scores.O}`;
    const rotating = state.phase === "rotate" && state.status === "playing" && !opts.readOnly && (opts.mayMove?.(state) ?? true);
    picker.hidden = !rotating;
    element.dataset.phase = rotating ? "rotate" : "place";
    if (!rotating) {
      hovered = focused = tapped = null;
      if (selection.status !== "idle") {
        selection = step(selection, { type: "reset" }).state;
        epoch++;
        view.discardPreview();
        paintSelection();
      }
      refreshOutline();
    }
  }

  return {
    element,
    setHints(hints) {
      const n2 = size * size;
      view.setHints(hints.win.map((x) => x.face * n2 + x.cell), hints.block.map((x) => x.face * n2 + x.cell));
    },
    setNotation(style) {
      if (style === notation) return;
      notation = style;
      buildPicker();
    },
    reset() {
      dispatch({ type: "reset" });
    },
    update(state) {
      const previous = last;
      last = state;
      generation++;
      const mine = generation;
      view.settle();
      const lastMove = state.moves[state.moves.length - 1];
      const grew = previous !== null && state.moves.length === previous.moves.length + 1;
      // Any position that is not simply "the turn I just confirmed" drops a preview.
      if (!(grew && lastMove?.t === "rotate" && sameTurn(committed, lastMove as CubeRotate)) && selection.status !== "idle") {
        dispatch({ type: "reset" });
      }
      const justConfirmed = grew && lastMove?.t === "rotate" && sameTurn(committed, lastMove as CubeRotate);
      if (justConfirmed) committed = null;
      const placed = lastMove as unknown as { t: string; face: number; cell: number } | undefined;
      const fresh = grew && placed?.t === "place" ? placed.face * size * size + placed.cell : undefined;
      const animate = grew && lastMove?.t === "rotate" && !justConfirmed;
      if (!animate) {
        show(state, fresh);
        return;
      }
      // The turn was made on the other device (or replayed): hide the picker at once, animate, then show the new marks.
      picker.hidden = true;
      void view.playRotation(lastMove as CubeRotate, () => {
        if (mine === generation) show(state);
      });
    },
  };
}
