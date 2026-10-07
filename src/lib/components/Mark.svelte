<script lang="ts">
  import type { Mark } from "../../core/types.ts";
  import { markClassName, markShape } from "../../ui/mark.ts";

  // An X (two strokes) or an O (a circle) in the player's colour. Decorative: the cell or sticker that holds it carries
  // the accessible name. A fresh mark draws itself in, unless the player asked for reduced motion.
  let { mark, fresh = false, class: extra = "" }: { mark: Mark; fresh?: boolean; class?: string } = $props();

  const shape = $derived(markShape(mark));
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>

<svg class={[markClassName(mark, fresh, reduced), extra]} viewBox={shape.viewBox} aria-hidden="true" focusable="false">
  {#each shape.strokes as stroke, i (i)}
    {#if stroke.tag === "path"}<path {...stroke.attrs} />{:else}<circle {...stroke.attrs} />{/if}
  {/each}
</svg>
