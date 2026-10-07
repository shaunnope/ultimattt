<script lang="ts">
  import { PALETTES } from "../../core/palette.ts";
  import Icon from "./Icon.svelte";
  import Mark from "./Mark.svelte";

  // The mark colour choice in Settings: a list of the fixed palettes, one selected, each with a live X and O sample.
  // There is no colour input: players pick from the ready-made pairs, so every choice is readable and distinct
  // (proved once in tests/unit/palette.test.ts). Samples show both the light and dark variant through CSS custom
  // properties, so switching appearance needs no redraw. The chosen row carries a check icon and the word "Selected",
  // so the choice is not shown by colour alone.
  let { current, onchange }: { current: string; onchange: (id: string) => void } = $props();
</script>

<fieldset class="palette-picker" data-group="mark-palette">
  <legend>Mark colours (on this device only)</legend>
  <div class="choice-grid palette-grid">
    {#each PALETTES as palette (palette.id)}
      <div class="choice" data-palette={palette.id}>
        <input type="radio" name="mark-palette" id={`palette-${palette.id}`} value={palette.id} checked={palette.id === current} onchange={() => onchange(palette.id)} />
        <label for={`palette-${palette.id}`}>
          <strong>{palette.label}</strong>
          <span
            class="palette-sample"
            aria-hidden="true"
            style:--sample-x-light={palette.X.light}
            style:--sample-x-dark={palette.X.dark}
            style:--sample-o-light={palette.O.light}
            style:--sample-o-dark={palette.O.dark}><Mark mark="X" /><Mark mark="O" /></span>
          {#if palette.id === current}<span class="selected-mark"><Icon name="check" />Selected</span>{/if}
        </label>
      </div>
    {/each}
  </div>
</fieldset>
