// The cube on screen. One button per sticker (54), shown either as a 3D cube made with CSS 3D
// transforms (drag, arrow keys or the face buttons turn the view) or as a flat unfolded net.
// Layer turns animate in 3D by turning the layer's stickers about the cube's centre.
// The view knows nothing about rules: it draws what it is told and reports sticker presses.

import type { Axis, Cell, CubeRotate, Mark } from "../core/types.ts";
import { markOf } from "../core/types.ts";
import type { CubeLine } from "../core/cube.ts";
import { layerStickers } from "../core/cube.ts";
import { FACE_NAMES, faceViewAngles, frontFace } from "./cube-labels.ts";
import { markGlyph } from "./glyph.ts";
import { h } from "./ui.ts";

export interface CubeViewOptions {
  onSticker(face: number, cell: number): void;
  glyph?: (mark: Mark) => string;
}

export interface CubeView {
  element: HTMLElement;
  /** True when the browser can draw the 3D cube */
  supports3D: boolean;
  readonly flat: boolean;
  readonly busy: boolean;
  setFlat(flat: boolean): void;
  showFace(face: number): void;
  /** Redraw the marks. */
  update(stickers: readonly Cell[], lines: readonly CubeLine[]): void;
  /** Animate a layer turn, then call `commit` to put the new marks in place. */
  playRotation(rotation: CubeRotate, commit: () => void): Promise<void>;
  /** Point out winning stickers (a dot) and stickers to block (a dashed ring). */
  setHints(win: readonly number[], block: readonly number[]): void;
  /** Outline the stickers of a layer (null clears). */
  preview(axis: Axis, layer: 0 | 1 | 2 | null): void;
  /** Cancel an animation and settle immediately. */
  settle(): void;
}

// Each face drawn flat on the net, as 1-based [column, row] of its top-left sticker. Matches the original game's cross.
const NET: [number, number][] = [[4, 1], [4, 7], [4, 4], [10, 4], [1, 4], [7, 4]]; // U D F B L R
const FACE_TRANSFORM = ["rotateX(90deg)", "rotateX(-90deg)", "rotateY(0deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateY(90deg)"];
// A +90° turn of the model, as the CSS rotation that does the same on screen (CSS y points down).
const TURN_CSS: Record<Axis, (quarters: number) => string> = {
  x: (q) => `rotateX(${-90 * q}deg)`,
  y: (q) => `rotateY(${90 * q}deg)`,
  z: (q) => `rotateZ(${-90 * q}deg)`,
};
const ANIMATION_MS = 340;
const INITIAL_VIEW = { rx: -25, ry: -30 };

function supports3D(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("transform-style", "preserve-3d");
  } catch {
    return false;
  }
}

const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createCubeView(opts: CubeViewOptions): CubeView {
  const glyph = opts.glyph ?? markGlyph;
  const can3D = supports3D();
  const buttons: HTMLButtonElement[] = [];
  const roving = [4, 4, 4, 4, 4, 4]; // the sticker of each face that is the tab stop
  let flat = !can3D;
  let view = { ...INITIAL_VIEW };
  let busy = false;
  let finish: (() => void) | null = null;

  const describe = (i: number, value: Cell) => {
    const face = Math.floor(i / 9);
    const cell = i % 9;
    return `${FACE_NAMES[face]} face, row ${Math.floor(cell / 3) + 1}, column ${(cell % 3) + 1}, ${value === 0 ? "empty" : glyph(markOf(value))}`;
  };

  for (let i = 0; i < 54; i++) {
    const face = Math.floor(i / 9);
    const cell = i % 9;
    const r = Math.floor(cell / 3);
    const c = cell % 3;
    const button = h("button", { type: "button", class: "sticker", "data-face": face, "data-cell": cell, "aria-label": describe(i, 0), tabindex: -1 });
    button.style.setProperty("--face", FACE_TRANSFORM[face]!);
    button.style.setProperty("--dx", String(c - 1));
    button.style.setProperty("--dy", String(r - 1));
    button.style.setProperty("--fc", String(NET[face]![0] + c));
    button.style.setProperty("--fr", String(NET[face]![1] + r));
    button.addEventListener("click", () => {
      if (busy) return;
      roving[face] = cell;
      opts.onSticker(face, cell);
    });
    button.addEventListener("keydown", (e) => {
      const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      const nr = Math.min(2, Math.max(0, r + d[0]));
      const nc = Math.min(2, Math.max(0, c + d[1]));
      roving[face] = nr * 3 + nc;
      applyTabStops();
      buttons[face * 9 + nr * 3 + nc]!.focus();
    });
    buttons.push(button);
  }

  const scene = h("div", {
    class: "cube-scene",
    role: "group",
    tabindex: 0,
    "aria-label": "Cube, 3D view. Arrow keys turn the view; Shift with an arrow turns it a quarter.",
  });
  const flatBoard = h("div", { class: "cube-flat", role: "group", "aria-label": "Cube, flat view" });
  const faceGroups = FACE_NAMES.map((name) => h("div", { class: "cube-flat-face", role: "group", "aria-label": `${name} face` }));
  faceGroups.forEach((g) => flatBoard.append(g));
  const stage = h("div", { class: "cube-stage" });

  function applyView(snap = false): void {
    scene.style.setProperty("--rx", `${view.rx}deg`);
    scene.style.setProperty("--ry", `${view.ry}deg`);
    scene.dataset.view = `${view.rx} ${view.ry}`;
    scene.classList.toggle("snap", snap);
    applyTabStops();
  }

  function applyTabStops(): void {
    const front = flat ? -1 : frontFace(view.rx, view.ry);
    buttons.forEach((b, i) => {
      const face = Math.floor(i / 9);
      const stop = (flat || face === front) && i % 9 === roving[face];
      b.setAttribute("tabindex", stop ? "0" : "-1");
    });
  }

  function mount(): void {
    if (flat) {
      buttons.forEach((b, i) => faceGroups[Math.floor(i / 9)]!.append(b));
      stage.replaceChildren(flatBoard);
    } else {
      scene.replaceChildren(...buttons);
      stage.replaceChildren(scene);
    }
    stage.dataset.mode = flat ? "flat" : "3d";
    applyView();
  }

  // ---- turning the view: drag, keys ----
  let drag: { x: number; y: number; id: number; moved: boolean } | null = null;
  let suppressClick = false;
  scene.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  });
  scene.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      scene.setPointerCapture(e.pointerId);
      scene.classList.add("dragging");
    }
    view = { rx: Math.max(-90, Math.min(90, view.rx - dy * 0.5)), ry: view.ry + dx * 0.5 };
    drag.x = e.clientX;
    drag.y = e.clientY;
    applyView();
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      scene.releasePointerCapture?.(e.pointerId);
    }
    scene.classList.remove("dragging");
    drag = null;
  };
  scene.addEventListener("pointerup", endDrag);
  scene.addEventListener("pointercancel", endDrag);
  scene.addEventListener("click", (e) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  scene.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 90 : 15;
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, step], ArrowRight: [0, -step], ArrowUp: [step, 0], ArrowDown: [-step, 0] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    view = { rx: Math.max(-90, Math.min(90, view.rx + m[0])), ry: view.ry + m[1] };
    applyView(true);
  });

  const api: CubeView = {
    element: stage,
    supports3D: can3D,
    get flat() {
      return flat;
    },
    get busy() {
      return busy;
    },
    setFlat(value) {
      if (value === flat || (!value && !can3D)) return;
      api.settle();
      flat = value;
      mount();
    },
    showFace(face) {
      if (flat) {
        buttons[face * 9 + roving[face]!]?.focus();
        return;
      }
      view = faceViewAngles(face);
      applyView(true);
    },
    update(stickers, lines) {
      const inLine = new Map<number, Mark>();
      for (const line of lines) for (const c of line.cells) inLine.set(line.face * 9 + c, line.owner);
      buttons.forEach((b, i) => {
        const value = stickers[i] as Cell;
        const text = value === 0 ? "" : glyph(markOf(value));
        if (b.textContent !== text) b.replaceChildren(...(value === 0 ? [] : [h("span", { class: `mark mark-${markOf(value).toLowerCase()}`, "aria-hidden": "true" }, text)]));
        b.setAttribute("aria-label", describe(i, value));
        b.dataset.mark = value === 0 ? "" : markOf(value);
        const owner = inLine.get(i);
        if (owner) b.dataset.line = owner;
        else delete b.dataset.line;
      });
    },
    async playRotation(rotation, commit) {
      api.settle();
      const quarters = rotation.dir === 1 ? 1 : rotation.dir === -1 ? -1 : 2;
      const layer = layerStickers(rotation.axis, rotation.layer).map((i) => buttons[i]!);
      if (!flat && reducedMotion()) {
        commit();
        return;
      }
      const wait = (ms: number) =>
        new Promise<void>((resolve) => {
          finish = resolve;
          setTimeout(resolve, ms);
        });
      busy = true;
      stage.dataset.busy = "true";
      if (flat) {
        layer.forEach((b) => b.classList.add("flash"));
        await wait(220);
        layer.forEach((b) => b.classList.remove("flash"));
      } else {
        layer.forEach((b) => b.style.setProperty("--turn", TURN_CSS[rotation.axis](quarters)));
        await wait(ANIMATION_MS + 40);
        // Put the stickers back where they were with no transition, then show the new marks.
        scene.classList.add("no-anim");
        layer.forEach((b) => b.style.removeProperty("--turn"));
      }
      commit();
      if (!flat) {
        void scene.offsetWidth;
        scene.classList.remove("no-anim");
      }
      busy = false;
      finish = null;
      delete stage.dataset.busy;
    },
    setHints(win, block) {
      buttons.forEach((b) => b.removeAttribute("data-hint"));
      for (const i of block) buttons[i]?.setAttribute("data-hint", "block");
      for (const i of win) buttons[i]?.setAttribute("data-hint", "win");
    },
    preview(axis, layer) {
      buttons.forEach((b) => b.removeAttribute("data-preview"));
      if (layer === null) return;
      for (const i of layerStickers(axis, layer)) buttons[i]!.setAttribute("data-preview", "true");
    },
    settle() {
      finish?.();
    },
  };

  mount();
  return api;
}
