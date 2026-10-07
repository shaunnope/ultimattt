<script lang="ts">
  import type { PillModel } from "../../ui/status-text.ts";
  import Mark from "./Mark.svelte";

  // The current-player pill: two segments, X then O, with the player to move highlighted. In Twist each segment also holds that
  // player's score. It is display only (not focusable, not clickable). A highlight slides under the active segment with a CSS
  // transform (no slide under reduced motion). What is said aloud goes through the page's live region from the caller; the pill
  // itself is not a live region. The model comes from pillModel() in ui/status-text.ts.
  let { model }: { model: PillModel } = $props();

  const active = $derived(model.segments.find((s) => s.active)?.mark ?? "");
</script>

<div id="turn-pill" class="turn-pill" role="group" aria-label="Current player" data-active={active}>
  <span class="pill-thumb" aria-hidden="true"></span>
  {#each model.segments as segment (segment.mark)}
    <div
      class="pill-seg"
      data-mark={segment.mark}
      aria-current={segment.active ? "true" : undefined}
      data-active={segment.active ? "true" : undefined}
      data-winner={segment.winner ? "true" : undefined}>
      <Mark mark={segment.mark} />
      {#if segment.score !== undefined}<span class="pill-score">{segment.score}</span>{/if}
      <span class="pill-caption pill-you" hidden={!segment.you}>{segment.you ? "You" : ""}</span>
      <span class="pill-caption pill-winner" hidden={!segment.winner}>{segment.winner ? "Winner" : ""}</span>
    </div>
  {/each}
</div>
