<script lang="ts">
  import { ICON_PATHS, ICON_STROKE, type IconName } from "../../ui/icons.ts";

  let { name }: { name: IconName } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" data-icon={name} focusable="false" stroke-linecap={ICON_STROKE["stroke-linecap"]} stroke-linejoin={ICON_STROKE["stroke-linejoin"]}><path d={ICON_PATHS[name]} /></svg>
