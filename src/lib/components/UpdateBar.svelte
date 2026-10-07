<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import { createUpdateState } from "../../ui/update-state.ts";

  // "A new version is ready." Nothing changes until the player presses Update (contracts C3.6). The worker is registered
  // here, and a waiting one, or the ttt:update-ready window event, shows the bar.
  const update = createUpdateState();

  onMount(() => {
    void update.register();
  });
</script>

<div id="update-bar" class="glass" hidden={!$update.waiting}>
  {#if $update.waiting}
    <Icon name="info" />
    <span class="update-text">A new version is ready.</span>
    <button class="btn" type="button" disabled={$update.applying} onclick={() => update.apply()}>Update</button>
  {/if}
</div>
