<script lang="ts">
  import { onMount, untrack, type Snippet } from "svelte";
  import type { CubeState } from "../../core/cube.ts";
  import { replayFrames } from "../../core/replay.ts";
  import type { ClassicState } from "../../core/classic.ts";
  import type { NotationStyle } from "../../core/notation.ts";
  import type { ReplaySpeed } from "../../core/settings.ts";
  import type { GameConfig, Mark, Move } from "../../core/types.ts";
  import type { UltimateState } from "../../core/ultimate.ts";
  import { variantName } from "../../core/variants.ts";
  import { optionsNote } from "../../ui/cube-labels.ts";
  import { frameView } from "../../ui/replay-model.ts";
  import { describeMove } from "../../ui/replay-text.ts";
  import { announce } from "../../ui/ui.ts";
  import Banner from "./Banner.svelte";
  import BoardClassic from "./BoardClassic.svelte";
  import BoardUltimate from "./BoardUltimate.svelte";
  import CubeBoard from "./CubeBoard.svelte";
  import Pill from "./Pill.svelte";
  import ReplayControls from "./ReplayControls.svelte";

  // The replay: a finished game played back on the board, with play and pause, steps, a slider, a move list and a speed
  // (remembered). It shows positions the rules produce from the moves; it never takes a move, so opening one cannot change anything.
  interface Props {
    config: GameConfig;
    moves: readonly Move[];
    /** Who resigned, if the game ended that way. */
    resigned?: Mark;
    speed: ReplaySpeed;
    onSpeed: (speed: ReplaySpeed) => void;
    /** Start playing from the first move at once. */
    autoplay: boolean;
    onClose: () => void;
    closeLabel?: string;
    /** How Cube turns are named in the move list. Display only. */
    notation?: NotationStyle;
    /** More buttons beside Close, such as "Play this seed". */
    actions?: Snippet;
  }
  let { config, moves, resigned, speed, onSpeed, autoplay, onClose, closeLabel = "Close replay", notation = "words", actions }: Props = $props();

  const STEP_MS = 900;
  const MIN_STEP_MS = 160;

  const frames = untrack(() => replayFrames(config, moves));
  const total = untrack(() => moves.length);
  let index = $state(untrack(() => (autoplay ? 0 : moves.length)));
  let currentSpeed = $state<ReplaySpeed>(untrack(() => speed));
  let playing = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const items: (HTMLElement | undefined)[] = [];

  const stepMs = (): number => Math.max(MIN_STEP_MS, STEP_MS / currentSpeed);
  const view = $derived(frameView(config, frames, index, resigned));
  const texts = untrack(() => moves.map((move, i) => describeMove(config, move, frames[i + 1]!.mover!, i + 1, notation)));
  const title = $derived(`${variantName(config.variant, "short")} ${config.size}×${config.size}, ${config.winLength} in a row${optionsNote(config)}`);

  // each position is said aloud, and the move list follows it
  $effect(() => {
    announce(view.spoken);
    items[view.index - 1]?.scrollIntoView?.({ block: "nearest" });
  });

  function setIndex(i: number): void {
    index = Math.max(0, Math.min(total, i));
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, stepMs());
  }

  function tick(): void {
    timer = null;
    if (!playing) return;
    if (index >= total) {
      playing = false;
      return;
    }
    setIndex(index + 1);
    if (index >= total) playing = false;
    else schedule();
  }

  function play(): void {
    if (index >= total) setIndex(0);
    playing = true;
    schedule();
  }

  function pause(): void {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  onMount(() => {
    if (autoplay) play();
    return () => pause();
  });
</script>

<section class="screen replay" aria-label="Replay">
  <div class="game-head">
    <span class="game-title">Replay</span>
    <span class="game-sub" id="replay-rules">{config.seed ? `${title}, seed ${config.seed}` : title}</span>
  </div>
  <Pill model={view.pill} />
  <Banner id="game-status" class="status-line" text={view.result} hidden={view.result === ""} />
  {#if config.variant === "ultimate"}
    <BoardUltimate game={frames[view.index]!.state as UltimateState} readOnly />
  {:else if config.variant === "cube"}
    <CubeBoard game={frames[view.index]!.state as CubeState} readOnly {notation} {stepMs} />
  {:else}
    <BoardClassic game={frames[view.index]!.state as ClassicState} readOnly />
  {/if}
  <ReplayControls
    index={view.index}
    {total}
    {playing}
    speed={currentSpeed}
    readout={view.readout}
    onPlay={play}
    onPause={pause}
    onStep={(delta) => {
      pause();
      setIndex(index + delta);
    }}
    onSeek={(i) => {
      pause();
      setIndex(i);
    }}
    onSpeed={(next) => {
      currentSpeed = next;
      onSpeed(next);
    }} />
  <ol class="move-list" aria-label="Moves">
    {#each texts as text, i (i)}
      <li aria-current={i + 1 === view.index ? "step" : undefined} bind:this={items[i]}>
        <button
          type="button"
          class="move-item"
          aria-label={text.name}
          onclick={() => {
            pause();
            setIndex(i + 1);
          }}>{text.label}</button>
      </li>
    {/each}
  </ol>
  <div class="game-controls">
    <button type="button" class="btn" onclick={onClose}>{closeLabel}</button>
    {@render actions?.()}
  </div>
</section>
