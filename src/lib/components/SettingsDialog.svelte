<script lang="ts">
  import type { CubeNotation } from "../../core/settings.ts";
  import { settings } from "../state/settings.ts";
  import PalettePicker from "./PalettePicker.svelte";

  // The body of the Settings dialog: hints, automatic replay, mark colours and how Twist turns are named. Appearance has
  // its own dialog. Changes apply at once and are remembered on this device.
</script>

<label class="check"><input type="checkbox" checked={$settings.hints} onchange={(event) => settings.update({ hints: event.currentTarget.checked })} /><span>Show hints</span></label>
<p class="hint-text">Marks the cells that win for you (a dot) and the cells you must block (a dashed ring) on your turn.</p>
<label class="check"><input type="checkbox" checked={$settings.autoReplay} onchange={(event) => settings.update({ autoReplay: event.currentTarget.checked })} /><span>Replay a finished game automatically</span></label>
<PalettePicker current={$settings.markPalette} onchange={(markPalette) => settings.update({ markPalette })} />
<label class="field">
  Twist turn names
  <select id="notation-select" value={$settings.cubeNotation} onchange={(event) => settings.update({ cubeNotation: event.currentTarget.value as CubeNotation })}>
    <option value="words">Arrows and words</option>
    <option value="cube">Cube notation (R, U', F2, 2L)</option>
  </select>
</label>
