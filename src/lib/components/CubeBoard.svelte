<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { cubeLines, lastPlacedSticker, lockedFaces } from "../../core/cube.ts";
  import type { CubeState } from "../../core/cube.ts";
  import { layerLabel, layerPhrase, turnName, turnsFor, type NotationStyle } from "../../core/notation.ts";
  import type { Axis, CubeHint, CubeRotate, HintSet, Move } from "../../core/types.ts";
  import { supports3D, turnIcon } from "../../ui/cube-geometry.ts";
  import { FACE_NAMES, rotationLabel } from "../../ui/cube-labels.ts";
  import { CubeSession, type TurnDriver } from "../../ui/cube-session.ts";
  import CubeView from "./CubeView.svelte";
  import Icon from "./Icon.svelte";

  // The Cube board: the cube itself (3D or flat), a view bar, and, after a scoring move, the layer-turn picker. Marks are placed by
  // pressing a sticker. Turning a layer is select, preview, confirm: pressing a turn button animates the layer to its new position
  // and holds it there; Confirm makes the move; pressing outside the cube and the controls, or Escape, turns it back and leaves the
  // turn pending. The rules of that flow are core/turn-selection.ts, run by ui/cube-session.ts; the view animates what it asks for.
  // Input is ignored while a turn animates.
  interface Props {
    game: CubeState;
    hints?: HintSet<CubeHint>;
    /** How turns are named on the buttons and in captions. Display only. */
    notation?: NotationStyle;
    onMove?: (move: Move) => void;
    /** A replay shows the cube but never offers the layer picker. */
    readOnly?: boolean;
    /** In a two-device game only the player whose turn it is gets the layer picker. */
    mayMove?: (state: CubeState) => boolean;
    /** A replay: how long one step lasts (ms), so turning the view to a played face fits inside it. */
    stepMs?: () => number;
  }
  let { game, hints = { win: [], block: [] }, notation = "words", onMove = () => undefined, readOnly = false, mayMove, stepMs }: Props = $props();

  const size = $derived(game.config.size);
  const n2 = $derived(size * size);

  const SHORT: Record<number, string> = { 0: "Top", 1: "Bottom", 2: "Front", 3: "Back", 4: "Left", 5: "Right" };
  const SECTION_TITLES: Record<Axis, string> = {
    y: "Layers across the cube (turn sideways)",
    x: "Layers down the cube (turn up or down)",
    z: "Layers front to back (turn like a wheel)",
  };
  const SECTION_ORDER: Axis[] = ["y", "x", "z"];
  const turnKey = (r: CubeRotate): string => `${r.axis}${r.layer}${r.dir}`;
  const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

  let view = $state<CubeView>();
  /** The flat view is on: always, where the browser cannot draw the 3D cube. */
  let flat = $state(!supports3D());

  // what the cube is showing: the position, and the sticker that was just placed (whose mark draws itself in)
  let shownState = $state.raw<CubeState>(untrack(() => game));
  let freshSticker = $state<number | undefined>();
  let rotating = $state(false);

  // ---- the turn flow ----
  const driver: TurnDriver = {
    play: (rotation) => view!.previewTurn(rotation),
    retarget: (from, to) => view!.retargetTurn(from, to),
    reverse: () => view!.cancelPreview(),
    discard: () => view!.discardPreview(),
    commit: (commit) => view!.commitPreview(commit),
  };
  const session = new CubeSession(driver, (rotation) => untrack(() => onMove)(rotation));
  let tick = $state(0);
  const flow = $derived.by(() => {
    tick;
    return { preview: session.preview, settled: session.settled, status: session.status, reversing: session.reversing };
  });
  onMount(() => session.subscribe(() => tick++));

  // ---- the layer highlight: a tapped name (touch), else hover or focus, else the held preview ----
  type LayerRef = { axis: Axis; layer: number };
  let hovered = $state.raw<LayerRef | null>(null);
  let focused = $state.raw<LayerRef | null>(null);
  let tapped = $state.raw<LayerRef | null>(null);
  /** The pointer type of the last press on a layer name, so only a touch tap sticks. */
  let lastPointer = "mouse";
  const canHover = (): boolean => typeof matchMedia !== "function" || matchMedia("(hover: hover)").matches;
  const held = $derived(flow.status === "idle" || !flow.preview ? null : { axis: flow.preview.axis, layer: flow.preview.layer });
  // A tap is a deliberate act on a touch screen, where a stray "hover" can linger from a fake mouse move; it comes first.
  const outline = $derived(tapped ?? hovered ?? focused ?? held);

  function select(rotation: CubeRotate): void {
    session.select(rotation);
  }
  function confirm(): void {
    tapped = null;
    session.confirm();
  }
  function cancel(): void {
    tapped = null;
    session.cancel();
  }
  function reset(): void {
    tapped = null;
    session.reset();
  }

  // ---- the picker ----
  const sections = $derived.by(() => {
    const rows = new Map<Axis, Map<number, CubeRotate[]>>();
    for (const turn of turnsFor(size)) {
      const layers = rows.get(turn.axis) ?? new Map<number, CubeRotate[]>();
      layers.set(turn.layer, [...(layers.get(turn.layer) ?? []), turn]);
      rows.set(turn.axis, layers);
    }
    return SECTION_ORDER.map((axis) => ({
      axis,
      layers: [...rows.get(axis)!].map(([layer, turns]) => ({
        layer,
        turns,
        name: notation === "cube" ? layerLabel(axis, layer, size, "cube") : capitalise(layerPhrase(axis, layer, size)),
      })),
    }));
  });

  const caption = $derived(
    flow.settled
      ? `Previewing: ${turnName(flow.settled, size, notation)}. Confirm to make this turn, or click outside to cancel.`
      : flow.status === "animating"
        ? ""
        : "Choose a turn to preview it, then confirm.",
  );

  function watchEnter(event: PointerEvent, ref: LayerRef): void {
    // A touch screen has no hover (and fakes a mouse move after the layout changes under a finger): a tap on the name highlights instead.
    if (event.pointerType === "touch" || !canHover()) return;
    hovered = ref;
  }
  function watchLeave(ref: LayerRef): void {
    if (hovered !== null && hovered.axis === ref.axis && hovered.layer === ref.layer) hovered = null;
  }
  function watchFocusIn(event: FocusEvent, ref: LayerRef): void {
    // Only keyboard focus highlights: a mouse click leaves focus on the button, which must not hold the outline.
    if (!(event.target as Element).matches(":focus-visible")) return;
    focused = ref;
  }
  function watchFocusOut(ref: LayerRef): void {
    if (focused !== null && focused.axis === ref.axis && focused.layer === ref.layer) focused = null;
  }
  function watchPointerDown(event: PointerEvent): void {
    lastPointer = event.pointerType;
    if (event.pointerType === "mouse" && tapped) tapped = null; // the mouse took over from the touch screen
  }
  function nameClick(ref: LayerRef): void {
    if (lastPointer === "mouse") return;
    tapped = ref;
  }

  // Pressing anywhere that is not the cube, the picker or a control cancels a preview; Escape does too.
  const INTERACTIVE = "button, a[href], input, select, textarea, label, summary, dialog, [role='button'], [role='dialog']";
  let picker = $state<HTMLElement>();
  onMount(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (session.status !== "previewing") return;
      const target = event.target as Element | null;
      if (!target || !target.closest) return;
      if (target.closest(".cube-stage") || picker?.contains(target) || target.closest(INTERACTIVE)) return;
      cancel();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || session.status !== "previewing") return;
      event.stopPropagation();
      cancel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      session.reset();
    };
  });

  // ---- a new position ----
  let last: CubeState | null = null;
  let generation = 0;

  function show(state: CubeState, fresh?: number): void {
    shownState = state;
    freshSticker = fresh;
    rotating = state.phase === "rotate" && state.status === "playing" && !readOnly && (mayMove?.(state) ?? true);
    if (!rotating) {
      hovered = focused = tapped = null;
      reset();
    }
  }

  function update(state: CubeState): void {
    const previous = last;
    last = state;
    generation++;
    const mine = generation;
    view?.settle();
    const lastMove = state.moves[state.moves.length - 1];
    const grew = previous !== null && state.moves.length === previous.moves.length + 1;
    // Any position that is not simply "the turn I just confirmed" drops a preview.
    const { justConfirmed } = session.position(previous, state);
    const placed = lastMove as unknown as { t: string; face: number; cell: number } | undefined;
    const fresh = grew && placed?.t === "place" ? placed.face * size * size + placed.cell : undefined;
    const animate = grew && lastMove?.t === "rotate" && !justConfirmed;
    // A replay shows a mark only once its face is in view: turn the view first, then draw the position.
    const newPosition = previous === null || previous.moves.length !== state.moves.length;
    if (readOnly && newPosition && placed?.t === "place" && view && !view.isInView(placed.face)) {
      const ms = Math.min(350, 0.6 * (stepMs?.() ?? Infinity));
      void view.turnToFace(placed.face, ms).then(() => {
        if (mine === generation) show(state, fresh);
      });
      return;
    }
    if (!animate || !view) {
      show(state, fresh);
      return;
    }
    // The turn was made on the other device (or replayed): hide the picker at once, animate, then show the new marks.
    rotating = false;
    void view.playRotation(lastMove as CubeRotate, () => {
      if (mine === generation) show(state);
    });
  }

  $effect(() => {
    const state = game;
    untrack(() => update(state));
  });

  const lines = $derived(cubeLines(shownState.stickers, size, shownState.config.winLength));
  const lastIndex = $derived(lastPlacedSticker(shownState));
  const locked = $derived(shownState.config.lockFaces ? lockedFaces(shownState.stickers, size, shownState.config.winLength) : []);
  const win = $derived(hints.win.map((x) => x.face * n2 + x.cell));
  const block = $derived(hints.block.map((x) => x.face * n2 + x.cell));
</script>

<div class="cube-board" data-size={size} data-phase={rotating ? "rotate" : "place"}>
  <div class="cube-viewbar" role="group" aria-label="View">
    {#each FACE_NAMES as name, face (face)}
      <button type="button" class="btn btn-small" aria-label={`Show ${name} face`} hidden={flat} onclick={() => view?.showFace(face)}>{SHORT[face]}</button>
    {/each}
    <button type="button" class="btn btn-small" aria-pressed={flat} disabled={!supports3D()} onclick={() => view?.setFlat(!flat)}>Flat view</button>
  </div>
  <CubeView
    bind:this={view}
    bind:flat
    {size}
    stickers={shownState.stickers}
    {lines}
    fresh={freshSticker}
    {win}
    {block}
    {lastIndex}
    {locked}
    {outline}
    onSticker={(face, cell) => onMove({ t: "place", face, cell })} />
  <div class="rotate-picker" role="group" aria-label="Turn a layer" hidden={!rotating} bind:this={picker}>
    {#each sections as section (section.axis)}
      <div class="rotate-section">
        <h3>{SECTION_TITLES[section.axis]}</h3>
        {#each section.layers as layer (layer.layer)}
          {@const ref = { axis: section.axis, layer: layer.layer }}
          <!-- A layer row only reports where the pointer or focus is, to outline the layer; the buttons inside it are the controls. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="rotate-row"
            data-axis={section.axis}
            data-layer={layer.layer}
            onpointerenter={(event) => watchEnter(event, ref)}
            onpointerleave={() => watchLeave(ref)}
            onfocusin={(event) => watchFocusIn(event, ref)}
            onfocusout={() => watchFocusOut(ref)}
            onpointerdown={watchPointerDown}>
            <!-- A tap on a layer's name (touch) outlines the layer: a convenience, never the only way. The turn buttons do the work. -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span class="rotate-name" onclick={() => nameClick(ref)}>{layer.name}</span>
            {#each layer.turns as turn (turnKey(turn))}
              {@const label = rotationLabel(turn, size)}
              <button
                type="button"
                class={["btn", "btn-small", "turn-btn", notation === "cube" ? "turn-text" : "turn-icon"]}
                aria-label={label}
                aria-pressed={flow.status !== "idle" && !flow.reversing && flow.preview !== null && turnKey(flow.preview) === turnKey(turn)}
                title={label}
                data-turn={turnKey(turn)}
                onclick={() => select(turn)}>{#if notation === "cube"}<span aria-hidden="true">{turnName(turn, size, "cube")}</span>{:else}<Icon name={turnIcon(turn)} />{/if}</button>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
    <div class="turn-actions">
      <p class="turn-caption" id="turn-caption" aria-live="polite">{caption}</p>
      <button type="button" class="btn btn-primary" id="turn-confirm" disabled={flow.settled === null} onclick={confirm}>Confirm turn</button>
    </div>
  </div>
</div>
