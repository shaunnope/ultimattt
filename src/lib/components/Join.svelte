<script lang="ts">
  import { onMount } from "svelte";
  import type { JoinedRun } from "../../ui/net-run.ts";

  // The guest's joining screen: what the connection is doing, with Try again after a failure and Back. The game starts when the host answers.
  let { joined }: { joined: JoinedRun } = $props();

  let statusText = $state("");
  let statusError = $state(false);

  onMount(() =>
    joined.status.subscribe((line) => {
      statusText = line.text;
      statusError = line.error;
    }),
  );
</script>

<section class="screen waiting" aria-label="Joining a game">
  <h2>Joining game {joined.code}</h2>
  <p id="join-status" class={["status-line", statusError && "net-error"]} role={statusError ? "alert" : "status"} data-tone={statusError ? "error" : ""}>{statusText}</p>
  <div class="btn-row">
    <button class="btn" type="button" hidden={!statusError} onclick={() => joined.retry()}>Try again</button>
    <button class="btn" type="button" onclick={() => joined.back()}>Back</button>
  </div>
</section>
