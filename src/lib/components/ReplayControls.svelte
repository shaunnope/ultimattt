<script lang="ts">
  import type { ReplaySpeed } from "../../core/settings.ts";
  import Icon from "./Icon.svelte";

  // Play and pause, a step each way, the readout, a slider over the moves and the speed.
  interface Props {
    index: number;
    total: number;
    playing: boolean;
    speed: ReplaySpeed;
    readout: string;
    onPlay: () => void;
    onPause: () => void;
    onStep: (delta: number) => void;
    onSeek: (index: number) => void;
    onSpeed: (speed: ReplaySpeed) => void;
  }
  let { index, total, playing, speed, readout, onPlay, onPause, onStep, onSeek, onSpeed }: Props = $props();

  const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
  const label = $derived(playing ? "Pause" : "Play");
</script>

<div class="replay-controls" role="group" aria-label="Replay controls">
  <button type="button" class="btn" aria-label={label} onclick={() => (playing ? onPause() : onPlay())}><Icon name={playing ? "pause" : "play"} />{label}</button>
  <button type="button" class="icon-btn" aria-label="Step back" disabled={index === 0} onclick={() => onStep(-1)}><Icon name="back" /></button>
  <button type="button" class="icon-btn" aria-label="Step forward" disabled={index === total} onclick={() => onStep(1)}><Icon name="forward" /></button>
  <span id="replay-readout" class="replay-readout num">{readout}</span>
  <input type="range" min="0" max={total} step="1" value={index} aria-label="Replay position" class="replay-slider" oninput={(event) => onSeek(Number(event.currentTarget.value))} />
  <label class="replay-speed">
    Speed
    <select id="replay-speed" value={String(speed)} onchange={(event) => onSpeed(Number(event.currentTarget.value) as ReplaySpeed)}>
      {#each SPEEDS as option (option)}<option value={String(option)}>{option}×</option>{/each}
    </select>
  </label>
</div>
