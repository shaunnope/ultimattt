<script lang="ts">
  import { dialogs } from "../../ui/dialog-state.ts";
  import Dialog from "./Dialog.svelte";

  // Renders the stack of open dialogs, and locks the page behind them while any is open.
  $effect(() => {
    document.body.classList.toggle("modal-open", $dialogs.length > 0);
  });
</script>

{#each $dialogs as request (request.id)}
  <Dialog {request} />
{/each}
