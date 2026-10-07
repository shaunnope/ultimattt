<script lang="ts">
  import { toasts } from "../../ui/toast-state.ts";
</script>

<div id="toasts" class="toasts" aria-live="polite">
  {#each $toasts as item (item.id)}
    <div class="toast" role="status">{item.text}</div>
  {/each}
</div>
