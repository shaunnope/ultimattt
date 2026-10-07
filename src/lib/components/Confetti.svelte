<script lang="ts">
  import { onMount } from "svelte";
  import { startConfetti } from "../../ui/confetti.ts";

  // A short burst of confetti when somebody wins. It draws nothing at all for a player who has asked for reduced motion, and the
  // parent takes it down (onDone) when the burst ends. The drawing is in ui/confetti.ts, which takes everything it touches as
  // arguments, so it is tested without a browser.
  let { onDone }: { onDone?: () => void } = $props();
  let canvas = $state<HTMLCanvasElement>();
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  onMount(() => {
    const run = startConfetti({
      reducedMotion,
      createCanvas: () => canvas!,
      attach: () => undefined,
      detach: () => onDone?.(),
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
      now: () => performance.now(),
      random: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32,
      size: () => ({ width: innerWidth, height: innerHeight }),
    });
    if (!run) onDone?.();
    return () => run?.stop();
  });
</script>

{#if !reducedMotion}
  <canvas bind:this={canvas} aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60"></canvas>
{/if}
