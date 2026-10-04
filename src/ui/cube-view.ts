// The cube on screen. One button per sticker (6·N²), shown either as a 3D cube made with CSS 3D
// transforms (drag, arrow keys or the face buttons turn the view) or as a flat unfolded net.
// Layer turns animate in 3D by turning the layer's stickers about the cube's centre. A turn can also be previewed:
// the layer turns and stays turned until the preview is cancelled (it turns back) or committed (the new marks replace
// it with no replay). In the flat view there is no 3D motion, so a preview shows the marks as they would be after the
// turn, dashed. The view knows nothing about rules: it draws what it is told and reports sticker presses.

import type { Axis, Cell, CubeRotate } from "../core/types.ts";
import { markOf } from "../core/types.ts";
import type { CubeLine } from "../core/cube.ts";
import { layerStickers, rotateStickers } from "../core/cube.ts";
import { settleAngle, targetAngle, type Quarters } from "../core/turn-path.ts";
import { FACE_NAMES, faceInView, faceViewAngles, frontFace } from "./cube-labels.ts";
import { createMark, markName } from "./mark.ts";
import { h } from "./ui.ts";

export interface CubeViewOptions {
  size: number;
  onSticker(face: number, cell: number): void;
}

export interface CubeView {
  element: HTMLElement;
  /** True when the browser can draw the 3D cube */
  supports3D: boolean;
  readonly flat: boolean;
  /** True while a layer is animating */
  readonly busy: boolean;
  /** The turn currently shown as a preview, or null */
  readonly previewing: CubeRotate | null;
  setFlat(flat: boolean): void;
  showFace(face: number): void;
  /** Whether a face can be read from the current view (always true in the flat view). */
  isInView(face: number): boolean;
  /** Turn the view to bring a face to the front, taking about `ms`, and resolve when it has arrived. Does nothing in the
   *  flat view; with reduced motion the view changes at once. */
  turnToFace(face: number, ms: number): Promise<void>;
  /** Redraw the marks. `fresh` is the sticker that was just placed, whose mark draws itself in. */
  update(stickers: readonly Cell[], lines: readonly CubeLine[], fresh?: number): void;
  /** Animate a layer turn, then call `commit` to put the new marks in place. */
  playRotation(rotation: CubeRotate, commit: () => void): Promise<void>;
  /** Turn a layer to its previewed position and hold it there. Resolves when the animation has ended. */
  previewTurn(rotation: CubeRotate): Promise<void>;
  /** Swing the previewed layer straight from the turn it shows to another turn of the same layer, never back through
   *  where it started. Resolves when the animation has ended. */
  retargetTurn(from: CubeRotate, to: CubeRotate): Promise<void>;
  /** Turn the previewed layer back. Resolves when the animation has ended. */
  cancelPreview(): Promise<void>;
  /** The preview is confirmed: call `commit` to put the new marks in place, with no animation replayed. */
  commitPreview(commit: () => void): void;
  /** Drop a preview at once, with no animation. */
  discardPreview(): void;
  /** Point out winning stickers (a dot) and stickers to block (a dashed ring). */
  setHints(win: readonly number[], block: readonly number[]): void;
  /** Mark these faces as locked (lock option): a striped pattern, a "Locked" label, and empty stickers aria-disabled. */
  setLocked(faces: readonly number[]): void;
  /** Outline the stickers of a layer (null clears). */
  outline(axis: Axis, layer: number | null): void;
  /** Cancel an animation and settle immediately. */
  settle(): void;
}

const FACE_TRANSFORM = ["rotateX(90deg)", "rotateX(-90deg)", "rotateY(0deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateY(90deg)"];
// A turn of the model by `deg` (+90 per quarter), as the CSS rotation that does the same on screen (CSS y points down).
// All three axes are always listed, so a transition between any two turns interpolates each angle on its own
// (matching function lists) instead of falling back to matrix interpolation, which cannot tell 270° from -90°.
const TURN_CSS: Record<Axis, (deg: number) => string> = {
  x: (deg) => `rotateX(${-deg}deg) rotateY(0deg) rotateZ(0deg)`,
  y: (deg) => `rotateX(0deg) rotateY(${deg}deg) rotateZ(0deg)`,
  z: (deg) => `rotateX(0deg) rotateY(0deg) rotateZ(${-deg}deg)`,
};
const ANIMATION_MS = 340;
const INITIAL_VIEW = { rx: -25, ry: -30 };

/** Each face drawn flat on the net, as 1-based [column, row] of its top-left sticker (U D F B L R): the cross of the original game. */
export const netOrigin = (n: number): [number, number][] => [[n + 1, 1], [n + 1, 2 * n + 1], [n + 1, n + 1], [3 * n + 1, n + 1], [1, n + 1], [2 * n + 1, n + 1]];

const quartersOf = (rotation: CubeRotate): Quarters => (rotation.dir === 1 ? 1 : rotation.dir === -1 ? -1 : 2);

function supports3D(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("transform-style", "preserve-3d");
  } catch {
    return false;
  }
}

const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createCubeView(opts: CubeViewOptions): CubeView {
  const n = opts.size;
  const n2 = n * n;
  const can3D = supports3D();
  const buttons: HTMLButtonElement[] = [];
  const centre = Math.floor(n / 2) * n + Math.floor(n / 2);
  const roving = Array<number>(6).fill(centre); // the sticker of each face that is the tab stop
  const origin = netOrigin(n);
  let flat = !can3D;
  let view = { ...INITIAL_VIEW };
  let busy = false;
  let finish: (() => void) | null = null;
  let shown: Cell[] = Array<Cell>(6 * n2).fill(0);
  let lastStickers: readonly Cell[] = shown;
  let previewing: CubeRotate | null = null;
  /** The previewed layer's cumulative angle in degrees (+90 per quarter); 0 when no preview is held */
  let angle = 0;
  let locked: ReadonlySet<number> = new Set();

  const describe = (i: number, value: Cell) => {
    const face = Math.floor(i / n2);
    const cell = i % n2;
    const state = value === 0 ? (locked.has(face) ? "empty, locked face" : "empty") : markName(markOf(value));
    return `${FACE_NAMES[face]} face, row ${Math.floor(cell / n) + 1}, column ${(cell % n) + 1}, ${state}`;
  };

  /** One "Locked" badge per face, shown only while that face is locked. Not announced: the stickers say it. */
  const lockLabels = FACE_NAMES.map((_, face) => {
    const label = h("div", { class: "face-locked-label", "aria-hidden": "true", hidden: true }, h("span", null, "Locked"));
    label.style.setProperty("--face", FACE_TRANSFORM[face]!);
    return label;
  });

  for (let i = 0; i < 6 * n2; i++) {
    const face = Math.floor(i / n2);
    const cell = i % n2;
    const r = Math.floor(cell / n);
    const c = cell % n;
    const button = h("button", { type: "button", class: "sticker", "data-face": face, "data-cell": cell, "data-mark": "", "aria-label": describe(i, 0), tabindex: -1 });
    button.style.setProperty("--face", FACE_TRANSFORM[face]!);
    button.style.setProperty("--dx", String(c - (n - 1) / 2));
    button.style.setProperty("--dy", String(r - (n - 1) / 2));
    button.style.setProperty("--fc", String(origin[face]![0] + c));
    button.style.setProperty("--fr", String(origin[face]![1] + r));
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
      const nr = Math.min(n - 1, Math.max(0, r + d[0]));
      const nc = Math.min(n - 1, Math.max(0, c + d[1]));
      roving[face] = nr * n + nc;
      applyTabStops();
      buttons[face * n2 + nr * n + nc]!.focus();
    });
    buttons.push(button);
  }

  const scene = h("div", {
    class: "cube-scene",
    role: "group",
    tabindex: 0,
    "aria-label": "Twist, 3D view. Arrow keys turn the view; Shift with an arrow turns it a quarter.",
  });
  const flatBoard = h("div", { class: "cube-flat", role: "group", "aria-label": "Twist, flat view" });
  const faceGroups = FACE_NAMES.map((name) => h("div", { class: "cube-flat-face", role: "group", "aria-label": `${name} face` }));
  faceGroups.forEach((g) => flatBoard.append(g));
  const stage = h("div", { class: "cube-stage", style: `--n:${n}` });

  /** Redraw the lock marks: data-locked and aria-disabled on stickers, the badge on faces. */
  function applyLocks(): void {
    buttons.forEach((b, i) => {
      const face = Math.floor(i / n2);
      const isLocked = locked.has(face);
      if (isLocked) b.dataset.locked = "true";
      else delete b.dataset.locked;
      const label = describe(i, shown[i]!);
      if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
      if (isLocked && shown[i] === 0) b.setAttribute("aria-disabled", "true");
      else b.removeAttribute("aria-disabled");
    });
    lockLabels.forEach((label, face) => (label.hidden = !locked.has(face)));
  }

  function applyView(snap = false): void {
    // Set the transform itself: a changed custom property would make the browser restyle all 150 stickers.
    scene.style.transform = `rotateX(${view.rx}deg) rotateY(${view.ry}deg)`;
    scene.dataset.view = `${view.rx} ${view.ry}`;
    scene.classList.toggle("snap", snap);
    applyTabStops();
  }

  /** The tab stop is one sticker per face (all faces in the flat view, only the front one in 3D). Touching 150 buttons
   *  on every pointer move would be slow, so this only works when the front face or a roving sticker changed. */
  let stopsKey = "";
  function applyTabStops(): void {
    const front = flat ? -1 : frontFace(view.rx, view.ry);
    const key = `${front}|${roving.join(",")}`;
    if (key === stopsKey) return;
    stopsKey = key;
    buttons.forEach((b, i) => {
      const face = Math.floor(i / n2);
      const stop = (flat || face === front) && i % n2 === roving[face];
      b.setAttribute("tabindex", stop ? "0" : "-1");
    });
  }

  /** Pointer moves arrive faster than frames; apply the latest view once per frame. */
  let framePending = false;
  function applyViewSoon(): void {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      applyView();
    });
  }

  function mount(): void {
    stopsKey = "";
    if (flat) {
      buttons.forEach((b, i) => faceGroups[Math.floor(i / n2)]!.append(b));
      lockLabels.forEach((label, face) => {
        label.style.setProperty("--fc", String(origin[face]![0]));
        label.style.setProperty("--fr", String(origin[face]![1]));
        faceGroups[face]!.append(label);
      });
      stage.replaceChildren(flatBoard);
    } else {
      scene.replaceChildren(...buttons, ...lockLabels);
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
    applyViewSoon();
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

  /** Let the stickers settle with no transition, then allow transitions again two frames later. Reading a layout property
   *  here would force every sticker to restyle at once, which is slow on a 5×5 cube. */
  function endNoAnim(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => scene.classList.remove("no-anim")));
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      finish = resolve;
      setTimeout(resolve, ms);
    });
  const layerButtons = (axis: Axis, layer: number) => layerStickers(n, axis, layer).map((i) => buttons[i]!);
  const setAngle = (turn: CubeRotate, deg: number) => layerButtons(turn.axis, turn.layer).forEach((b) => b.style.setProperty("--turn", TURN_CSS[turn.axis](deg)));
  /** Put the layer back at its original orientation with no transition. Only the layer's own stickers are told to skip
   *  their transition, so the browser does not have to restyle the whole cube twice (it is slow on a 5×5 cube). */
  const clearAngle = (turn: CubeRotate) => {
    const layer = layerButtons(turn.axis, turn.layer);
    layer.forEach((b) => {
      b.style.transition = "none";
      b.style.removeProperty("--turn");
    });
    angle = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => layer.forEach((b) => b.style.removeProperty("transition"))));
  };
  const setBusy = (value: boolean) => {
    busy = value;
    if (value) stage.dataset.busy = "true";
    else delete stage.dataset.busy;
  };

  /** Draw a sticker's mark; `ghost` marks are a preview and dashed. */
  function drawSticker(i: number, value: Cell, opts2: { fresh?: boolean; ghost?: boolean } = {}): void {
    const b = buttons[i]!;
    if (value === 0) b.replaceChildren();
    else {
      const mark = createMark(markOf(value), { fresh: opts2.fresh === true });
      if (opts2.ghost) mark.classList.add("mark-preview");
      b.replaceChildren(mark);
    }
  }

  /** Flat view: show the layer's stickers as they would be after the turn. */
  function showGhosts(rotation: CubeRotate): void {
    const after = rotateStickers(lastStickers, n, rotation.axis, rotation.layer, rotation.dir);
    for (const i of layerStickers(n, rotation.axis, rotation.layer)) {
      drawSticker(i, after[i] as Cell, { ghost: true });
      buttons[i]!.dataset.ghost = "true";
    }
  }
  function clearGhosts(): void {
    buttons.forEach((b, i) => {
      if (b.dataset.ghost === undefined) return;
      delete b.dataset.ghost;
      drawSticker(i, shown[i]!);
    });
  }

  const api: CubeView = {
    element: stage,
    supports3D: can3D,
    get flat() {
      return flat;
    },
    get busy() {
      return busy;
    },
    get previewing() {
      return previewing;
    },
    setFlat(value) {
      if (value === flat || (!value && !can3D)) return;
      const keep = previewing;
      api.settle();
      api.discardPreview();
      flat = value;
      mount();
      if (keep) void api.previewTurn(keep);
    },
    isInView(face) {
      return flat || faceInView(view.rx, view.ry, face);
    },
    async turnToFace(face, ms) {
      if (flat) return;
      const target = faceViewAngles(face);
      // the nearest equivalent angle, so a view that was dragged round a few times does not spin back
      view = { rx: target.rx, ry: target.ry + 360 * Math.round((view.ry - target.ry) / 360) };
      const instant = reducedMotion();
      scene.style.transitionDuration = instant ? "0s" : `${ms}ms`;
      applyView(true);
      // reduced motion: keep the zero duration until the browser has applied the new view, then let transitions back in
      await new Promise<void>((resolve) => (instant ? requestAnimationFrame(() => requestAnimationFrame(() => resolve())) : setTimeout(resolve, ms + 30)));
      scene.style.transitionDuration = "";
    },
    showFace(face) {
      if (flat) {
        buttons[face * n2 + roving[face]!]?.focus();
        return;
      }
      view = faceViewAngles(face);
      applyView(true);
    },
    update(stickers, lines, fresh) {
      lastStickers = stickers;
      const inLine = new Map<number, string>();
      for (const line of lines) for (const c of line.cells) inLine.set(line.face * n2 + c, line.owner);
      buttons.forEach((b, i) => {
        const value = stickers[i] as Cell;
        if (shown[i] !== value || b.dataset.ghost !== undefined) {
          drawSticker(i, value, { fresh: i === fresh });
          delete b.dataset.ghost;
          b.setAttribute("aria-label", describe(i, value));
          b.dataset.mark = value === 0 ? "" : markOf(value);
        }
        const owner = inLine.get(i) ?? "";
        if ((b.dataset.line ?? "") !== owner) {
          if (owner) b.dataset.line = owner;
          else delete b.dataset.line;
        }
      });
      shown = stickers.slice() as Cell[];
      applyLocks();
    },
    setLocked(faces) {
      locked = new Set(faces);
      applyLocks();
    },
    async playRotation(rotation, commit) {
      api.settle();
      api.discardPreview();
      const layer = layerButtons(rotation.axis, rotation.layer);
      if (!flat && reducedMotion()) {
        commit();
        return;
      }
      setBusy(true);
      if (flat) {
        layer.forEach((b) => b.classList.add("flash"));
        await wait(220);
        layer.forEach((b) => b.classList.remove("flash"));
      } else {
        layer.forEach((b) => b.style.setProperty("--turn", TURN_CSS[rotation.axis](quartersOf(rotation) * 90)));
        await wait(ANIMATION_MS + 40);
        // Put the stickers back where they were with no transition, then show the new marks.
        scene.classList.add("no-anim");
        layer.forEach((b) => b.style.removeProperty("--turn"));
      }
      commit();
      if (!flat) {
        endNoAnim();
      }
      setBusy(false);
      finish = null;
    },
    async previewTurn(rotation) {
      previewing = rotation;
      angle = flat ? 0 : targetAngle(0, quartersOf(rotation));
      if (flat) {
        showGhosts(rotation);
        setBusy(true);
        await wait(reducedMotion() ? 0 : 160);
      } else if (reducedMotion()) {
        setAngle(rotation, angle);
        scene.classList.add("no-anim");
        endNoAnim();
      } else {
        setBusy(true);
        setAngle(rotation, angle);
        await wait(ANIMATION_MS + 40);
      }
      finish = null;
      setBusy(false);
    },
    async retargetTurn(from, to) {
      if (!previewing || previewing.axis !== to.axis || previewing.layer !== to.layer) {
        // Nothing to swing from (the preview was dropped meanwhile): just show the new turn.
        await api.previewTurn(to);
        return;
      }
      previewing = to;
      if (flat) {
        showGhosts(to);
        setBusy(true);
        await wait(reducedMotion() ? 0 : 160);
      } else {
        angle = targetAngle(angle, quartersOf(to));
        if (reducedMotion()) {
          scene.classList.add("no-anim");
          setAngle(to, angle);
          endNoAnim();
        } else {
          setBusy(true);
          setAngle(to, angle);
          await wait(ANIMATION_MS + 40);
        }
      }
      void from;
      finish = null;
      setBusy(false);
    },
    async cancelPreview() {
      const turn = previewing;
      if (!turn) return;
      if (flat) {
        clearGhosts();
        previewing = null;
        return;
      }
      if (reducedMotion()) {
        clearAngle(turn);
        previewing = null;
        return;
      }
      setBusy(true);
      // The nearest multiple of 360 is the original orientation, reached by the shortest way.
      setAngle(turn, settleAngle(angle));
      await wait(ANIMATION_MS + 40);
      finish = null;
      clearAngle(turn);
      previewing = null;
      setBusy(false);
    },
    commitPreview(commit) {
      const turn = previewing;
      previewing = null;
      if (turn && !flat) {
        // Hold the turned layer, then swap in the new marks with no transition so nothing plays twice.
        clearAngle(turn);
        commit();
        return;
      }
      commit();
    },
    discardPreview() {
      const turn = previewing;
      previewing = null;
      if (!turn) return;
      finish?.();
      if (flat) {
        clearGhosts();
        return;
      }
      clearAngle(turn);
      setBusy(false);
    },
    setHints(win, block) {
      buttons.forEach((b) => b.removeAttribute("data-hint"));
      for (const i of block) buttons[i]?.setAttribute("data-hint", "block");
      for (const i of win) buttons[i]?.setAttribute("data-hint", "win");
    },
    outline(axis, layer) {
      // Only touch the stickers whose state changes, so a layer that stays highlighted is never cleared and redrawn.
      const wanted = new Set(layer === null ? [] : layerStickers(n, axis, layer));
      buttons.forEach((b, i) => {
        const on = b.dataset.preview === "true";
        if (wanted.has(i) && !on) b.dataset.preview = "true";
        else if (!wanted.has(i) && on) b.removeAttribute("data-preview");
      });
    },
    settle() {
      finish?.();
    },
  };

  mount();
  return api;
}
