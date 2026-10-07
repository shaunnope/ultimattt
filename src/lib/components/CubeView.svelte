<script lang="ts">
  import { untrack } from "svelte";
  import type { CubeLine } from "../../core/cube.ts";
  import { layerStickers, rotateStickers } from "../../core/cube.ts";
  import { settleAngle, targetAngle } from "../../core/turn-path.ts";
  import type { Axis, Cell, CubeRotate } from "../../core/types.ts";
  import { markOf } from "../../core/types.ts";
  import { FACE_NAMES, faceInView, faceViewAngles, frontFace } from "../../ui/cube-labels.ts";
  import { FACE_TRANSFORM, TURN_CSS, netOrigin, quartersOf, supports3D } from "../../ui/cube-geometry.ts";
  import { markName } from "../../ui/mark.ts";
  import Icon from "./Icon.svelte";
  import Mark from "./Mark.svelte";

  // The cube on screen. One button per sticker (6·N²), shown either as a 3D cube made with CSS 3D transforms (drag, arrow keys or
  // the face buttons turn the view) or as a flat unfolded net. Layer turns animate in 3D by turning the layer's stickers about
  // the cube's centre. A turn can also be previewed: the layer turns and stays turned until the preview is cancelled (it turns
  // back) or committed (the new marks replace it with no replay). In the flat view there is no 3D motion, so a preview shows the
  // marks as they would be after the turn, dashed. The view knows nothing about rules: it draws what it is told and reports
  // sticker presses. The turn flow itself is ui/cube-session.ts.
  interface Props {
    size: number;
    stickers: readonly Cell[];
    lines: readonly CubeLine[];
    /** The sticker that was just placed, whose mark draws itself in. */
    fresh?: number | undefined;
    /** Stickers to point out: the cell that wins (a dot) and the cell to block (a dashed ring). */
    win?: readonly number[];
    block?: readonly number[];
    /** The sticker holding the latest placement. */
    lastIndex?: number | null;
    /** Faces to mark as locked: a striped pattern, a padlock badge, and empty stickers aria-disabled. */
    locked?: readonly number[];
    /** Outline the stickers of a layer. */
    outline?: { axis: Axis; layer: number } | null;
    onSticker: (face: number, cell: number) => void;
    /** The flat view is on (the 3D view where the browser cannot draw it is never offered). */
    flat?: boolean;
  }

  const supports = supports3D();

  let {
    size: n,
    stickers,
    lines,
    fresh,
    win = [],
    block = [],
    lastIndex = null,
    locked = [],
    outline = null,
    onSticker,
    flat = $bindable(!supports),
  }: Props = $props();

  /** True when the browser can draw the 3D cube. */
  export const canDo3D = supports;

  const ANIMATION_MS = 340;
  const INITIAL_VIEW = { rx: -25, ry: -30 };
  const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const n2 = $derived(n * n);
  const faces = [0, 1, 2, 3, 4, 5];
  const origin = $derived(netOrigin(n));

  let view = $state({ ...INITIAL_VIEW });
  let snap = $state(false);
  let dragging = $state(false);
  let noAnim = $state(false);
  let busy = $state(false);
  let transitionDuration = $state<string | undefined>();
  /** The sticker of each face that is the tab stop (the centre one to begin with). */
  let roving = $state<number[]>(untrack(() => Array<number>(6).fill(Math.floor(n / 2) * n + Math.floor(n / 2))));
  /** The turn shown as a preview, or null. */
  let previewing: CubeRotate | null = null;
  /** The previewed layer's cumulative angle in degrees (+90 per quarter); 0 when no preview is held. */
  let angle = 0;
  /** The layer that is turned on screen, as the CSS turn it wears. */
  let turned = $state.raw<{ axis: Axis; layer: number; css: string } | null>(null);
  /** Stickers that must not animate this frame (a layer snapping back). */
  let still = $state.raw<ReadonlySet<number>>(new Set());
  /** Stickers flashing, in the flat view's version of a turn. */
  let flashing = $state.raw<ReadonlySet<number>>(new Set());
  /** The flat view's preview: the stickers of the layer as they would be after the turn. */
  let ghosts = $state.raw<ReadonlyMap<number, Cell>>(new Map());
  let finish: (() => void) | null = null;

  // A mark that was just placed draws itself in, and keeps that look for as long as it stays there.
  let previous: readonly Cell[] | null = null;
  let freshBefore = new Set<number>();
  const freshNow = $derived.by(() => {
    const now = new Set<number>();
    stickers.forEach((value, i) => {
      if (value === 0) return;
      if (previous !== null && previous[i] === value && freshBefore.has(i)) now.add(i);
      else if (i === fresh && (previous === null || previous[i] !== value)) now.add(i);
    });
    return now;
  });
  $effect(() => {
    previous = stickers.slice();
    freshBefore = freshNow;
  });

  const lockedSet = $derived(new Set(locked));
  const owners = $derived.by(() => {
    const map = new Map<number, string>();
    for (const line of lines) for (const c of line.cells) map.set(line.face * n2 + c, line.owner);
    return map;
  });
  const winSet = $derived(new Set(win));
  const blockSet = $derived(new Set(block));
  const outlined = $derived(new Set(outline ? layerStickers(n, outline.axis, outline.layer) : []));
  const turnedSet = $derived(new Set(turned ? layerStickers(n, turned.axis, turned.layer) : []));
  const front = $derived(flat ? -1 : frontFace(view.rx, view.ry));

  const describe = (i: number, value: Cell): string => {
    const face = Math.floor(i / n2);
    const cell = i % n2;
    const what = value === 0 ? (lockedSet.has(face) ? "empty, locked face" : "empty") : markName(markOf(value));
    return `${FACE_NAMES[face]} face, row ${Math.floor(cell / n) + 1}, column ${(cell % n) + 1}, ${what}`;
  };

  let scene = $state<HTMLElement>();

  // ---- turning the view: drag, keys ----
  let drag: { x: number; y: number; id: number; moved: boolean } | null = null;
  let suppressClick = false;
  let framePending = false;
  let pendingView: { rx: number; ry: number } | null = null;

  function onPointerDown(event: PointerEvent): void {
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
  }
  function onPointerMove(event: PointerEvent): void {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      scene?.setPointerCapture(event.pointerId);
      dragging = true;
    }
    pendingView = { rx: Math.max(-90, Math.min(90, (pendingView ?? view).rx - dy * 0.5)), ry: (pendingView ?? view).ry + dx * 0.5 };
    drag.x = event.clientX;
    drag.y = event.clientY;
    // pointer moves arrive faster than frames; apply the latest view once per frame
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      if (pendingView) view = pendingView;
      pendingView = null;
      snap = false;
    });
  }
  function endDrag(event: PointerEvent): void {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      scene?.releasePointerCapture?.(event.pointerId);
    }
    dragging = false;
    drag = null;
  }
  function onSceneKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 90 : 15;
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, step], ArrowRight: [0, -step], ArrowUp: [step, 0], ArrowDown: [-step, 0] };
    const m = moves[event.key];
    if (!m) return;
    event.preventDefault();
    view = { rx: Math.max(-90, Math.min(90, view.rx + m[0])), ry: view.ry + m[1] };
    snap = true;
  }
  function onClickCapture(event: MouseEvent): void {
    if (suppressClick) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  const buttons: (HTMLButtonElement | undefined)[] = [];

  function onStickerClick(face: number, cell: number): void {
    if (busy) return;
    roving[face] = cell;
    onSticker(face, cell);
  }

  function onStickerKeydown(event: KeyboardEvent, face: number, cell: number): void {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    event.stopPropagation();
    const r = Math.floor(cell / n);
    const c = cell % n;
    const nr = Math.min(n - 1, Math.max(0, r + d[0]));
    const nc = Math.min(n - 1, Math.max(0, c + d[1]));
    roving[face] = nr * n + nc;
    buttons[face * n2 + nr * n + nc]?.focus();
  }

  // ---- animation helpers ----
  const wait = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      finish = resolve;
      setTimeout(resolve, ms);
    });
  const frames2 = (action: () => void): void => void requestAnimationFrame(() => requestAnimationFrame(action));
  /** Let the stickers settle with no transition, then allow transitions again two frames later. */
  const endNoAnim = (): void => frames2(() => (noAnim = false));
  const setAngle = (rotation: CubeRotate, deg: number): void => {
    turned = { axis: rotation.axis, layer: rotation.layer, css: TURN_CSS[rotation.axis](deg) };
  };
  /** Put the layer back at its original orientation with no transition. Only the layer's own stickers skip their transition. */
  const clearAngle = (rotation: CubeRotate): void => {
    const layer = new Set(layerStickers(n, rotation.axis, rotation.layer));
    still = layer;
    turned = null;
    angle = 0;
    frames2(() => (still = new Set()));
  };
  const setBusy = (value: boolean): void => {
    busy = value;
  };

  /** Flat view: show the layer's stickers as they would be after the turn. */
  function showGhosts(rotation: CubeRotate): void {
    const after = rotateStickers(stickers, n, rotation.axis, rotation.layer, rotation.dir);
    const next = new Map<number, Cell>();
    for (const i of layerStickers(n, rotation.axis, rotation.layer)) next.set(i, after[i] as Cell);
    ghosts = next;
  }
  const clearGhosts = (): void => {
    ghosts = new Map();
  };

  // ---- what the board asks of the view ----

  /** Bring a face to the front (3D), or focus its tab stop (flat). */
  export function showFace(face: number): void {
    if (flat) {
      buttons[face * n2 + roving[face]!]?.focus();
      return;
    }
    view = faceViewAngles(face);
    snap = true;
  }

  /** Whether a face can be read from the current view (always true in the flat view). */
  export function isInView(face: number): boolean {
    return flat || faceInView(view.rx, view.ry, face);
  }

  /** Turn the view to bring a face to the front, taking about `ms`. Does nothing in the flat view; with reduced motion the view changes at once. */
  export async function turnToFace(face: number, ms: number): Promise<void> {
    if (flat) return;
    const target = faceViewAngles(face);
    // the nearest equivalent angle, so a view that was dragged round a few times does not spin back
    view = { rx: target.rx, ry: target.ry + 360 * Math.round((view.ry - target.ry) / 360) };
    const instant = reducedMotion();
    transitionDuration = instant ? "0s" : `${ms}ms`;
    snap = true;
    // reduced motion: keep the zero duration until the browser has applied the new view, then let transitions back in
    await new Promise<void>((resolve) => (instant ? frames2(resolve) : void setTimeout(resolve, ms + 30)));
    transitionDuration = undefined;
  }

  export function setFlat(value: boolean): void {
    if (value === flat || (!value && !supports)) return;
    const keep = previewing;
    settle();
    discardPreview();
    flat = value;
    if (keep) void previewTurn(keep);
  }

  /** Animate a layer turn, then call `commit` to put the new marks in place. */
  export async function playRotation(rotation: CubeRotate, commit: () => void): Promise<void> {
    settle();
    discardPreview();
    const layer = new Set(layerStickers(n, rotation.axis, rotation.layer));
    if (!flat && reducedMotion()) {
      commit();
      return;
    }
    setBusy(true);
    if (flat) {
      flashing = layer;
      await wait(220);
      flashing = new Set();
    } else {
      turned = { axis: rotation.axis, layer: rotation.layer, css: TURN_CSS[rotation.axis](quartersOf(rotation) * 90) };
      await wait(ANIMATION_MS + 40);
      // Put the stickers back where they were with no transition, then show the new marks.
      noAnim = true;
      turned = null;
    }
    commit();
    if (!flat) endNoAnim();
    setBusy(false);
    finish = null;
  }

  /** Turn a layer to its previewed position and hold it there. Resolves when the animation has ended. */
  export async function previewTurn(rotation: CubeRotate): Promise<void> {
    previewing = rotation;
    angle = flat ? 0 : targetAngle(0, quartersOf(rotation));
    if (flat) {
      showGhosts(rotation);
      setBusy(true);
      await wait(reducedMotion() ? 0 : 160);
    } else if (reducedMotion()) {
      setAngle(rotation, angle);
      noAnim = true;
      endNoAnim();
    } else {
      setBusy(true);
      setAngle(rotation, angle);
      await wait(ANIMATION_MS + 40);
    }
    finish = null;
    setBusy(false);
  }

  /** Swing the previewed layer straight from the turn it shows to another turn of the same layer, never back through where it started. */
  export async function retargetTurn(from: CubeRotate, to: CubeRotate): Promise<void> {
    if (!previewing || previewing.axis !== to.axis || previewing.layer !== to.layer) {
      // Nothing to swing from (the preview was dropped meanwhile): just show the new turn.
      await previewTurn(to);
      return;
    }
    void from;
    previewing = to;
    if (flat) {
      showGhosts(to);
      setBusy(true);
      await wait(reducedMotion() ? 0 : 160);
    } else {
      angle = targetAngle(angle, quartersOf(to));
      if (reducedMotion()) {
        noAnim = true;
        setAngle(to, angle);
        endNoAnim();
      } else {
        setBusy(true);
        setAngle(to, angle);
        await wait(ANIMATION_MS + 40);
      }
    }
    finish = null;
    setBusy(false);
  }

  /** Turn the previewed layer back. Resolves when the animation has ended. */
  export async function cancelPreview(): Promise<void> {
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
  }

  /** The preview is confirmed: call `commit` to put the new marks in place, with no animation replayed. */
  export function commitPreview(commit: () => void): void {
    const turn = previewing;
    previewing = null;
    if (turn && !flat) {
      // Hold the turned layer, then swap in the new marks with no transition so nothing plays twice.
      clearAngle(turn);
      commit();
      return;
    }
    commit();
  }

  /** Drop a preview at once, with no animation. */
  export function discardPreview(): void {
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
  }

  /** Cancel an animation and settle immediately. */
  export function settle(): void {
    finish?.();
  }

  // a new position is shown for real: nothing of a dashed preview stays
  $effect.pre(() => {
    stickers;
    untrack(() => {
      if (ghosts.size > 0) ghosts = new Map();
    });
  });

  const tabStop = (face: number, cell: number): 0 | -1 => ((flat || face === front) && cell === roving[face] ? 0 : -1);
</script>

{#snippet sticker(i: number)}
  {@const face = Math.floor(i / n2)}
  {@const cell = i % n2}
  {@const real = stickers[i] as Cell}
  {@const ghost = ghosts.get(i)}
  {@const shown = ghosts.has(i) ? (ghost as Cell) : real}
  <button
    type="button"
    class={["sticker", flashing.has(i) && "flash"]}
    data-face={face}
    data-cell={cell}
    data-mark={real === 0 ? "" : markOf(real)}
    data-line={owners.get(i)}
    data-hint={winSet.has(i) ? "win" : blockSet.has(i) ? "block" : undefined}
    data-last={lastIndex === i ? "true" : undefined}
    data-locked={lockedSet.has(face) ? "true" : undefined}
    data-ghost={ghosts.has(i) ? "true" : undefined}
    data-preview={outlined.has(i) ? "true" : undefined}
    aria-label={describe(i, real)}
    aria-disabled={lockedSet.has(face) && real === 0 ? "true" : undefined}
    tabindex={tabStop(face, cell)}
    bind:this={buttons[i]}
    style:--face={FACE_TRANSFORM[face]}
    style:--dx={cell % n - (n - 1) / 2}
    style:--dy={Math.floor(cell / n) - (n - 1) / 2}
    style:--fc={(origin[face]?.[0] ?? 0) + (cell % n)}
    style:--fr={(origin[face]?.[1] ?? 0) + Math.floor(cell / n)}
    style:--turn={turnedSet.has(i) && turned ? turned.css : undefined}
    style:transition={still.has(i) ? "none" : undefined}
    onclick={() => onStickerClick(face, cell)}
    onkeydown={(event) => onStickerKeydown(event, face, cell)}>{#if shown !== 0}<Mark mark={markOf(shown)} fresh={!ghosts.has(i) && freshNow.has(i)} class={ghosts.has(i) ? "mark-preview" : ""} />{/if}</button>
{/snippet}

{#snippet lockLabel(face: number, withPosition: boolean)}
  <div
    class="face-locked-label"
    aria-hidden="true"
    hidden={!lockedSet.has(face)}
    style:--face={FACE_TRANSFORM[face]}
    style:--fc={withPosition ? (origin[face]?.[0] ?? 0) : undefined}
    style:--fr={withPosition ? (origin[face]?.[1] ?? 0) : undefined}><span class="lock-icon"><Icon name="lock" /></span></div>
{/snippet}

<div class="cube-stage" style:--n={n} data-mode={flat ? "flat" : "3d"} data-busy={busy ? "true" : undefined}>
  {#if flat}
    <div class="cube-flat" role="group" aria-label="Twist, flat view">
      {#each faces as face (face)}
        <div class="cube-flat-face" role="group" aria-label={`${FACE_NAMES[face]} face`}>
          {#each Array.from({ length: n2 }, (_, c) => face * n2 + c) as i (i)}{@render sticker(i)}{/each}
          {@render lockLabel(face, true)}
        </div>
      {/each}
    </div>
  {:else}
    <!-- The 3D scene is one focus stop whose arrow keys, and a drag, turn the view; the stickers inside are the real buttons. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
    <div
      class={["cube-scene", snap && "snap", dragging && "dragging", noAnim && "no-anim"]}
      role="group"
      tabindex="0"
      aria-label="Twist, 3D view. Arrow keys turn the view; Shift with an arrow turns it a quarter."
      data-view={`${view.rx} ${view.ry}`}
      bind:this={scene}
      style:transform={`rotateX(${view.rx}deg) rotateY(${view.ry}deg)`}
      style:transition-duration={transitionDuration}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onclickcapture={onClickCapture}
      onkeydown={onSceneKeydown}>
      {#each Array.from({ length: 6 * n2 }, (_, i) => i) as i (i)}{@render sticker(i)}{/each}
      {#each faces as face (face)}{@render lockLabel(face, false)}{/each}
    </div>
  {/if}
</div>
